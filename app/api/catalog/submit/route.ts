import { NextRequest, NextResponse } from "next/server"

function apiBase() {
  return (
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3001"
  ).replace(/\/$/, "")
}

export async function POST(request: NextRequest) {
  try {
    const response = await fetch(`${apiBase()}/catalog/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(await request.json()),
      cache: "no-store"
    })

    const body = await response.json()

    return NextResponse.json(body, {
      status: response.status
    })
  } catch (error) {
    console.error("Erro ao enviar carrinho:", error)

    return NextResponse.json(
      {
        ok: false,
        error:
          "Não conseguimos enviar seu carrinho agora. Tente novamente."
      },
      { status: 503 }
    )
  }
}
