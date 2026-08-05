import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TZ = "America/Sao_Paulo"
const pixRate = Number(process.env.FINANCE_PIX_FEE_PERCENT || 0)
const cardRate = Number(process.env.FINANCE_CARD_FEE_PERCENT || 11.45)
const otherRate = Number(process.env.FINANCE_OTHER_FEE_PERCENT || 0)

type Store = {
  id: string
  user_id: string | number
  access_token: string
}

function money(value: unknown) {
  const parsed = Number(value || 0)
  const safe = Number.isFinite(parsed) ? parsed : 0
  return Math.round(safe * 100) / 100
}

function normalize(value: unknown) {
  return String(value || "")
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

  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value

  return `${year}-${month}-${day}`
}

function safeDateKey(value: unknown) {
  const parsed = new Date(String(value || ""))
  return Number.isNaN(parsed.getTime()) ? null : dateKey(parsed)
}

function addDays(base: string, days: number) {
  const value = new Date(`${base}T12:00:00-03:00`)
  value.setDate(value.getDate() + days)
  return dateKey(value)
}

function getRange(url: URL) {
  const today = dateKey(new Date())
  const range = url.searchParams.get("range") || "today"

  let from = today
  let to = today

  if (range === "yesterday") {
    from = addDays(today, -1)
    to = from
  }

  if (range === "7d") {
    from = addDays(today, -6)
  }

  if (range === "week") {
    const weekday = new Date(`${today}T12:00:00-03:00`).getDay()
    from = addDays(today, -(weekday === 0 ? 6 : weekday - 1))
  }

  if (range === "month") {
    from = `${today.slice(0, 8)}01`
  }

  if (range === "previous_month") {
    const start = new Date(`${today}T12:00:00-03:00`)
    start.setMonth(start.getMonth() - 1, 1)
    from = dateKey(start)

    const end = new Date(start)
    end.setMonth(end.getMonth() + 1, 0)
    to = dateKey(end)
  }

  if (range === "custom") {
    from = url.searchParams.get("from") || today
    to = url.searchParams.get("to") || today
  }

  return { key: range, from, to }
}

function isoStart(value: string) {
  return `${value}T00:00:00-03:00`
}

function isoEnd(value: string) {
  return `${value}T23:59:59-03:00`
}

