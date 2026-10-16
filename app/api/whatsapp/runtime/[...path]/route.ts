import { requireDashboardAdmin } from "@/lib/dashboard-auth"

import {
  NextRequest,
  NextResponse
} from "next/server"

export const dynamic = "force-dynamic"

const BOT_URL =
  String(
    process.env.WHATSAPP_API_INTERNAL_URL ||
    process.env.WHATSAPP_API_URL ||
    "http://127.0.0.1:3001"
  ).replace(/\/+$/, "")

const INTERNAL_API_KEY =
  String(
    process.env.WHATSAPP_API_INTERNAL_KEY ||
    process.env.INTERNAL_API_KEY ||
    ""
  ).trim()

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

  const target =
    new URL(`${BOT_URL}/${path}`)

  const cacheBust =
    request.nextUrl.searchParams.get("t")

  if (cacheBust) {
    target.searchParams.set(
      "t",
      cacheBust
    )
  }

  const headers =
    new Headers({
      Accept: "application/json"
    })

  if (INTERNAL_API_KEY) {
    headers.set(
      "x-internal-api-key",
      INTERNAL_API_KEY
    )
  }

  let body: string | undefined

  if (method === "POST") {
    body = await request.text()

    headers.set(
      "Content-Type",
      request.headers.get("content-type") ||
      "application/json"
    )
  }

  const controller =
    new AbortController()

  const timeout =
    setTimeout(
      () => controller.abort(),
      15000
    )

  try {
    const response =
      await fetch(
        target,
        {
          method,
          headers,
          body,
          cache: "no-store",
          signal: controller.signal
        }
      )

    const payload =
      await response.text()

    return new NextResponse(
      payload || null,
      {
        status: response.status,
        headers: {
          "Content-Type":
            response.headers.get(
              "content-type"
            ) || "application/json",
          "Cache-Control":
            "no-store, max-age=0"
        }
      }
    )
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      error.name === "AbortError"

    console.error(
      "❌ erro no proxy interno do WhatsApp:",
      {
        method,
        path,
        error:
          error instanceof Error
            ? error.message
            : String(error)
      }
    )

    return NextResponse.json(
      {
        error:
          "Não foi possível comunicar com a API do WhatsApp."
      },
      {
        status: timedOut ? 504 : 502,
        headers: {
          "Cache-Control":
            "no-store, max-age=0"
        }
      }
    )
  } finally {
    clearTimeout(timeout)
  }
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
