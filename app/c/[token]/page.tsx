import type { Metadata } from "next"

import { notFound } from "next/navigation"

import CatalogClient from "@/app/catalogo/CatalogClient"
import { decodeCatalogToken } from "@/lib/catalog/token"

export const metadata: Metadata = {
  title: "Catálogo | Moda Pink",
  description: "Escolha suas peças e finalize seu pedido da Moda Pink.",
  openGraph: {
    title: "Catálogo Moda Pink",
    description: "Escolha suas peças, cores e tamanhos e finalize seu pedido.",
    images: ["/modapiink.png"]
  }
}

export default async function ShortCustomerCatalogPage({
  params
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const sourceToken = decodeCatalogToken(token)

  if (!sourceToken) {
    notFound()
  }

  return <CatalogClient sourceToken={sourceToken} />
}
