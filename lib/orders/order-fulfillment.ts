// Nuvemshop's aggregated fulfillments are the shipping source of truth.
// A tracking label/code is not evidence that the parcel was dispatched.
export type OrderDeliveryMode = "correios" | "transportadora" | "excursao" | "retirada" | "motoboy" | "peq" | "envio"
export type OrderShippingStage = "pending" | "paid" | "preparing" | "packed" | "partially_packed" | "ready_for_pickup" | "partially_ready_for_pickup" | "shipped" | "partially_shipped" | "in_transit" | "out_for_delivery" | "delivered" | "delivery_attempt_failed" | "delayed" | "returned_to_sender" | "lost" | "failure" | "cancelled"

export function normalizeOrderValue(value: any): string {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\/_-]+/g, " ").replace(/\s+/g, " ").trim()
}

function scalar(value: any): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null
  const result = String(value).trim()
  return result && !["null", "undefined"].includes(result.toLowerCase()) ? result : null
}

export function getOrderFulfillments(order: any): any[] {
  const seen = new Set<string>()
  return [order?.fulfillments, order?.fulfillment_orders, order?.shipments, order?.shipping_fulfillments, order?.shipping?.fulfillments]
    .flatMap(list => Array.isArray(list) ? list : [])
    // Without aggregates the API returns ULID strings, not status objects.
    .filter(value => value && typeof value === "object")
    .filter(value => {
      const id = scalar(value.id || value.fulfillment_id || value.fulfillment_order_id)
      if (!id) return true
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })
}

function latest(values: any[]): any {
  return [...values].sort((a, b) => {
    const time = (value: any) => Date.parse(value?.happened_at || value?.updated_at || value?.created_at || "") || 0
    return time(b) - time(a)
  })[0]
}

function statusStage(value: any): OrderShippingStage | null {
  const statuses: Record<string, OrderShippingStage> = {
    unpacked: "pending", unfulfilled: "pending", unshipped: "pending", pending: "pending", "in preparation": "preparing", preparing: "preparing", packing: "preparing", "em separacao": "preparing", "em preparacao": "preparing",
    packed: "packed", embalado: "packed", separado: "packed", "ready to ship": "packed", "ready to send": "packed", "ready for sending": "packed",
    "partially packed": "partially_packed", "partially ready for pickup": "partially_ready_for_pickup", "ready for pickup": "ready_for_pickup", "ready to pick": "ready_for_pickup", "disponivel para retirada": "ready_for_pickup",
    fulfilled: "shipped", dispatched: "shipped", shipped: "shipped", sent: "shipped", enviado: "shipped", despachado: "shipped",
    "received by post office": "in_transit", "in transit": "in_transit", "em transito": "in_transit", "out for delivery": "out_for_delivery",
    delivered: "delivered", entregue: "delivered", "picked up": "delivered", retirado: "delivered",
    "partially fulfilled": "partially_shipped", "partially shipped": "partially_shipped",
    "delivery attempt failed": "delivery_attempt_failed", delayed: "delayed", "returned to sender": "returned_to_sender", lost: "lost", failure: "failure",
    cancelled: "cancelled", canceled: "cancelled"
  }
  return statuses[normalizeOrderValue(value)] || null
}

function fulfillmentStage(fulfillment: any): OrderShippingStage | null {
  const macro = statusStage(fulfillment?.status || fulfillment?.current_status || fulfillment?.fulfillment_status || fulfillment?.shipping_status)
  // Delivered is terminal even if a carrier later adds an informational event.
  if (macro === "delivered") return macro
  const tracking = latest(Array.isArray(fulfillment?.tracking_events) ? fulfillment.tracking_events : [])
  const trackedStage = statusStage(tracking?.status)
  if (trackedStage) return trackedStage
  if (macro) return macro
  const history = latest(Array.isArray(fulfillment?.status_history) ? fulfillment.status_history : [])
  return statusStage(history?.to_status)
}

export function extractOrderTrackingNumber(order: any, fulfillment?: any): string | null {
  const fulfillments = fulfillment ? [fulfillment] : getOrderFulfillments(order)
  const candidates = fulfillments.flatMap(value => [value?.tracking_info?.code, value?.tracking_info?.number, value?.tracking?.code, value?.tracking?.number,
    value?.tracking_number, value?.tracking_code, value?.shipping?.tracking_number, value?.shipping?.tracking_code, value?.shipping?.tracking_info?.code,
    value?.shipment?.tracking_number, value?.shipment?.tracking_code])
  return candidates.concat([order?.shipping_tracking_number, order?.tracking_number, order?.shipping?.tracking_number]).map(scalar).find(Boolean) || null
}

