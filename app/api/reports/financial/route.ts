import { createClient, SupabaseClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const TZ = "America/Sao_Paulo"
const PIX_RATE = 0.99
const CARD_RATE = 4.09
const CARD_FIXED_FEE = 0.35
const PAGE_SIZE = 100
const MAX_FILTERED_PAGES = 12
const MAX_SIMPLE_PAGES = 20
const LOCAL_PAGE_SIZE = 1000
const LOCAL_MAX_ROWS = 20_000
const REPORT_CACHE_MS = 60_000

type ReportRange = {
  key: string
  from: string
  to: string
}

type PaymentGroup = "pix" | "card" | "cash" | "other"
type ShippingGroup = "bus" | "postal" | "motoboy" | "pickup" | "unknown"
type OrderSource = "nuvemshop" | "database"
type FetchMode = "filtered" | "simple"

type StoreRow = {
  id?: string | number | null
  store_id?: string | number | null
  user_id?: string | number | null
  access_token?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type Credential = {
  storeId: string
  accessToken: string
  timestamp: number
}

type CachedReport = {
  expiresAt: number
  value: ReturnType<typeof buildReport>
}

const reportCache = new Map<string, CachedReport>()
const pendingReports = new Map<string, Promise<ReturnType<typeof buildReport>>>()

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

function objectValue(value: unknown): Record<string, any> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, any>
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : {}
    } catch {
      return {}
    }
  }

  return {}
}

function arrayValue(value: unknown): any[] {
  if (Array.isArray(value)) return value

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  return []
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

function getRange(url: URL): ReportRange {
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

function reportCacheKey(range: ReportRange) {
  return `${range.key}:${range.from}:${range.to}`
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
  ) {
    return "card"
  }

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

  if (
    value.includes("motoboy") ||
    value.includes("moto boy") ||
    value.includes("moto-boy") ||
    value.includes("motofrete") ||
    value.includes("entrega local") ||
    value.includes("delivery")
  ) {
    return "motoboy"
  }

  if (value.includes("retirada") || value.includes("pickup")) return "pickup"

  if (
    value.includes("pac") ||
    value.includes("sedex") ||
    value.includes("correio")
  ) {
    return "postal"
  }

  return "unknown"
}

function rawShippingLabel(order: any) {
  return String(
    order.shipping_option ||
    order.shipping_option_reference ||
    order.shipping_method ||
    "Não informado"
  ).trim()
}

function shippingLabel(order: any, group: ShippingGroup) {
  const raw = rawShippingLabel(order)

  if (group === "bus") return "Ônibus / excursão"
  if (group === "motoboy") return raw === "Não informado" ? "Motoboy" : raw
  if (group === "postal") return raw === "Não informado" ? "Correios" : raw
  if (group === "pickup") return raw === "Não informado" ? "Retirada" : raw

  return raw
}

function paymentLabel(order: any, group: PaymentGroup) {
  if (group === "pix") return "Pix"
  if (group === "card") return "Cartão de crédito"
  if (group === "cash") return "Dinheiro"

  return String(
    order.gateway_name ||
    order.payment_details?.method ||
    order.payment_method ||
    "Não identificado"
  ).trim()
}

function isPaid(order: any) {
  const status = normalize(order.payment_status)

  return (
    status === "paid" ||
    status === "pago" ||
    status.includes("pago") ||
    Boolean(order.paid_at)
  )
}

function paymentFeeFor(payment: PaymentGroup, total: number) {
  if (total <= 0) return 0
  if (payment === "pix") return money(total * PIX_RATE / 100)
  if (payment === "card") return money(total * CARD_RATE / 100 + CARD_FIXED_FEE)

  return 0
}

function itemSubtotal(order: any) {
  return money(
    arrayValue(order.products).reduce((sum: number, item: any) => {
      return sum + money(item?.price) * Number(item?.quantity || 0)
    }, 0)
  )
}

function financialHistory(order: any) {
  return arrayValue(order._financial_history || order.financial_history)
}

function explicitRefundAmount(order: any) {
  const scalarCandidates = [
    order.refunded_amount,
    typeof order.refund === "number" || typeof order.refund === "string"
      ? order.refund
      : undefined,
    order.refund?.amount,
    order.refund?.value,
    order.payment_details?.refunded_amount,
    order.payment_details?.refund_amount,
    order.chargeback_amount
  ]

  let scalar = 0

  for (const candidate of scalarCandidates) {
    scalar = Math.max(scalar, money(candidate))
  }

  const refundRows = [
    ...arrayValue(order.refunds),
    ...arrayValue(order.payment_details?.refunds)
  ]

  const rowsTotal = refundRows.reduce((sum: number, row: any) => {
    return sum + money(row?.amount ?? row?.value ?? row?.total)
  }, 0)

  const transactionTotal = arrayValue(order.transactions)
    .filter((transaction: any) => {
      const value = normalize(
        `${transaction?.type} ${transaction?.status} ${transaction?.kind}`
      )

      return (
        value.includes("refund") ||
        value.includes("estorn") ||
        value.includes("chargeback")
      )
    })
    .reduce((sum: number, transaction: any) => {
      return sum + money(
        transaction?.amount ??
        transaction?.value ??
        transaction?.total
      )
    }, 0)

  const historyTotal = financialHistory(order).reduce((sum: number, item: any) => {
    const difference = money(
      item?.total_paid_diff ??
      item?.amount_diff ??
      item?.value
    )

    return difference < 0 ? sum + Math.abs(difference) : sum
  }, 0)

  return money(Math.max(scalar, rowsTotal, transactionTotal, historyTotal))
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
  ) {
    return money(order.total)
  }

  return 0
}

