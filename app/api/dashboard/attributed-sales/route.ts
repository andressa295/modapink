import { createClient } from "@supabase/supabase-js"
import { requireDashboardAdmin } from "@/lib/dashboard-auth"
import { numericId, salesLinkPage, resolveLinkStore, paidOrderValue, uniqueSalesLinks, type SalesLink, type VerifiedSales } from "@/lib/attributed-sales"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60
const headers = { "Cache-Control": "private, no-store" }

const cache = new Map<string, { at: number; result: VerifiedSales }>()
const inFlight = new Map<string, Promise<VerifiedSales>>()
const nextRequestAt = new Map<string, number>()

async function verifySales(cursor: string): Promise<VerifiedSales> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error("configuration_unavailable")
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    const storesResult = await db.from("stores").select("id,user_id,access_token")
    if (storesResult.error) throw new Error("stores_unavailable")
    const stores = new Map<string, { id: string; user_id: string; access_token: string }>()
    for (const store of storesResult.data || []) {
      const id = numericId(store.user_id)
      if (id && store.access_token) stores.set(store.id, { ...store, user_id: id })
    }
    if (!stores.size) throw new Error("store_unavailable")
    const links: SalesLink[] = []
    const unscoped = new Set<string>()
    const storeIds = [...stores.keys()]
    // These records are historical evidence of a generated link, NOT payment proof.
    for (let offset = 0; ; offset += 500) {
      if (offset >= 10000) throw new Error("record_scan_incomplete")
      const r = await db.from("conversations").select("id,store_id,checkout")
        .not("checkout->data->>id", "is", null).order("id").range(offset, offset + 499)
      if (r.error) throw new Error("checkout_records_unavailable")
      for (const row of r.data || []) {
        const orderId = numericId(row.checkout?.data?.id)
        if (orderId && row.checkout?.status === "generated") {
          const storeId = resolveLinkStore(row.store_id, storeIds)
          if (storeId) links.push({ storeId, orderId })
          else unscoped.add(orderId)
        }
      }
      if (!r.data || r.data.length < 500) break
    }
    for (let offset = 0; ; offset += 500) {
      if (offset >= 10000) throw new Error("record_scan_incomplete")
      const r = await db.from("events").select("id,type,conversation_id,payload")
        .in("type", ["catalog_checkout_created", "whatsapp_checkout_created"])
        .order("id").range(offset, offset + 499)
      if (r.error) throw new Error("catalog_records_unavailable")
      const ids = [...new Set((r.data || []).map(row => row.conversation_id).filter((id): id is string => typeof id === "string"))]
      const cr = ids.length ? await db.from("conversations").select("id,store_id").in("id", ids) : { data: [], error: null }
      if (cr.error) throw new Error("attribution_unavailable")
      const mapping = new Map((cr.data || []).map(row => [row.id, row.store_id]))
      for (const row of r.data || []) {
        const orderId = numericId(row.payload?.draft_order_id)
        if (!orderId) continue
        // Old public catalog events without a conversation do not prove attendance origin.
        if (row.type !== "whatsapp_checkout_created" && !row.conversation_id) continue
        const storeId = resolveLinkStore(row.payload?.store_id ?? mapping.get(row.conversation_id), storeIds)
        if (storeId) links.push({ storeId, orderId })
        else unscoped.add(orderId)
      }
      if (!r.data || r.data.length < 500) break
    }
    const candidates = uniqueSalesLinks(links)
    // Bound API load, and make any incomplete verification explicit rather than zero.
    const { selected, remaining, nextCursor } = salesLinkPage(candidates, cursor, 50)
    const result: VerifiedSales = { confirmed: 0, grossCents: 0, productsCents: 0, checked: 0,
      unresolved: cursor ? 0 : unscoped.size, recordedLinks: candidates.length + unscoped.size,
      remaining, nextCursor,
      checkedAt: new Date().toISOString(), coverage: "recorded_links_only" }
    const deadline = Date.now() + 40000
    let index = 0
    let stop = false
    async function worker() {
      while (index < selected.length) {
        const link = selected[index++]
        if (stop || Date.now() >= deadline) { result.unresolved++; continue }
        const store = stores.get(link.storeId)!
        try {
          const wait = Math.max(0, (nextRequestAt.get(store.user_id) || 0) - Date.now())
          if (Date.now() + wait >= deadline) { result.unresolved++; continue }
          nextRequestAt.set(store.user_id, Date.now() + wait + 750)
          if (wait) await new Promise(resolve => setTimeout(resolve, wait))
          const response = await fetch(`https://api.nuvemshop.com.br/v1/${store.user_id}/orders/${link.orderId}`, {
            method: "GET", redirect: "error", cache: "no-store",
            headers: { Authentication: `bearer ${store.access_token}`, "User-Agent": "Phandshop (contato@phand.com.br)" },
            signal: AbortSignal.timeout(Math.min(8000, Math.max(1, deadline - Date.now())))
          })
          if (response.status === 404) { result.checked++; continue }
          if (response.status === 429) {
            const seconds = Number(response.headers.get("retry-after"))
            nextRequestAt.set(store.user_id, Date.now() + (Number.isFinite(seconds) && seconds > 0 ? Math.max(5000, Math.min(60000, seconds * 1000)) : 60000))
          }
          if (response.status === 429 || response.status === 401 || response.status === 403) stop = true
          if (!response.ok) throw new Error("order_check_unavailable")
          const value = paidOrderValue(await response.json(), link.orderId, store.user_id)
          result.checked++
          if (value) { result.confirmed++; result.grossCents += value.grossCents; result.productsCents += value.productsCents }
        } catch { result.unresolved++ }
      }
    }
    await worker()
    result.checkedAt = new Date().toISOString()
    return result
}

export async function GET(req: Request) {
  const denied = await requireDashboardAdmin()
  if (denied) return denied
  try {
    const cursor = req ? new URL(req.url).searchParams.get("cursor") || "" : ""
    if (cursor && !/^[a-zA-Z0-9-]{1,80}:[1-9]\d{0,19}$/.test(cursor)) {
      return Response.json({ error: "Cursor inválido." }, { status: 400, headers })
    }
    const cached = cache.get(cursor)
    if (cached && Date.now() - cached.at < 60000) return Response.json(cached.result, { headers })
    if (!inFlight.has(cursor)) inFlight.set(cursor, verifySales(cursor).finally(() => { inFlight.delete(cursor) }))
    const result = await inFlight.get(cursor)!
    if (cache.size >= 32) cache.delete(cache.keys().next().value!)
    cache.set(cursor, { at: Date.now(), result })
    return Response.json(result, { headers })
  } catch {
    // Never expose credentials, raw orders, customer data, or upstream response bodies.
    return Response.json({ error: "Não foi possível conferir as vendas na Nuvemshop." }, { status: 503, headers })
  }
}
