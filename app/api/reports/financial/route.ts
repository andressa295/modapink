import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const TZ = "America/Sao_Paulo"
const PIX_RATE = 0.99
const CARD_RATE = 4.09
const CARD_FIXED_FEE = 0.35

type Store = {
  id: string
  user_id: string | number
  access_token: string
  created_at?: string | null
  updated_at?: string | null
}

type PaymentGroup = "pix" | "card" | "cash" | "other"
type ShippingGroup = "bus" | "pickup" | "postal" | "other"

function money(value: unknown) {
  const parsed = Number(value ?? 0)
  return Math.round((Number.isFinite(parsed) ? parsed : 0) * 100) / 100
}

function normalize(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function dateKey(value: Date) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value)

  const year = parts.find((part) => part.type === "year")?.value ?? "0000"
  const month = parts.find((part) => part.type === "month")?.value ?? "00"
  const day = parts.find((part) => part.type === "day")?.value ?? "00"
  return `${year}-${month}-${day}`
}

function safeDateKey(value: unknown) {
  const parsed = new Date(String(value ?? ""))
  return Number.isNaN(parsed.getTime()) ? null : dateKey(parsed)
}

function addDays(base: string, days: number) {
  const value = new Date(`${base}T12:00:00-03:00`)
  value.setDate(value.getDate() + days)
  return dateKey(value)
}

function getRange(url: URL) {
  const today = dateKey(new Date())
  const key = url.searchParams.get("range") || "today"
  let from = today
  let to = today

  if (key === "yesterday") {
    from = addDays(today, -1)
    to = from
  } else if (key === "7d") {
    from = addDays(today, -6)
  } else if (key === "week") {
    const weekday = new Date(`${today}T12:00:00-03:00`).getDay()
    from = addDays(today, -(weekday === 0 ? 6 : weekday - 1))
  } else if (key === "month") {
    from = `${today.slice(0, 8)}01`
  } else if (key === "previous_month") {
    const start = new Date(`${today}T12:00:00-03:00`)
    start.setMonth(start.getMonth() - 1, 1)
    from = dateKey(start)
    const end = new Date(start)
    end.setMonth(end.getMonth() + 1, 0)
    to = dateKey(end)
  } else if (key === "custom") {
    from = url.searchParams.get("from") || today
    to = url.searchParams.get("to") || today
  }

  if (from > to) [from, to] = [to, from]
  return { key, from, to }
}

function isoStart(value: string) {
  return `${value}T00:00:00-03:00`
}

function isoEnd(value: string) {
  return `${value}T23:59:59-03:00`
}

function paymentGroup(order: any): PaymentGroup {
  const value = normalize([
    order.gateway,
    order.gateway_name,
    order.payment_details?.method,
    order.payment_details?.type,
    order.payment_provider,
    order.payment_method
  ].join(" "))

  if (value.includes("pix")) return "pix"
  if (
    value.includes("card") ||
    value.includes("cart") ||
    value.includes("credito") ||
    value.includes("credit")
  ) return "card"
  if (value.includes("dinheiro") || value.includes("cash")) return "cash"
  return "other"
}

function shippingGroup(order: any): ShippingGroup {
  const value = normalize([
    order.shipping_option,
    order.shipping_option_reference,
    order.shipping_method
  ].join(" "))

  if (value.includes("onibus") || value.includes("excurs")) return "bus"
  if (value.includes("retirada") || value.includes("pickup")) return "pickup"
  if (value.includes("pac") || value.includes("sedex") || value.includes("correio")) return "postal"
  return "other"
}

function isPaid(order: any) {
  const status = normalize(order.payment_status)
  return status === "paid" || status.includes("pago") || Boolean(order.paid_at)
}

function paymentFeeFor(payment: PaymentGroup, total: number) {
  if (total <= 0) return 0
  if (payment === "pix") return money(total * PIX_RATE / 100)
  if (payment === "card") return money(total * CARD_RATE / 100 + CARD_FIXED_FEE)
  return 0
}

function itemSubtotal(order: any) {
  if (!Array.isArray(order.products)) return 0
  return money(order.products.reduce((sum: number, item: any) => {
    return sum + money(item.price) * Number(item.quantity || 0)
  }, 0))
}

