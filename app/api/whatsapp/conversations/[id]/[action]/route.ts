import { type NextRequest } from "next/server"
import { getDashboardAccess } from "@/lib/dashboard-auth"
import { canAccessDashboard } from "@/lib/dashboard-access"
import { createClient } from "@/lib/supabase/server"
import {
  forwardWhatsAppRequest,
  getWhatsAppApiBaseUrl,
  getWhatsAppInternalKey,
  readLimitedWhatsAppBody,
  rejectCrossOriginWhatsAppMutation,
  whatsAppConfigError,
  whatsAppProxyError
} from "@/lib/whatsapp-proxy.server"

export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ACTIONS = new Set(["request-human", "resume-bot", "resolve-human", "send-review"])
const BODY_FIELDS = new Set(["requested_by", "requestedBy", "resolved_by", "resolvedBy", "reason"])

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string, action: string }> }
) {
  const supabase = await createClient().catch(() => null)
  if (!supabase) return whatsAppProxyError("Não foi possível validar o acesso ao atendimento.", 503)
  const access = await getDashboardAccess(supabase)
  if (!access.user) return whatsAppProxyError("Sessão expirada.", 401)
  // Chat is available to admin, agent and user. Never apply the admin-only
  // sessions gate here, and never trust a client-supplied role or token claim.
  if (!canAccessDashboard(access.role, "/dashboard/conversas")) {
    return whatsAppProxyError("Acesso ao atendimento não permitido.", 403)
  }

  const { id, action } = await context.params
  if (!UUID.test(id) || !ACTIONS.has(action)) {
    return whatsAppProxyError("Operação de atendimento não permitida.", 404)
  }
  const deniedOrigin = rejectCrossOriginWhatsAppMutation(request)
  if (deniedOrigin) return deniedOrigin

  // This is the authenticated user's client, not the service-role client.
  // Respect the same conversation RLS visibility as the existing chat list
  // before forwarding a server credential to the API's privileged handler.
  try {
    const { data, error } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", id)
      .maybeSingle()
    if (error) return whatsAppProxyError("Não foi possível validar o atendimento.", 503)
    if (!data) return whatsAppProxyError("Atendimento não encontrado ou sem acesso.", 404)
  } catch {
    return whatsAppProxyError("Não foi possível validar o atendimento.", 503)
  }

  let target: URL
  let headers: Headers
  try {
    target = new URL(`${getWhatsAppApiBaseUrl()}/conversations/${id}/${action}`)
    const key = getWhatsAppInternalKey()
    headers = new Headers({ Accept: "application/json", "Content-Type": "application/json" })
    if (key) headers.set("x-internal-api-key", key)
  } catch {
    return whatsAppConfigError()
  }

  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return whatsAppProxyError("Envie a operação em formato JSON.", 415)
  }
  const input = await readLimitedWhatsAppBody(request, 4096)
  if (typeof input !== "string") return input
  let body: string
  try {
    const payload: unknown = input === "" && action === "send-review" ? {} : JSON.parse(input)
    if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
        Object.entries(payload).some(([key, value]) =>
          !BODY_FIELDS.has(key) || typeof value !== "string" || value.length > 200)) {
      return whatsAppProxyError("Operação de atendimento inválida.", 400)
    }
    body = JSON.stringify(payload)
  } catch {
    return whatsAppProxyError("Operação de atendimento inválida.", 400)
  }

  // Resolving SAC can send its review. Never retry an uncertain mutation.
  return forwardWhatsAppRequest(target, { method: "POST", headers, body }, 60000)
}
