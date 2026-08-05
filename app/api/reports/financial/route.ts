import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TZ = "America/Sao_Paulo"
const pixRate = Number(process.env.FINANCE_PIX_FEE_PERCENT || 0)
const cardRate = Number(process.env.FINANCE_CARD_FEE_PERCENT || 11.45)
const otherRate = Number(process.env.FINANCE_OTHER_FEE_PERCENT || 0)

function money(value: unknown) {
  const n = Number(value || 0)
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100
}

function text(value: unknown) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

function dateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date)
}

function getRange(url: URL) {
  const now = new Date()
  const today = dateKey(now)
  const range = url.searchParams.get("range") || "today"
  let from = today
  let to = today

  const shift = (days: number) => {
    const d = new Date(now)
    d.setDate(d.getDate() + days)
    return dateKey(d)
  }

  if (range === "yesterday") from = to = shift(-1)
  if (range === "7d") from = shift(-6)
  if (range === "week") {
    const weekday = now.getDay()
    from = shift(-(weekday === 0 ? 6 : weekday - 1))
  }
  if (range === "month") from = `${today.slice(0, 8)}01`
  if (range === "previous_month") {
    const d = new Date(`${today}T12:00:00-03:00`)
    d.setMonth(d.getMonth() - 1, 1)
    from = dateKey(d)
    d.setMonth(d.getMonth() + 1, 0)
    to = dateKey(d)
  }
  if (range === "custom") {
    from = url.searchParams.get("from") || today
    to = url.searchParams.get("to") || today
  }

  return { range, from, to }
}

function paymentGroup(order: any) {
  const value = text(`${order.payment_method} ${order.raw?.gateway_name} ${order.raw?.payment_details?.method}`)
  if (value.includes("pix")) return "pix"
  if (value.includes("card") || value.includes("cart") || value.includes("credito") || value.includes("credit")) return "card"
  if (value.includes("boleto")) return "boleto"
  if (value.includes("dinheiro") || value.includes("cash")) return "cash"
  return "other"
}

function shippingGroup(order: any) {
  const value = text(`${order.shipping_method} ${order.raw?.shipping_option}`)
  if (value.includes("onibus") || value.includes("excurs")) return "bus"
  if (value.includes("retirada") || value.includes("pickup")) return "pickup"
  if (value.includes("pac") || value.includes("sedex") || value.includes("correio")) return "postal"
  return "other"
}

function paid(order: any) {
  const status = text(order.payment_status)
  return status.includes("pago") || status === "paid" || status === "authorized" || Boolean(order.raw?.paid_at)
}

function refundValue(order: any) {
  const raw = order.raw || {}
  const direct = money(raw.refund || raw.refunded_amount || raw.payment_details?.refunded_amount)
  const history = Array.isArray(raw._financial_history) ? raw._financial_history : []
  const historyRefund = history.reduce((sum: number, item: any) => {
    const diff = money(item.total_paid_diff ?? item.amount_diff ?? item.value)
    return sum + (diff < 0 ? Math.abs(diff) : 0)
  }, 0)
  const status = text(order.payment_status)
  if (direct || historyRefund) return money(Math.max(direct, historyRefund))
  if (status.includes("reembols") || status.includes("estorn") || status === "refunded" || status === "voided") return money(order.total)
  return 0
}

function refundDate(order: any) {
  const raw = order.raw || {}
  const history = Array.isArray(raw._financial_history) ? raw._financial_history : []
  const negative = history
    .filter((item: any) => money(item.total_paid_diff ?? item.amount_diff ?? item.value) < 0)
    .map((item: any) => item.created_at || item.date || item.updated_at)
    .filter(Boolean)
    .sort()
  return raw.refunded_at || negative.at(-1) || order.updated_at || order.created_at
}

