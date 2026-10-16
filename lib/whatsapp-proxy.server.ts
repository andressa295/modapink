// Server-side transport shared only by the WhatsApp route handlers.
import { NextResponse } from "next/server"

const NO_STORE = { "Cache-Control": "no-store, max-age=0" }

export function whatsAppProxyError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status, headers: NO_STORE })
}

export function whatsAppConfigError() {
  // Never include configuration values or the original URL/Headers exception.
  return whatsAppProxyError(
    "A configuração da API do WhatsApp no painel está ausente ou inválida. Contate o administrador.",
    503
  )
}

export function getWhatsAppApiBaseUrl() {
  // These are server-only variables. An explicitly invalid override must fail
  // closed, rather than silently switching to a different/public API.
  const value = process.env.WHATSAPP_API_INTERNAL_URL ??
    process.env.WHATSAPP_API_URL ?? "http://127.0.0.1:3001"

  if (!/^https?:\/\//i.test(value) || /[\s\\\u0000-\u001f\u007f]/.test(value)) {
    throw new Error("Invalid WhatsApp API URL configuration")
  }

  const url = new URL(value)
  if (!/^https?:$/.test(url.protocol) || !url.hostname ||
      url.username || url.password || url.search || url.hash) {
    throw new Error("Invalid WhatsApp API URL configuration")
  }

  return url.toString().replace(/\/+$/, "")
}

export function getWhatsAppInternalKey() {
  const key = process.env.WHATSAPP_API_INTERNAL_KEY ?? process.env.INTERNAL_API_KEY

  // Validate the original value before any trimming. In particular, capturing
  // dotenv's stdout can prepend a log line and a newline to the actual key.
  if (!key || !/^[\x21-\x7e]+$/.test(key)) {
    throw new Error("Invalid WhatsApp internal key configuration")
  }

  return key
}

export async function forwardWhatsAppRequest(
  target: URL,
  options: Pick<RequestInit, "method" | "headers" | "body">
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    // One attempt only, including mutations. Never follow a redirect with an
    // internal key or the user's Bearer token.
    const response = await fetch(target, {
      ...options,
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal
    })

    if (response.status >= 300 && response.status < 400) {
      return whatsAppProxyError("A API do WhatsApp retornou um redirecionamento inesperado.", 502)
    }

    if (response.status === 204) {
      return new NextResponse(null, { status: 204, headers: NO_STORE })
    }

    // Do not turn an upstream HTML error page into active same-origin content.
    const text = await response.text()
    let payload: unknown
    try {
      payload = JSON.parse(text)
    } catch {
      return whatsAppProxyError(
        "A API do WhatsApp retornou uma resposta inválida.",
        response.ok ? 502 : response.status
      )
    }

    return NextResponse.json(payload, { status: response.status, headers: NO_STORE })
  } catch {
    const timedOut = controller.signal.aborted
    // Fetch/Headers errors may contain URLs or credentials. Do not log them.
    return whatsAppProxyError(
      timedOut
        ? "A API do WhatsApp demorou para responder. Confira o estado da operação antes de tentar novamente."
        : "Não foi possível comunicar com a API do WhatsApp.",
      timedOut ? 504 : 502
    )
  } finally {
    clearTimeout(timeout)
  }
}