function refundDate(order: any) {
  const refundDates = [
    ...arrayValue(order.refunds),
    ...arrayValue(order.payment_details?.refunds)
  ]
    .map((row: any) => row?.created_at || row?.refunded_at || row?.date)
    .filter(Boolean)

  const historyDates = financialHistory(order)
    .filter((item: any) => {
      return money(item?.total_paid_diff ?? item?.amount_diff ?? item?.value) < 0
    })
    .map((item: any) => item?.created_at || item?.date || item?.updated_at)
    .filter(Boolean)

  return (
    order.refunded_at ||
    [...refundDates, ...historyDates].sort().at(-1) ||
    order.updated_at ||
    order.modified_at ||
    order.created_at
  )
}

function customerName(order: any) {
  const customer = objectValue(order.customer)
  const fullName = [customer.first_name, customer.last_name]
    .filter(Boolean)
    .join(" ")

  return (
    customer.name ||
    fullName ||
    order.billing_address?.name ||
    order.customer_name ||
    "Cliente"
  )
}

function normalizeLocalOrder(row: any) {
  const raw = objectValue(row?.raw)
  const rawCustomer = objectValue(raw.customer)
  const rawProducts = arrayValue(raw.products)

  const items = rawProducts.length
    ? rawProducts
    : arrayValue(row?.items || row?.raw_products)

  return {
    ...row,
    ...raw,
    id: raw.id || row?.external_id || row?.id,
    number: raw.number || row?.order_number || row?.external_id || row?.id,
    customer: Object.keys(rawCustomer).length
      ? rawCustomer
      : { name: row?.customer_name || "Cliente" },
    customer_name: row?.customer_name || raw.customer_name,
    payment_status: row?.payment_status || raw.payment_status,
    payment_method: row?.payment_method || raw.payment_method,
    gateway_name: raw.gateway_name || row?.payment_method,
    shipping_method:
      row?.shipping_method ||
      raw.shipping_method ||
      raw.shipping_option,
    subtotal: row?.subtotal ?? raw.subtotal,
    total: row?.total ?? raw.total,
    products: items,
    created_at: raw.created_at || row?.created_at,
    updated_at: raw.updated_at || row?.updated_at,
    paid_at: raw.paid_at || row?.paid_at,
    _financial_history:
      raw._financial_history ||
      row?._financial_history
  }
}

async function fetchLocalOrders(supabase: SupabaseClient) {
  const rows: any[] = []

  for (
    let start = 0;
    start < LOCAL_MAX_ROWS;
    start += LOCAL_PAGE_SIZE
  ) {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .range(start, start + LOCAL_PAGE_SIZE - 1)

    if (error) {
      throw new Error(`LOCAL_ORDERS:${error.message}`)
    }

    rows.push(...(data || []))

    if (!data || data.length < LOCAL_PAGE_SIZE) break
  }

  return rows.map(normalizeLocalOrder)
}

function credentialTimestamp(row: StoreRow) {
  return new Date(row.updated_at || row.created_at || 0).getTime()
}