export function extractOrderTrackingUrl(order: any, fulfillment?: any): string | null {
  const fulfillments = fulfillment ? [fulfillment] : getOrderFulfillments(order)
  const candidates = fulfillments.flatMap(value => [value?.tracking_info?.url, value?.tracking?.url, value?.tracking_url, value?.shipping?.tracking_url,
    value?.shipping?.tracking?.url, value?.shipping?.tracking_info?.url, value?.shipment?.tracking_url])
  for (const candidate of candidates.concat([order?.shipping_tracking_url, order?.tracking_url, order?.shipping?.tracking_url])) {
    const text = scalar(candidate)
    if (!text) continue
    try { const url = new URL(text); if (["http:", "https:"].includes(url.protocol)) return url.toString() } catch {}
  }
  return null
}

export function isCorreiosTrackingNumber(value: any): boolean {
  return /^[a-z]{2}\d{9}br$/i.test(String(value || "").replace(/\s+/g, ""))
}

function shippingTerms(order: any, fulfillment?: any): string {
  const fulfillments = fulfillment ? [fulfillment] : getOrderFulfillments(order)
  // Notes, addresses and internal JSON metadata never identify a shipping mode.
  return normalizeOrderValue([
    ...fulfillments.flatMap(value => [value?.shipping?.carrier?.name, value?.shipping?.carrier?.code, value?.shipping?.carrier_name,
      value?.shipping?.option?.name, value?.shipping?.option?.code, value?.shipping?.option_name, value?.shipping?.option_code,
      value?.shipping_method, value?.shipping_option, value?.shipping_option_reference, value?.carrier_name, typeof value?.carrier === "string" ? value.carrier : null]),
    order?.shipping_carrier_name, order?.shipping_option, order?.shipping_option_code, order?.shipping_option_reference, order?.shipping_method,
    order?.shipping_address?.shipping_method, order?.shipping_address?.method
  ].filter(value => scalar(value)).join(" "))
}

export function detectOrderDeliveryMode(order: any, fulfillment?: any): OrderDeliveryMode {
  const text = ` ${shippingTerms(order, fulfillment)} `
  const word = (expression: string) => new RegExp(`(^|[^a-z0-9])(?:${expression})(?=$|[^a-z0-9])`).test(text)
  // J3 is Moda Pink's local motoboy method, not an excursion bus.
  if (word("j3|j 3|motoboy|moto boy|motofrete|moto frete|entrega local|entrega por moto")) return "motoboy"
  if (word("correios|sedex|pac|mini envios")) return "correios"
  if (word("peq|p e q")) return "peq"
  if (word("transportadora|jadlog|loggi|azul cargo|latam cargo|total express|buslog")) return "transportadora"
  if (word("excursao|excursion|onibus|bate volta|fretamento")) return "excursao"
  const primary = fulfillment || getOrderFulfillments(order)[0]
  const type = normalizeOrderValue(primary?.shipping?.type || primary?.shipping_type || order?.shipping_pickup_type)
  if (type === "pickup" || word("retirada|retirar|pickup")) return "retirada"
  if (isCorreiosTrackingNumber(extractOrderTrackingNumber(order, fulfillment))) return "correios"
  return "envio"
}

export function resolveOrderTrackingUrl(order: any, fulfillment?: any): string | null {
  const actual = extractOrderTrackingUrl(order, fulfillment)
  if (actual) return actual
  const code = extractOrderTrackingNumber(order, fulfillment)
  // A transportadora/motoboy number is never turned into a Correios URL.
  if (detectOrderDeliveryMode(order, fulfillment) === "correios" && isCorreiosTrackingNumber(code)) {
    return `https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(String(code).replace(/\s+/g, "").toUpperCase())}`
  }
  return null
}