function realFee(order: any) {
  const raw = order.raw || {}
  const candidates = [
    raw.payment_details?.fee,
    raw.payment_details?.gateway_fee,
    raw.payment_details?.transaction_fee,
    raw.gateway_fee,
    raw.payment_fee,
    raw.costs?.payment
  ]
  for (const value of candidates) {
    const fee = money(value)
    if (fee > 0) return fee
  }
  return 0
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const { range, from, to } = getRange(url)

    const { data, error } = await supabase
      .from("orders")
      .select("id,external_id,order_number,customer_name,payment_status,payment_method,shipping_method,total,subtotal,items,raw,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(10000)

    if (error) throw error

    const allMovements: any[] = []

    for (const order of data || []) {
      const refund = refundValue(order)
      if (!paid(order) && refund <= 0) continue

      const raw = order.raw || {}
      const total = money(order.total)
      const subtotal = money(order.subtotal || raw.subtotal)
      const freight = money(raw.shipping_cost_customer ?? raw.shipping_cost_owner ?? Math.max(0, total - subtotal))
      const discount = money(raw.discount_coupon ?? raw.discount ?? Math.max(0, subtotal + freight - total))
      const productNet = money(Math.max(0, subtotal - discount))
      const group = paymentGroup(order)
      const shipping = shippingGroup(order)
      const actualFee = realFee(order)
      const rate = group === "pix" ? pixRate : group === "card" ? cardRate : otherRate
      const estimated = actualFee <= 0 && rate > 0
      const paymentFee = actualFee > 0 ? actualFee : money(total * rate / 100)
      const itemCount = Array.isArray(order.items)
        ? order.items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0)
        : 0
      const installments = Number(raw.payment_details?.installments || raw.installments || 1)
      const paymentLabel = group === "pix"
        ? "Pix"
        : group === "card"
          ? `Cartão ${installments > 1 ? `${installments}x` : "à vista"}`
          : group === "boleto"
            ? "Boleto"
            : group === "cash"
              ? "Dinheiro"
              : String(order.payment_method || "Outro")
      const shippingLabel = shipping === "bus" ? "Ônibus / excursão" : String(order.shipping_method || "Não informado")

      if (paid(order)) {
        allMovements.push({
          id: `${order.id}-sale`,
          date: raw.paid_at || order.created_at,
          orderNumber: String(order.order_number || order.external_id),
          customer: order.customer_name || "Cliente",
          type: "sale",
          paymentGroup: group,
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
          feeEstimated: estimated,
          status: String(order.payment_status || "Pago")
        })
      }

      if (refund > 0) {
        allMovements.push({
          id: `${order.id}-refund`,
          date: refundDate(order),
          orderNumber: String(order.order_number || order.external_id),
          customer: order.customer_name || "Cliente",
          type: "refund",
          paymentGroup: group,
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
        const key = dateKey(new Date(movement.date))
        return key >= from && key <= to
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    const summary = {
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

    const methods: any = {}
    for (const key of ["pix", "card", "boleto", "cash", "other"]) {
      methods[key] = { orders: 0, received: 0, fees: 0, refunds: 0, net: 0 }
    }
    methods.bus = { orders: 0, salesWithoutFreight: 0, charged: 0, paymentFees: 0, net: 0 }

    const chartMap = new Map<string, any>()

    for (const movement of movements) {
      const key = dateKey(new Date(movement.date))
      const day = chartMap.get(key) || { date: key, sales: 0, fees: 0, refunds: 0, net: 0 }

      if (movement.type === "sale") {
        summary.orders++
        summary.items += movement.itemCount
        summary.productGross += movement.productGross
        summary.discounts += movement.discount
        summary.salesWithoutFreight += movement.productNet
        summary.freight += movement.freight
        summary.busFees += movement.busFee
        summary.totalReceived += movement.totalReceived
        summary.paymentFees += movement.paymentFee
        if (movement.feeEstimated) summary.estimatedFeeOrders++

        methods[movement.paymentGroup].orders++
        methods[movement.paymentGroup].received += movement.totalReceived
        methods[movement.paymentGroup].fees += movement.paymentFee

        if (movement.shippingGroup === "bus") {
          methods.bus.orders++
          methods.bus.salesWithoutFreight += movement.productNet
          methods.bus.charged += movement.busFee
          methods.bus.paymentFees += movement.paymentFee
          methods.bus.net += movement.net
        }

        day.sales += movement.totalReceived
        day.fees += movement.paymentFee
      } else {
        summary.refunds += movement.refund
        methods[movement.paymentGroup].refunds += movement.refund
        day.refunds += movement.refund
      }

      summary.net += movement.net
      methods[movement.paymentGroup].net += movement.net
      day.net += movement.net
      chartMap.set(key, day)
    }

    summary.ticketWithoutFreight = summary.orders ? money(summary.salesWithoutFreight / summary.orders) : 0

    for (const key of Object.keys(summary)) {
      const value = (summary as any)[key]
      ;(summary as any)[key] = typeof value === "number" ? money(value) : value
    }

    for (const key of ["pix", "card", "boleto", "cash", "other"]) {
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
      range: { key: range, label: `${from} a ${to}`, from, to },
      metrics: summary,
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
        pixPercent: pixRate,
        cardPercent: cardRate,
        otherPercent: otherRate,
        estimatedFeeOrders: summary.estimatedFeeOrders
      }
    })
  } catch (error) {
    console.error("Erro relatório financeiro:", error)
    return Response.json({ error: "Não foi possível carregar o financeiro." }, { status: 500 })
  }
}