function paymentGroup(order: any) {
  const value = normalize([
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
  ) {
    return "card"
  }

  if (value.includes("boleto")) return "boleto"

  if (
    value.includes("dinheiro") ||
    value.includes("cash")
  ) {
    return "cash"
  }

  return "other"
}

function shippingGroup(order: any) {
  const value = normalize([
    order.shipping_option,
    order.shipping_option_reference,
    order.shipping_method
  ].join(" "))

  if (
    value.includes("onibus") ||
    value.includes("excurs")
  ) {
    return "bus"
  }

  if (
    value.includes("retirada") ||
    value.includes("pickup")
  ) {
    return "pickup"
  }

  if (
    value.includes("pac") ||
    value.includes("sedex") ||
    value.includes("correio")
  ) {
    return "postal"
  }

  return "other"
}

function isPaid(order: any) {
  const status = normalize(order.payment_status)

  return (
    status === "paid" ||
    status === "authorized" ||
    status.includes("pago") ||
    Boolean(order.paid_at)
  )
}

function itemSubtotal(order: any) {
  if (!Array.isArray(order.products)) return 0

  return money(order.products.reduce((sum: number, item: any) => {
    return sum + money(item.price) * Number(item.quantity || 0)
  }, 0))
}

function refundValue(order: any) {
  const direct = money(
    order.refunded_amount ||
    order.refund ||
    order.payment_details?.refunded_amount
  )

  const total = money(order.total)
  const paidAfterAdjustments = money(order.total_paid_by_customer)

  const inferred =
    order.paid_at &&
    paidAfterAdjustments >= 0 &&
    paidAfterAdjustments < total
      ? money(total - paidAfterAdjustments)
      : 0

  const status = normalize(order.payment_status)

  if (direct > 0 || inferred > 0) {
    return money(Math.max(direct, inferred))
  }

  if (
    status === "refunded" ||
    status === "voided" ||
    status.includes("reembols") ||
    status.includes("estorn")
  ) {
    return total
  }

  return 0
}

function refundDate(order: any) {
  return (
    order.refunded_at ||
    order.updated_at ||
    order.modified_at ||
    order.created_at
  )
}

function realFee(order: any) {
  const candidates = [
    order.payment_details?.fee,
    order.payment_details?.gateway_fee,
    order.payment_details?.transaction_fee,
    order.gateway_fee,
    order.payment_fee,
    order.costs?.payment
  ]

  for (const candidate of candidates) {
    const fee = money(candidate)
    if (fee > 0) return fee
  }

  return 0
}

async function fetchPage(
  store: Store,
  filter: "created" | "updated",
  from: string,
  to: string,
  page: number
) {
  const params = new URLSearchParams({
    status: "any",
    payment_status: "any",
    page: String(page),
    per_page: "100"
  })

  if (filter === "created") {
    params.set("created_at_min", isoStart(from))
    params.set("created_at_max", isoEnd(to))
  } else {
    params.set("updated_at_min", isoStart(from))
    params.set("updated_at_max", isoEnd(to))
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)

  try {
    const response = await fetch(
      `https://api.nuvemshop.com.br/v1/${store.user_id}/orders?${params}`,
      {
        method: "GET",
        headers: {
          Authentication: `bearer ${store.access_token}`,
          Authorization: `Bearer ${store.access_token}`,
          "Content-Type": "application/json",
          "User-Agent": "Phandshop (contato@phand.com.br)"
        },
        cache: "no-store",
        signal: controller.signal
      }
    )

    if (!response.ok) {
      const body = await response.text()

      throw new Error(
        `Nuvemshop ${response.status}: ${body.slice(0, 250)}`
      )
    }

    const payload = await response.json()

    return Array.isArray(payload) ? payload : []
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchOrdersForRange(
  store: Store,
  filter: "created" | "updated",
  from: string,
  to: string
) {
  const orders: any[] = []

  for (let page = 1; page <= 100; page++) {
    const batch = await fetchPage(
      store,
      filter,
      from,
      to,
      page
    )

    orders.push(...batch)

    if (batch.length < 100) break
  }

  return orders
}

function emptyMethods() {
  return {
    pix: { orders: 0, received: 0, fees: 0, refunds: 0, net: 0 },
    card: { orders: 0, received: 0, fees: 0, refunds: 0, net: 0 },
    boleto: { orders: 0, received: 0, fees: 0, refunds: 0, net: 0 },
    cash: { orders: 0, received: 0, fees: 0, refunds: 0, net: 0 },
    other: { orders: 0, received: 0, fees: 0, refunds: 0, net: 0 },
    bus: {
      orders: 0,
      salesWithoutFreight: 0,
      charged: 0,
      paymentFees: 0,
      net: 0
    }
  } as any
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const range = getRange(url)

    const { data: stores, error: storesError } = await supabase
      .from("stores")
      .select("id,user_id,access_token")

    if (storesError) {
      throw new Error(`Stores: ${storesError.message}`)
    }

    const validStores = (stores || []).filter((store: any) => {
      return Boolean(store.user_id && store.access_token)
    }) as Store[]

    const orderMap = new Map<string, any>()

    for (const store of validStores) {
      const createdOrders = await fetchOrdersForRange(
        store,
        "created",
        range.from,
        range.to
      )

      const updatedOrders = await fetchOrdersForRange(
        store,
        "updated",
        range.from,
        range.to
      )

      for (const order of [...createdOrders, ...updatedOrders]) {
        orderMap.set(`${store.id}:${order.id}`, order)
      }
    }

    const allMovements: any[] = []

    for (const order of orderMap.values()) {
      const total = money(order.total)
      const knownFreight = money(
        order.shipping_cost_customer ??
        order.shipping_cost_owner ??
        order.shipping_cost
      )

      const subtotal = money(
        order.subtotal ??
        itemSubtotal(order) ??
        Math.max(0, total - knownFreight)
      )

      const discount = money(
        order.discount ??
        order.discount_coupon ??
        Math.max(0, subtotal + knownFreight - total)
      )

      const productNet = money(
        Math.max(0, subtotal - discount)
      )

      const freight =
        knownFreight > 0
          ? knownFreight
          : money(Math.max(0, total - productNet))

      const payment = paymentGroup(order)
      const shipping = shippingGroup(order)
      const actualFee = realFee(order)

      const rate =
        payment === "pix"
          ? pixRate
          : payment === "card"
            ? cardRate
            : otherRate

      const feeEstimated = actualFee <= 0 && rate > 0
      const paymentFee =
        actualFee > 0
          ? actualFee
          : money(total * rate / 100)

      const installments = Number(
        order.payment_details?.installments ||
        order.installments ||
        1
      )

      const itemCount = Array.isArray(order.products)
        ? order.products.reduce(
            (sum: number, item: any) =>
              sum + Number(item.quantity || 0),
            0
          )
        : 0

      const paymentLabel =
        payment === "pix"
          ? "Pix"
          : payment === "card"
            ? `Cartão ${installments > 1 ? `${installments}x` : "à vista"}`
            : payment === "boleto"
              ? "Boleto"
              : payment === "cash"
                ? "Dinheiro"
                : String(
                    order.gateway_name ||
                    order.payment_details?.method ||
                    "Outro"
                  )

      const shippingLabel =
        shipping === "bus"
          ? "Ônibus / excursão"
          : String(
              order.shipping_option ||
              order.shipping_option_reference ||
              "Não informado"
            )

      const refund = refundValue(order)

      if (isPaid(order)) {
        allMovements.push({
          id: `${order.id}-sale`,
          date: order.paid_at || order.created_at,
          orderNumber: String(order.number || order.id || "—"),
          customer:
            order.customer?.name ||
            order.billing_address?.name ||
            "Cliente",
          type: "sale",
          paymentGroup: payment,
          paymentLabel,
          shippingGroup: shipping,
          shippingLabel,
          installments,
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
          customer:
            order.customer?.name ||
            order.billing_address?.name ||
            "Cliente",
          type: "refund",
          paymentGroup: payment,
          paymentLabel,
          shippingGroup: shipping,
          shippingLabel,
          installments,
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

        return Boolean(
          key &&
          key >= range.from &&
          key <= range.to
        )
      })
      .sort((a, b) => {
        return (
          new Date(b.date).getTime() -
          new Date(a.date).getTime()
        )
      })

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

      const day = chartMap.get(key) || {
        date: key,
        sales: 0,
        fees: 0,
        refunds: 0,
        net: 0
      }

      const method =
        methods[movement.paymentGroup] ||
        methods.other

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

        if (movement.feeEstimated) {
          metrics.estimatedFeeOrders += 1
        }

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

        if (movement.shippingGroup === "bus") {
          methods.bus.net -= movement.refund
        }

        day.refunds += movement.refund
      }

      metrics.net += movement.net
      method.net += movement.net
      day.net += movement.net

      chartMap.set(key, day)
    }

    metrics.ticketWithoutFreight =
      metrics.orders > 0
        ? money(
            metrics.salesWithoutFreight /
            metrics.orders
          )
        : 0

    for (const key of Object.keys(metrics)) {
      if (typeof metrics[key] === "number") {
        metrics[key] = money(metrics[key])
      }
    }

    for (const key of [
      "pix",
      "card",
      "boleto",
      "cash",
      "other"
    ]) {
      methods[key].received = money(methods[key].received)
      methods[key].fees = money(methods[key].fees)
      methods[key].refunds = money(methods[key].refunds)
      methods[key].net = money(methods[key].net)
    }

    for (const key of [
      "salesWithoutFreight",
      "charged",
      "paymentFees",
      "net"
    ]) {
      methods.bus[key] = money(methods.bus[key])
    }

    const chart = Array.from(chartMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item) => ({
        ...item,
        sales: money(item.sales),
        fees: money(item.fees),
        refunds: money(item.refunds),
        net: money(item.net)
      }))

    return Response.json({
      generatedAt: new Date().toISOString(),
      range: {
        ...range,
        label: `${range.from} a ${range.to}`
      },
      metrics,
      methods,
      chart,
      movements,
      feeConfig: {
        pixPercent: pixRate,
        cardPercent: cardRate,
        otherPercent: otherRate,
        estimatedFeeOrders:
          metrics.estimatedFeeOrders
      }
    })
  } catch (error) {
    console.error("Erro relatório financeiro:", error)

    return Response.json(
      {
        error: "Não foi possível carregar o financeiro.",
        code: "FINANCIAL_REPORT_ERROR"
      },
      { status: 500 }
    )
  }
}
