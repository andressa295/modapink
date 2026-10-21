import { requireDashboardAdmin } from "@/lib/dashboard-auth"
import { getWhatsAppApiBaseUrl, getWhatsAppInternalKey } from "@/lib/whatsapp-proxy.server"
import { parseCartRecoverySummary } from "@/lib/cart-recovery-summary"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60
const headers = { "Cache-Control": "private, no-store, max-age=0" }

export async function GET() {
  const denied = await requireDashboardAdmin()
  if (denied) return denied
  try {
    const key = getWhatsAppInternalKey()
    // Financial reconciliation is always private, including loopback installations.
    if (!key) throw new Error("configuration_unavailable")
    const target = new URL(`${getWhatsAppApiBaseUrl()}/api/admin/cart-recovery/reconcile`)
    const response = await fetch(target, {
      method: "GET", cache: "no-store", redirect: "error",
      headers: { Accept: "application/json", "x-internal-api-key": key },
      signal: AbortSignal.timeout(50000)
    })
    if (!response.ok) throw new Error("verification_unavailable")
    // This route accepts only a small aggregate, never a raw customer/order payload.
    if (Number(response.headers.get("content-length")) > 32768 || !response.body) throw new Error("invalid_summary")
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let bytes = 0
    let text = ""
    try {
      for (;;) {
        const part = await reader.read()
        if (part.done) break
        bytes += part.value.byteLength
        if (bytes > 32768) { await reader.cancel(); throw new Error("invalid_summary") }
        text += decoder.decode(part.value, { stream: true })
      }
      text += decoder.decode()
    } finally { reader.releaseLock() }
    return Response.json(parseCartRecoverySummary(JSON.parse(text)), { headers })
  } catch {
    // No upstream body, URL, token, order identifier or customer data in errors/logs.
    return Response.json({ error: "Não foi possível conferir a recuperação na Nuvemshop." }, { status: 503, headers })
  }
}
