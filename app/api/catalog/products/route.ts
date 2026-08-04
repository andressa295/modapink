import { NextResponse } from "next/server"

import { loadCatalog } from "@/lib/catalog/nuvemshop"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const catalog = await loadCatalog()

    return NextResponse.json(catalog, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300"
      }
    })
  } catch (error) {
    console.error("Erro ao carregar catálogo:", error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o catálogo."
      },
      { status: 500 }
    )
  }
}
