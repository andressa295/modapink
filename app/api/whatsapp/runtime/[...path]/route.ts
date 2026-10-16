import { requireDashboardAdmin } from "@/lib/dashboard-auth"
import {
  forwardWhatsAppRequest,
  getWhatsAppApiBaseUrl,
  getWhatsAppInternalKey,
  readLimitedWhatsAppBody,
  whatsAppConfigError,
  whatsAppProxyError
} from "@/lib/whatsapp-proxy.server"

import {
  NextRequest,
  NextResponse
} from "next/server"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{
    path: string[]
  }>
}

const ALLOWED_SESSION_IDS =
  new Set([
    "principal",
    "vendedora_1",
    "vendedora_2",
    "sac",
    "automacoes",
    "teste"
  ])

function isAllowedRequest(
  method: string,
  path: string
) {
  if (
    method === "GET" &&
    path === "sessions"
  ) {
    return true
  }

  if (
    method === "POST" &&
    path === "sessions/create"
  ) {
    return true
  }

  const statusMatch =
    path.match(
      /^sessions\/(?:qr|status)\/([a-z0-9_-]+)$/i
    )

  if (
    method === "GET" &&
    statusMatch
  ) {
    return ALLOWED_SESSION_IDS.has(
      statusMatch[1].toLowerCase()
    )
  }

  const deleteMatch =
    path.match(
      /^sessions\/([a-z0-9_-]+)$/i
    )

  return Boolean(
    method === "DELETE" &&
    deleteMatch &&
    ALLOWED_SESSION_IDS.has(
      deleteMatch[1].toLowerCase()
    )
  )
}

async function proxyWhatsAppRequest(
  request: NextRequest,
  context: RouteContext,
  method: "GET" | "POST" | "DELETE"
) {
  const denied =
    await requireDashboardAdmin()

  if (denied) {
    return denied
  }

  const { path: segments } =
    await context.params

  const path =
    (segments || [])
      .map(segment =>
        String(segment || "").trim()
      )
      .filter(Boolean)
      .join("/")

  if (!isAllowedRequest(method, path)) {
    return NextResponse.json(
      {
        error:
          "Operação de WhatsApp não permitida."
      },
      { status: 404 }
    )
  }

  if (method !== "GET") {
    const site = request.headers.get("sec-fetch-site")
    const origin = request.headers.get("origin")
    // Next may use an internal URL behind TLS-terminating reverse proxies.
    // Match the public host as Next's own Server Actions CSRF check does.
    const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim() ||
      request.headers.get("host") || request.nextUrl.host
    let wrongOrigin = false
    if (origin) {
      try {
        const parsed = new URL(origin)
        wrongOrigin = !/^https?:$/.test(parsed.protocol) || parsed.host.toLowerCase() !== host.toLowerCase()
      } catch {
        wrongOrigin = true
      }
    }
    if (site === "cross-site" || site === "same-site" || wrongOrigin) {
      return whatsAppProxyError("Origem da operação não permitida.", 403)
    }
  }

  let target: URL
  let headers: Headers
  try {
    target = new URL(`${getWhatsAppApiBaseUrl()}/${path}`)
    headers = new Headers({
      Accept: "application/json",
      "x-internal-api-key": getWhatsAppInternalKey()
    })
  } catch {
    return whatsAppConfigError()
  }

  const cacheBust = request.nextUrl.searchParams.get("t")
  if (cacheBust) target.searchParams.set("t", cacheBust)

  let body: string | undefined
  if (method === "POST") {
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      return whatsAppProxyError("Envie a operação em formato JSON.", 415)
    }
    const input = await readLimitedWhatsAppBody(request, 1024)
    if (typeof input !== "string") return input
    try {
      const payload = JSON.parse(input)
      if (typeof payload?.sessionId !== "string" || !ALLOWED_SESSION_IDS.has(payload.sessionId)) {
        return whatsAppProxyError("Sessão de WhatsApp não permitida.", 400)
      }
      body = JSON.stringify({ sessionId: payload.sessionId })
    } catch {
      return whatsAppProxyError("Operação de WhatsApp inválida.", 400)
    }
    headers.set("Content-Type", "application/json")
  }

  return forwardWhatsAppRequest(target, { method, headers, body })
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  return proxyWhatsAppRequest(
    request,
    context,
    "GET"
  )
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  return proxyWhatsAppRequest(
    request,
    context,
    "POST"
  )
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  return proxyWhatsAppRequest(
    request,
    context,
    "DELETE"
  )
}