function explicitRefundAmount(order: any) {
  const scalarCandidates = [
    order.refunded_amount,
    typeof order.refund === "number" || typeof order.refund === "string" ? order.refund : undefined,
    order.refund?.amount,
    order.refund?.value,
    order.payment_details?.refunded_amount,
    order.payment_details?.refund_amount,
    order.chargeback_amount
  ]

  let scalar = 0
  for (const candidate of scalarCandidates) scalar = Math.max(scalar, money(candidate))

  const refundRows = [
    ...(Array.isArray(order.refunds) ? order.refunds : []),
    ...(Array.isArray(order.payment_details?.refunds) ? order.payment_details.refunds : [])
  ]

  const rowsTotal = refundRows.reduce((sum: number, row: any) => {
    return sum + money(row?.amount ?? row?.value ?? row?.total)
  }, 0)

  const transactionTotal = (Array.isArray(order.transactions) ? order.transactions : [])
    .filter((transaction: any) => {
      const value = normalize(`${transaction?.type} ${transaction?.status} ${transaction?.kind}`)
      return value.includes("refund") || value.includes("estorn") || value.includes("chargeback")
    })
    .reduce((sum: number, transaction: any) => {
      return sum + money(transaction?.amount ?? transaction?.value ?? transaction?.total)
    }, 0)

  return money(Math.max(scalar, rowsTotal, transactionTotal))
}

function refundValue(order: any) {
  const explicit = explicitRefundAmount(order)
  if (explicit > 0) return explicit

  const status = normalize(`${order.payment_status} ${order.status}`)
  if (
    status.includes("refunded") ||
    status.includes("reembols") ||
    status.includes("estorn") ||
    status.includes("chargeback") ||
    status === "voided"
  ) return money(order.total)

  return 0
}

function refundDate(order: any) {
  const refundRows = [
    ...(Array.isArray(order.refunds) ? order.refunds : []),
    ...(Array.isArray(order.payment_details?.refunds) ? order.payment_details.refunds : [])
  ]

  const dates = refundRows
    .map((row: any) => row?.created_at || row?.refunded_at || row?.date)
    .filter(Boolean)
    .sort()

  return order.refunded_at || dates.at(-1) || order.updated_at || order.modified_at || order.created_at
}

function customerName(order: any) {
  const customer = order.customer || {}
  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(" ")
  return customer.name || fullName || order.billing_address?.name || "Cliente"
}

function storeTimestamp(store: Store) {
  return new Date(store.updated_at || store.created_at || 0).getTime()
}

function groupStores(stores: Store[]) {
  const grouped = new Map<string, Store[]>()

  for (const store of stores) {
    if (!store.user_id || !store.access_token) continue
    const key = String(store.user_id)
    const list = grouped.get(key) || []
    list.push(store)
    grouped.set(key, list)
  }

  for (const list of grouped.values()) {
    list.sort((a, b) => storeTimestamp(b) - storeTimestamp(a))
  }
  return grouped
}

