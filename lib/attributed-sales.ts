export type SalesLink = { storeId: string; orderId: string }
export type VerifiedSales = {
  confirmed: number; grossCents: number; productsCents: number
  checked: number; unresolved: number; recordedLinks: number
  checkedAt: string; nextCursor: string | null; remaining: number; coverage: "recorded_links_only"
}

export function numericId(value: unknown): string | null {
  if (typeof value === "number" && !Number.isSafeInteger(value)) return null
  const id = String(value ?? "")
  return /^[1-9]\d{0,19}$/.test(id) ? id : null
}

export function uniqueSalesLinks(links: SalesLink[]): SalesLink[] {
  const unique = new Map<string, SalesLink>()
  for (const link of links) {
    const id = numericId(link.orderId)
    if (link.storeId && id) unique.set(`${link.storeId}:${id}`, { ...link, orderId: id })
  }
  return [...unique.values()]
}

function cents(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null
  const s = String(value)
  if (!/^\d+(?:\.\d{1,2})?$/.test(s)) return null
  const n = Math.round(Number(s) * 100)
  return Number.isSafeInteger(n) ? n : null
}

// The caller must fetch this exact ID from the connected store's official API.
// Never attribute by phone, customer name, chat text, or storefront alone.
export function paidOrderValue(order: Record<string, unknown> | null, expectedId: string, expectedStoreId: string) {
  if (!order || numericId(order.id) !== expectedId || numericId(order.store_id) !== expectedStoreId) {
    throw new Error("order_identity_mismatch")
  }
  if (order.payment_status !== "paid" || order.status === "cancelled" || order.cancelled_at) return null
  if (order.currency !== "BRL") throw new Error("unsupported_currency")
  const gross = cents(order.total)
  const freight = cents(order.shipping_cost_customer)
  if (gross === null || freight === null || freight > gross) throw new Error("invalid_order_amount")
  return { grossCents: gross, productsCents: gross - freight }
}

// Legacy rows omit store_id. Only one connected store can resolve that case;
// the official response still has to prove the same numeric store identity.
export function resolveLinkStore(storeId: unknown, storeIds: string[]): string | null {
  if (typeof storeId === "string" && storeIds.includes(storeId)) return storeId
  if ((storeId === null || storeId === undefined) && storeIds.length === 1) return storeIds[0]
  return null
}

export function salesLinkKey(link: SalesLink) { return `${link.storeId}:${link.orderId}` }
export function salesLinkPage(links: SalesLink[], cursor: string, size = 100) {
  const sorted = uniqueSalesLinks(links).sort((a,b) => salesLinkKey(a).localeCompare(salesLinkKey(b), "en"))
  const rest = cursor ? sorted.filter(link => salesLinkKey(link).localeCompare(cursor, "en") > 0) : sorted
  const selected = rest.slice(0, size)
  const remaining = rest.length - selected.length
  return { selected, remaining, nextCursor: remaining > 0 ? salesLinkKey(selected[selected.length - 1]) : null }
}
