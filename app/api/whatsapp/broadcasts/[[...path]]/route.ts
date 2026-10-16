import { NextRequest } from "next/server"
import {
  forwardWhatsAppRequest,
  getWhatsAppApiBaseUrl,
  readLimitedWhatsAppBody,
  whatsAppConfigError,
  whatsAppProxyError
} from "@/lib/whatsapp-proxy.server"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ path?: string[] }> }
type Method = "GET" | "POST" | "PATCH" | "DELETE"
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"

function isAllowedRequest(method: Method, path: string) {
  if (method === "GET") {
    return ["", "sessions", "contacts/count", "contact-lists"].includes(path) ||
      new RegExp(`^${UUID}$`, "i").test(path)
  }
  if (method === "POST") {
    return path === "" || path === "contact-lists/import" ||
      new RegExp(`^${UUID}/(?:start|pause|resume|cancel)$`, "i").test(path)
  }
  return new RegExp(`^contact-lists/${UUID}$`, "i").test(path)
}

async function proxyBroadcastRequest(request: NextRequest, context: RouteContext, method: Method) {
  // Cookies alone must never authorize a campaign action. The API verifies this
  // exact user token and its admin role. Do NOT add x-internal-api-key: the API
  // treats that key as an admin bypass, discarding user identity/audit context.
  const authorization = request.headers.get("authorization") || ""
  if (!/^Bearer [A-Za-z0-9._~+/-]+=*$/i.test(authorization)) {
    return whatsAppProxyError("Sua sessão expirou. Faça login novamente.", 401)
  }

  const { path: segments = [] } = await context.params
  if (segments.some(segment => !segment || /[^a-z0-9-]/i.test(segment))) {
    return whatsAppProxyError("Operação de campanha não permitida.", 404)
  }
  const path = segments.join("/")
  if (!isAllowedRequest(method, path)) {
    return whatsAppProxyError("Operação de campanha não permitida.", 404)
  }

  let target: URL
  let headers: Headers
  try {
    target = new URL(`${getWhatsAppApiBaseUrl()}/broadcasts${path ? `/${path}` : ""}`)
    headers = new Headers({ Accept: "application/json", Authorization: authorization })
  } catch {
    return whatsAppConfigError()
  }

  if (method === "GET" && path === "contacts/count") {
    const listIds = request.nextUrl.searchParams.get("contact_list_ids")
    if (listIds) target.searchParams.set("contact_list_ids", listIds)
  }

  let body: string | undefined
  if (method === "POST" || method === "PATCH") {
    const input = await readLimitedWhatsAppBody(request, 15 * 1024 * 1024)
    if (typeof input !== "string") return input
    body = input
    if (body) {
      if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
        return whatsAppProxyError("Envie a operação em formato JSON.", 415)
      }
      try {
        JSON.parse(body)
      } catch {
        return whatsAppProxyError("Operação de campanha inválida.", 400)
      }
      headers.set("Content-Type", "application/json")
    }
  }

  // Imports and campaign creation can perform sequential database operations.
  // Keep a bounded deadline without reducing them to the short polling timeout.
  return forwardWhatsAppRequest(target, { method, headers, body }, method === "GET" ? 15000 : 60000)
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyBroadcastRequest(request, context, "GET")
}
export async function POST(request: NextRequest, context: RouteContext) {
  return proxyBroadcastRequest(request, context, "POST")
}
export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyBroadcastRequest(request, context, "PATCH")
}
export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyBroadcastRequest(request, context, "DELETE")
}