async function fetchPage(store: Store, from: string, to: string, page: number) {
  const params = new URLSearchParams({
    updated_at_min: isoStart(from),
    updated_at_max: isoEnd(to),
    page: String(page),
    per_page: "100"
  })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)

  try {
    const response = await fetch(
      `https://api.nuvemshop.com.br/v1/${store.user_id}/orders?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Authentication: `bearer ${store.access_token}`,
          "Content-Type": "application/json",
          "User-Agent": "Phandshop (contato@phand.com.br)"
        },
        cache: "no-store",
        signal: controller.signal
      }
    )

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`NUVEMSHOP_${response.status}:${body.slice(0, 120)}`)
    }

    const payload = await response.json()
    return Array.isArray(payload) ? payload : []
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchOrdersForRange(store: Store, from: string, to: string) {
  const orders: any[] = []
  for (let page = 1; page <= 50; page++) {
    const batch = await fetchPage(store, from, to, page)
    orders.push(...batch)
    if (batch.length < 100) break
  }
  return orders
}

function emptyMethods() {
  return {
    pix: { orders: 0, received: 0, fees: 0, refunds: 0, net: 0 },
    card: { orders: 0, received: 0, fees: 0, refunds: 0, net: 0 },
    cash: { orders: 0, received: 0, fees: 0, refunds: 0, net: 0 },
    other: { orders: 0, received: 0, fees: 0, refunds: 0, net: 0 },
    bus: { orders: 0, salesWithoutFreight: 0, charged: 0, paymentFees: 0, net: 0 }
  } as any
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes("NUVEMSHOP_401")) return "A conexão da Nuvemshop precisa ser renovada."
  if (message.includes("NUVEMSHOP_429")) return "A Nuvemshop limitou temporariamente as consultas. Tente novamente em instantes."
  if (message.includes("AbortError") || message.includes("aborted")) return "A Nuvemshop demorou para responder. Tente novamente."
  return "Não foi possível consultar os pedidos da Nuvemshop."
}

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return Response.json({ error: "A configuração do financeiro está incompleta." }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const range = getRange(new URL(request.url))
    const { data: storeRows, error: storesError } = await supabase.from("stores").select("*")

    if (storesError) {
      console.error("Financeiro: erro ao buscar lojas", storesError)
      return Response.json({ error: "Não foi possível acessar o cadastro da loja." }, { status: 500 })
    }

    const groupedStores = groupStores((storeRows || []) as Store[])
    if (groupedStores.size === 0) {
      return Response.json({ error: "Nenhuma loja Nuvemshop conectada foi encontrada." }, { status: 409 })
    }

    const orderMap = new Map<string, any>()
    const failures: string[] = []
    let successfulStores = 0

    for (const [storeId, credentials] of groupedStores) {
      for (const store of credentials) {
        try {
          const orders = await fetchOrdersForRange(store, range.from, range.to)
          for (const order of orders) orderMap.set(`${storeId}:${order.id}`, order)
          successfulStores += 1
          break
        } catch (error) {
          console.error(`Financeiro: falha na loja ${storeId}`, error)
          failures.push(safeErrorMessage(error))
        }
      }
    }

    if (successfulStores === 0) {
      return Response.json({ error: failures[0] || "Não foi possível consultar a Nuvemshop." }, { status: 502 })
    }

    const allMovements: any[] = []

    for (const order of orderMap.values()) {
      const total = money(order.total)
      const knownFreight = money(order.shipping_cost_customer ?? order.shipping_cost_owner ?? order.shipping_cost)
      const subtotal = money(order.subtotal || itemSubtotal(order) || Math.max(0, total - knownFreight))
      const discount = money(order.discount ?? order.discount_coupon ?? Math.max(0, subtotal + knownFreight - total))
      const productNet = money(Math.max(0, subtotal - discount))
      const freight = knownFreight > 0 ? knownFreight : money(Math.max(0, total - productNet))
      const payment = paymentGroup(order)
      const shipping = shippingGroup(order)
      const paymentFee = paymentFeeFor(payment, total)
      const feeEstimated = payment === "pix" || payment === "card"
      const itemCount = Array.isArray(order.products)
        ? order.products.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0)
        : 0
      const paymentLabel = payment === "pix"
        ? "Pix"
        : payment === "card"
          ? "Cartão de crédito"
          : payment === "cash"
            ? "Dinheiro"
            : String(order.gateway_name || order.payment_details?.method || "Outro")
      const shippingLabel = shipping === "bus"
        ? "Ônibus / excursão"
        : String(order.shipping_option || order.shipping_option_reference || "Não informado")
      const refund = refundValue(order)

      if (isPaid(order)) {
        allMovements.push({
          id: `${order.id}-sale`,
          date: order.paid_at || order.created_at,
          orderNumber: String(order.number || order.id || "—"),
          customer: customerName(order),
          type: "sale",
          paymentGroup: payment,
          paymentLabel,
          shippingGroup: shipping,
          shippingLabel,
          itemCount,
          productGross: subtotal,
          discount,
          productNet,
          freight,
          busFee: shipping === "bus" ? freight : 0,
          totalReceived: total,
          paymentFee,
          refund: 0,
          net: money(total - paymentFee),
          feeEstimated,
          status: String(order.payment_status || "Pago")
        })
      }

      if (refund > 0) {
        allMovements.push({
          id: `${order.id}-refund`,
          date: refundDate(order),
          orderNumber: String(order.number || order.id || "—"),
          customer: customerName(order),
          type: "refund",
          paymentGroup: payment,
          paymentLabel,
          shippingGroup: shipping,
          shippingLabel,
          itemCount: 0,
          productGross: 0,
          discount: 0,
          productNet: 0,
          freight: 0,
          busFee: 0,
          totalReceived: 0,
          paymentFee: 0,
          refund,
          net: -refund,
          feeEstimated: false,
          status: String(order.payment_status || "Reembolsado")
        })
      }
    }

    const movements = allMovements
      .filter((movement) => {
        const key = safeDateKey(movement.date)
        return Boolean(key && key >= range.from && key <= range.to)
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    const metrics: any = {
      orders: 0,
      items: 0,
      productGross: 0,
      discounts: 0,
      salesWithoutFreight: 0,
      freight: 0,
      busFees: 0,
      totalReceived: 0,
      paymentFees: 0,
      refunds: 0,
      net: 0,
      ticketWithoutFreight: 0,
      estimatedFeeOrders: 0
    }

    const methods = emptyMethods()
    const chartMap = new Map<string, any>()

    for (const movement of movements) {
      const key = safeDateKey(movement.date)
      if (!key) continue
      const day = chartMap.get(key) || { date: key, sales: 0, fees: 0, refunds: 0, net: 0 }
      const method = methods[movement.paymentGroup] || methods.other

      if (movement.type === "sale") {
        metrics.orders += 1
        metrics.items += movement.itemCount
        metrics.productGross += movement.productGross
        metrics.discounts += movement.discount
        metrics.salesWithoutFreight += movement.productNet
        metrics.freight += movement.freight
        metrics.busFees += movement.busFee
        metrics.totalReceived += movement.totalReceived
        metrics.paymentFees += movement.paymentFee
        if (movement.feeEstimated) metrics.estimatedFeeOrders += 1

        method.orders += 1
        method.received += movement.totalReceived
        method.fees += movement.paymentFee

        if (movement.shippingGroup === "bus") {
          methods.bus.orders += 1
          methods.bus.salesWithoutFreight += movement.productNet
          methods.bus.charged += movement.busFee
          methods.bus.paymentFees += movement.paymentFee
          methods.bus.net += movement.net
        }

        day.sales += movement.totalReceived
        day.fees += movement.paymentFee
      } else {
        metrics.refunds += movement.refund
        method.refunds += movement.refund
        if (movement.shippingGroup === "bus") methods.bus.net -= movement.refund
        day.refunds += movement.refund
      }

      metrics.net += movement.net
      method.net += movement.net
      day.net += movement.net
      chartMap.set(key, day)
    }

    metrics.ticketWithoutFreight = metrics.orders ? money(metrics.salesWithoutFreight / metrics.orders) : 0

    for (const key of Object.keys(metrics)) {
      if (typeof metrics[key] === "number") metrics[key] = money(metrics[key])
    }

    for (const key of ["pix", "card", "cash", "other"]) {
      methods[key].received = money(methods[key].received)
      methods[key].fees = money(methods[key].fees)
      methods[key].refunds = money(methods[key].refunds)
      methods[key].net = money(methods[key].net)
    }

    for (const key of ["salesWithoutFreight", "charged", "paymentFees", "net"]) {
      methods.bus[key] = money(methods.bus[key])
    }

    return Response.json({
      generatedAt: new Date().toISOString(),
      range: { key: range.key, label: `${range.from} a ${range.to}`, from: range.from, to: range.to },
      metrics,
      methods,
      chart: Array.from(chartMap.values())
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((item) => ({
          ...item,
          sales: money(item.sales),
          fees: money(item.fees),
          refunds: money(item.refunds),
          net: money(item.net)
        })),
      movements,
      feeConfig: {
        pixPercent: PIX_RATE,
        cardPercent: CARD_RATE,
        cardFixedFee: CARD_FIXED_FEE,
        otherPercent: 0,
        estimatedFeeOrders: metrics.estimatedFeeOrders
      }
    })
  } catch (error) {
    console.error("Erro relatório financeiro:", error)
    return Response.json({ error: safeErrorMessage(error) }, { status: 500 })
  }
}
