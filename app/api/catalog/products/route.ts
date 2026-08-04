import { NextRequest, NextResponse } from "next/server"

function apiBase() {
  return (
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3001"
  ).replace(/\/$/, "")
}

export async function GET(request: NextRequest) {
  try {
    const upstream = new URL(`${apiBase()}/catalog/products`)

    request.nextUrl.searchParams.forEach((value, key) => {
      upstream.searchParams.set(key, value)
    })

    const response = await fetch(upstream, {
      next: { revalidate: 60 }
    })

    const body = await response.json()

    return NextResponse.json(body, {
      status: response.status,
      headers: {
        "Cache-Control":
          "public, max-age=60, stale-while-revalidate=240"
      }
    })
  } catch (error) {
    console.error("Erro ao consultar catálogo:", error)

    return NextResponse.json(
      {
        ok: false,
        error:
          "O catálogo está atualizando. Tente novamente em instantes."
      },
      { status: 503 }
    )
  }
}