function collectCredentials(rows: StoreRow[]) {
  const grouped = new Map<string, Credential[]>()

  for (const row of rows) {
    const accessToken = String(row.access_token || "").trim()
    if (!accessToken) continue

    const ids = Array.from(
      new Set(
        [row.store_id, row.user_id]
          .filter((value) => value !== null && value !== undefined && value !== "")
          .map(String)
      )
    )

    for (const storeId of ids) {
      const credentials = grouped.get(storeId) || []

      credentials.push({
        storeId,
        accessToken,
        timestamp: credentialTimestamp(row)
      })

      grouped.set(storeId, credentials)
    }
  }

  for (const credentials of grouped.values()) {
    credentials.sort((a, b) => b.timestamp - a.timestamp)
  }

  return grouped
}

function errorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const match = message.match(/NUVEMSHOP_(\d+)/)
  return match ? Number(match[1]) : 0
}

function isTransientStatus(status: number) {
  return [408, 425, 429, 500, 502, 503, 504].includes(status)
}

async function fetchNuvemshopPage(
  credential: Credential,
  range: ReportRange,
  page: number,
  mode: FetchMode,
  attempt = 1
): Promise<any[]> {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(PAGE_SIZE)
  })

  if (mode === "filtered") {
    params.set("updated_at_min", isoStart(range.from))
    params.set("updated_at_max", isoEnd(range.to))
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 14_000)

  try {
    const response = await fetch(
      `https://api.nuvemshop.com.br/v1/${credential.storeId}/orders?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Authentication: `bearer ${credential.accessToken}`,
          "Content-Type": "application/json",
          "User-Agent": "Phandshop (contato@phand.com.br)"
        },
        cache: "no-store",
        signal: controller.signal
      }
    )

    if (!response.ok) {
      const body = await response.text()

      if (attempt < 2 && isTransientStatus(response.status)) {
        await new Promise((resolve) => setTimeout(resolve, 450))

        return fetchNuvemshopPage(
          credential,
          range,
          page,
          mode,
          attempt + 1
        )
      }

      throw new Error(
        `NUVEMSHOP_${response.status}:${body.slice(0, 180)}`
      )
    }

    const payload = await response.json()

    if (!Array.isArray(payload)) {
      throw new Error("NUVEMSHOP_FORMAT:lista inválida")
    }

    return payload
  } catch (error) {
    if (
      attempt < 2 &&
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      await new Promise((resolve) => setTimeout(resolve, 450))

      return fetchNuvemshopPage(
        credential,
        range,
        page,
        mode,
        attempt + 1
      )
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchPages(
  credential: Credential,
  range: ReportRange,
  mode: FetchMode
) {
  const orders: any[] = []
  const maxPages =
    mode === "filtered"
      ? MAX_FILTERED_PAGES
      : MAX_SIMPLE_PAGES

  for (let page = 1; page <= maxPages; page += 1) {
    const batch = await fetchNuvemshopPage(
      credential,
      range,
      page,
      mode
    )

    orders.push(...batch)

    if (batch.length < PAGE_SIZE) break

    if (mode === "simple") {
      const oldest = batch
        .map((order: any) => safeDateKey(
          order?.paid_at ||
          order?.created_at ||
          order?.updated_at
        ))
        .filter((value): value is string => Boolean(value))
        .sort()[0]

      if (oldest && oldest < addDays(range.from, -7)) break
    }
  }

  return orders
}

async function fetchNuvemshopOrders(
  credential: Credential,
  range: ReportRange
) {
  try {
    const filtered = await fetchPages(
      credential,
      range,
      "filtered"
    )

    if (filtered.length > 0) return filtered

    return fetchPages(credential, range, "simple")
  } catch (error) {
    const status = errorStatus(error)

    if ([400, 404, 405, 422].includes(status)) {
      return fetchPages(credential, range, "simple")
    }

    throw error
  }
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)

  if (message.includes("NUVEMSHOP_401")) {
    return "A conexão da Nuvemshop precisa ser renovada."
  }

  if (message.includes("NUVEMSHOP_403")) {
    return "A Nuvemshop recusou o acesso aos pedidos."
  }

  if (message.includes("NUVEMSHOP_429")) {
    return "A Nuvemshop limitou temporariamente as consultas."
  }

  if (
    message.includes("AbortError") ||
    message.includes("aborted")
  ) {
    return "A Nuvemshop demorou para responder."
  }

  return "Não foi possível consultar os pedidos da Nuvemshop."
}

async function fetchDirectOrders(
  supabase: SupabaseClient,
  range: ReportRange
) {
  const { data: storeRows, error: storesError } = await supabase
    .from("stores")
    .select("*")

  if (storesError) {
    throw new Error(`STORES:${storesError.message}`)
  }

  const groupedCredentials = collectCredentials(
    (storeRows || []) as StoreRow[]
  )

  if (groupedCredentials.size === 0) {
    throw new Error("STORES:Nenhuma credencial conectada foi encontrada.")
  }

  const orderMap = new Map<string, any>()
  const failures: string[] = []
  let successfulStores = 0

  for (const [storeId, credentials] of groupedCredentials) {
    let storeSucceeded = false

    for (const credential of credentials) {
      try {
        const orders = await fetchNuvemshopOrders(
          credential,
          range
        )

        for (const order of orders) {
          orderMap.set(`${storeId}:${order.id}`, order)
        }

        storeSucceeded = true
        successfulStores += 1
        break
      } catch (error) {
        console.error(
          `Financeiro: falha ao consultar a loja ${storeId}`,
          error
        )

        failures.push(safeErrorMessage(error))
      }
    }

    if (!storeSucceeded) {
      console.warn(
        `Financeiro: nenhuma credencial válida para a loja ${storeId}.`
      )
    }
  }

  if (successfulStores === 0) {
    throw new Error(
      failures[0] ||
      "Não foi possível consultar nenhuma loja conectada."
    )
  }

  return {
    orders: Array.from(orderMap.values()),
    successfulStores,
    failures
  }
}

function emptyMethod() {
  return {
    orders: 0,
    received: 0,
    fees: 0,
    refunds: 0,
    net: 0,
    details: {} as Record<string, {
      label: string
      orders: number
      received: number
    }>
  }
}

function emptyShippingMethod() {
  return {
    orders: 0,
    salesWithoutFreight: 0,
    charged: 0,
    paymentFees: 0,
    refunds: 0,
    net: 0,
    details: {} as Record<string, {
      label: string
      orders: number
      charged: number
    }>
  }
}

function addPaymentDetail(
  method: ReturnType<typeof emptyMethod>,
  label: string,
  received: number
) {
  const key = normalize(label) || "nao-identificado"
  const current = method.details[key] || {
    label: label || "Não identificado",
    orders: 0,
    received: 0
  }

  current.orders += 1
  current.received += received
  method.details[key] = current
}

function addShippingDetail(
  method: ReturnType<typeof emptyShippingMethod>,
  label: string,
  charged: number
) {
  const key = normalize(label) || "nao-informado"
  const current = method.details[key] || {
    label: label || "Não informado",
    orders: 0,
    charged: 0
  }

  current.orders += 1
  current.charged += charged
  method.details[key] = current
}

function detailArray<T extends { orders: number }>(
  value: Record<string, T>
) {
  return Object.values(value)
    .sort((a, b) => b.orders - a.orders)
}

function buildReport(
  orders: any[],
  range: ReportRange,
  source: OrderSource,
  warning?: string
) {
  const allMovements: any[] = []
  const statusSummary: Record<string, number> = {}

  for (const order of orders) {
    const statusKey =
      String(order.payment_status || "não informado")

    statusSummary[statusKey] =
      (statusSummary[statusKey] || 0) + 1

    const total = money(order.total)

    const knownFreight = money(
      order.shipping_cost_customer ??
      order.shipping_cost_owner ??
      order.shipping_cost
    )

    const subtotal = money(
      order.subtotal ||
      itemSubtotal(order) ||
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

    const freight = knownFreight > 0
      ? knownFreight
      : money(Math.max(0, total - productNet))

    const payment = paymentGroup(order)
    const shipping = shippingGroup(order)
    const currentPaymentLabel = paymentLabel(order, payment)
    const currentShippingLabel = shippingLabel(order, shipping)
    const paymentFee = paymentFeeFor(payment, total)
    const feeEstimated =
      payment === "pix" ||
      payment === "card"

    const products = arrayValue(order.products)

    const itemCount = products.reduce(
      (sum: number, item: any) => {
        return sum + Number(item?.quantity || 0)
      },
      0
    )

    const refund = refundValue(order)

    if (isPaid(order)) {
      allMovements.push({
        id: `${order.id}-sale`,
        date: order.paid_at || order.created_at,
        orderNumber: String(order.number || order.id || "—"),
        customer: customerName(order),
        type: "sale",
        paymentGroup: payment,
        paymentLabel: currentPaymentLabel,
        shippingGroup: shipping,
        shippingLabel: currentShippingLabel,
        itemCount,
        productGross: subtotal,
        discount,
        productNet,
        freight,
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
        paymentLabel: currentPaymentLabel,
        shippingGroup: shipping,
        shippingLabel: currentShippingLabel,
        itemCount: 0,
        productGross: 0,
        discount: 0,
        productNet: 0,
        freight: 0,
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
    totalReceived: 0,
    paymentFees: 0,
    refunds: 0,
    net: 0,
    ticketWithoutFreight: 0,
    estimatedFeeOrders: 0
  }

  const methods = {
    pix: emptyMethod(),
    card: emptyMethod(),
    cash: emptyMethod(),
    other: emptyMethod()
  }

  const shipping = {
    bus: emptyShippingMethod(),
    postal: emptyShippingMethod(),
    motoboy: emptyShippingMethod(),
    pickup: emptyShippingMethod(),
    unknown: emptyShippingMethod()
  }

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
      methods[movement.paymentGroup as PaymentGroup] ||
      methods.other

    const shipment =
      shipping[movement.shippingGroup as ShippingGroup] ||
      shipping.unknown

    if (movement.type === "sale") {
      metrics.orders += 1
      metrics.items += movement.itemCount
      metrics.productGross += movement.productGross
      metrics.discounts += movement.discount
      metrics.salesWithoutFreight += movement.productNet
      metrics.freight += movement.freight
      metrics.totalReceived += movement.totalReceived
      metrics.paymentFees += movement.paymentFee

      if (movement.feeEstimated) {
        metrics.estimatedFeeOrders += 1
      }

      method.orders += 1
      method.received += movement.totalReceived
      method.fees += movement.paymentFee

      addPaymentDetail(
        method,
        movement.paymentLabel,
        movement.totalReceived
      )

      shipment.orders += 1
      shipment.salesWithoutFreight += movement.productNet
      shipment.charged += movement.freight
      shipment.paymentFees += movement.paymentFee
      shipment.net += movement.net

      addShippingDetail(
        shipment,
        movement.shippingLabel,
        movement.freight
      )

      day.sales += movement.totalReceived
      day.fees += movement.paymentFee
    } else {
      metrics.refunds += movement.refund
      method.refunds += movement.refund
      shipment.refunds += movement.refund
      shipment.net -= movement.refund
      day.refunds += movement.refund
    }

    metrics.net += movement.net
    method.net += movement.net
    day.net += movement.net
    chartMap.set(key, day)
  }

  metrics.ticketWithoutFreight = metrics.orders
    ? money(metrics.salesWithoutFreight / metrics.orders)
    : 0

  for (const key of Object.keys(metrics)) {
    if (typeof metrics[key] === "number") {
      metrics[key] = money(metrics[key])
    }
  }

  for (const method of Object.values(methods)) {
    method.received = money(method.received)
    method.fees = money(method.fees)
    method.refunds = money(method.refunds)
    method.net = money(method.net)

    for (const detail of Object.values(method.details)) {
      detail.received = money(detail.received)
    }
  }

  for (const shipment of Object.values(shipping)) {
    shipment.salesWithoutFreight =
      money(shipment.salesWithoutFreight)

    shipment.charged = money(shipment.charged)
    shipment.paymentFees = money(shipment.paymentFees)
    shipment.refunds = money(shipment.refunds)
    shipment.net = money(shipment.net)

    for (const detail of Object.values(shipment.details)) {
      detail.charged = money(detail.charged)
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    source,
    warning: warning || null,
    range: {
      key: range.key,
      label: `${range.from} a ${range.to}`,
      from: range.from,
      to: range.to
    },
    metrics,
    methods: {
      pix: {
        ...methods.pix,
        details: detailArray(methods.pix.details)
      },
      card: {
        ...methods.card,
        details: detailArray(methods.card.details)
      },
      cash: {
        ...methods.cash,
        details: detailArray(methods.cash.details)
      },
      other: {
        ...methods.other,
        details: detailArray(methods.other.details)
      }
    },
    shipping: {
      bus: {
        ...shipping.bus,
        details: detailArray(shipping.bus.details)
      },
      postal: {
        ...shipping.postal,
        details: detailArray(shipping.postal.details)
      },
      motoboy: {
        ...shipping.motoboy,
        details: detailArray(shipping.motoboy.details)
      },
      pickup: {
        ...shipping.pickup,
        details: detailArray(shipping.pickup.details)
      },
      unknown: {
        ...shipping.unknown,
        details: detailArray(shipping.unknown.details)
      }
    },
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
    },
    diagnostics: {
      ordersLoaded: orders.length,
      movementsLoaded: movements.length,
      paymentStatuses: statusSummary
    }
  }
}

async function generateReport(
  supabase: SupabaseClient,
  range: ReportRange
) {
  let directError: unknown = null

  try {
    const direct = await fetchDirectOrders(supabase, range)
    const directReport = buildReport(
      direct.orders,
      range,
      "nuvemshop"
    )

    if (
      directReport.metrics.orders > 0 ||
      directReport.metrics.refunds > 0
    ) {
      return directReport
    }

    try {
      const localOrders = await fetchLocalOrders(supabase)
      const localReport = buildReport(
        localOrders,
        range,
        "database",
        "A Nuvemshop respondeu sem movimentações pagas neste período. O sistema conferiu também o histórico sincronizado."
      )

      if (
        localReport.metrics.orders > 0 ||
        localReport.metrics.refunds > 0
      ) {
        return localReport
      }
    } catch (localError) {
      console.error(
        "Financeiro: conferência local falhou",
        localError
      )
    }

    return directReport
  } catch (error) {
    directError = error

    console.error(
      "Financeiro: consulta direta falhou; usando histórico local",
      error
    )
  }

  try {
    const localOrders = await fetchLocalOrders(supabase)
    const localReport = buildReport(
      localOrders,
      range,
      "database",
      "A Nuvemshop não respondeu. Os valores vieram dos pedidos já sincronizados no sistema."
    )

    if (
      localReport.metrics.orders === 0 &&
      localReport.metrics.refunds === 0 &&
      localOrders.length === 0
    ) {
      throw new Error(
        "O histórico local também está vazio."
      )
    }

    return localReport
  } catch (localError) {
    console.error(
      "Financeiro: histórico local também falhou",
      localError
    )

    const directMessage =
      directError instanceof Error
        ? directError.message
        : String(directError || "")

    if (directMessage.startsWith("STORES:")) {
      throw new Error(
        "Não foi encontrada uma conexão válida com a Nuvemshop."
      )
    }

    throw new Error(
      safeErrorMessage(directError)
    )
  }
}

export async function GET(request: Request) {
  try {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL

    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return Response.json(
        {
          error:
            "A configuração do financeiro está incompleta."
        },
        { status: 500 }
      )
    }

    const url = new URL(request.url)
    const range = getRange(url)
    const forceRefresh =
      url.searchParams.get("refresh") === "1"

    const key = reportCacheKey(range)
    const cached = reportCache.get(key)

    if (
      !forceRefresh &&
      cached &&
      cached.expiresAt > Date.now()
    ) {
      return Response.json(cached.value, {
        headers: {
          "Cache-Control":
            "private, max-age=20, stale-while-revalidate=60"
        }
      })
    }

    if (!forceRefresh) {
      const pending = pendingReports.get(key)

      if (pending) {
        const report = await pending
        return Response.json(report)
      }
    }

    const supabase = createClient(
      supabaseUrl,
      serviceKey
    )

    const task = generateReport(supabase, range)
      .then((report) => {
        reportCache.set(key, {
          value: report,
          expiresAt: Date.now() + REPORT_CACHE_MS
        })

        return report
      })
      .finally(() => {
        pendingReports.delete(key)
      })

    pendingReports.set(key, task)

    const report = await task

    return Response.json(report, {
      headers: {
        "Cache-Control": forceRefresh
          ? "private, no-store"
          : "private, max-age=20, stale-while-revalidate=60"
      }
    })
  } catch (error) {
    console.error(
      "Erro relatório financeiro:",
      error
    )

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o financeiro."
      },
      { status: 502 }
    )
  }
}