export function resolveOrderShippingStage(order: any, fulfillment?: any): OrderShippingStage {
  if (normalizeOrderValue(order?.raw_status || order?.status) === "cancelled" || order?.cancelled_at) return "cancelled"
  const fulfillments = fulfillment ? [fulfillment] : getOrderFulfillments(order)
  const stages = fulfillments.map(fulfillmentStage).filter(Boolean) as OrderShippingStage[]
  if (stages.length) {
    if (stages.every(stage => stage === "delivered") && stages.length === fulfillments.length) return "delivered"
    const sent = ["shipped", "in_transit", "out_for_delivery", "delivered", "delivery_attempt_failed", "delayed", "returned_to_sender", "lost", "failure"]
    if (stages.some(stage => sent.includes(stage)) && (stages.length < fulfillments.length || stages.some(stage => !sent.includes(stage)))) return "partially_shipped"
    // Preserve a carrier exception instead of saying the parcel is delivered.
    const issue = stages.find(stage => ["delivery_attempt_failed", "delayed", "returned_to_sender", "lost", "failure"].includes(stage))
    if (issue) return issue
    if (stages.every(stage => stage === "delivered" || stage === "out_for_delivery")) return "out_for_delivery"
    if (stages.every(stage => ["delivered", "out_for_delivery", "in_transit"].includes(stage))) return "in_transit"
    if (stages.every(stage => sent.includes(stage))) return "shipped"
    if (stages.length === fulfillments.length && stages.every(stage => stage === "ready_for_pickup")) return "ready_for_pickup"
    if (stages.includes("ready_for_pickup")) return "partially_ready_for_pickup"
    if (stages.length === fulfillments.length && stages.every(stage => stage === "packed")) return "packed"
    if (stages.includes("packed") || stages.includes("partially_packed")) return "partially_packed"
    if (stages.includes("preparing")) return "preparing"
    return stages[0] === "pending" && normalizeOrderValue(order?.raw_payment_status || order?.payment_status) === "paid" ? "paid" : stages[0]
  }
  const legacyEvents = latest(Array.isArray(order?.fulfillment_events) ? order.fulfillment_events : [])
  const legacy = statusStage(legacyEvents?.status) || statusStage(order?.raw_shipping_status || order?.shipping_status || order?.fulfillment_status)
  if (legacy && legacy !== "pending") return legacy
  if (order?.shipped_at && Number.isFinite(Date.parse(order.shipped_at))) return "shipped"
  if (legacy === "pending" && normalizeOrderValue(order?.raw_payment_status || order?.payment_status) === "paid") return "paid"
  if (normalizeOrderValue(order?.raw_payment_status || order?.payment_status) === "paid") return "paid"
  return "pending"
}

export function getOrderShippingLabel(stage: OrderShippingStage, mode: OrderDeliveryMode, trackingCode?: string | null): string {
  const labels: Record<OrderShippingStage, string> = {
    pending: "Aguardando pagamento", paid: "Pagamento aprovado, aguardando separação", preparing: "Pedido em separação",
    packed: "Pedido embalado, aguardando envio", partially_packed: "Pedido parcialmente embalado", ready_for_pickup: "Disponível para retirada", partially_ready_for_pickup: "Parte do pedido disponível para retirada",
    shipped: "Pedido enviado", partially_shipped: "Pedido parcialmente enviado", in_transit: "Pedido em transporte", out_for_delivery: "Pedido saiu para entrega",
    delivered: "Pedido entregue", delivery_attempt_failed: "Tentativa de entrega não concluída", delayed: "Entrega com atraso informado pela transportadora",
    returned_to_sender: "Pedido devolvido ao remetente", lost: "Extravio informado pela transportadora", failure: "Problema na entrega informado pela transportadora", cancelled: "Pedido cancelado"
  }
  if (mode === "retirada") {
    if (stage === "delivered") return "Pedido retirado"
    if (stage === "packed") return "Pedido embalado, aguardando liberação para retirada"
    // A pickup shipment may still be travelling to a collection point.
    if (stage === "shipped") return "Pedido enviado ao ponto de retirada"
  }
  if (stage === "shipped" && mode === "excursao") return "Enviado por excursão/ônibus"
  if (["shipped", "out_for_delivery"].includes(stage) && mode === "motoboy") return "Pedido saiu para entrega por motoboy"
  const label = labels[stage]
  if (trackingCode && ["pending", "paid", "preparing", "packed"].includes(stage)) return `${label}; rastreio cadastrado, envio ainda não confirmado`
  return label
}

export function getOrderShippingTruth(order: any, fulfillment?: any) {
  const mode = detectOrderDeliveryMode(order, fulfillment)
  const stage = resolveOrderShippingStage(order, fulfillment)
  const trackingNumber = extractOrderTrackingNumber(order, fulfillment)
  return { mode, stage, tracking_number: trackingNumber, tracking_url: resolveOrderTrackingUrl(order, fulfillment), label: getOrderShippingLabel(stage, mode, trackingNumber) }
}

export function formatOrderPickupAddress(order: any, fulfillment?: any): string | null {
  const current = fulfillment || getOrderFulfillments(order)[0]
  const details = current?.shipping?.pickup_details || order?.shipping_pickup_details
  const address = details?.address
  if (typeof address === "string" && address.trim()) return address.trim()
  const source = address && typeof address === "object" ? address : details
  if (!source || typeof source !== "object") return null
  const street = scalar(source.street || source.address)
  if (!street) return null
  return [street, scalar(source.number), scalar(source.floor), scalar(source.locality), scalar(source.city), scalar(source.province?.name || source.province), scalar(source.zipcode)].filter(Boolean).join(", ")
}
