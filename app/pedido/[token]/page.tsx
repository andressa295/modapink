import type { Metadata } from "next"

import CatalogClient from "@/app/catalogo/CatalogClient"

export const metadata: Metadata = {
  title: "Monte seu pedido | Moda Pink",
  description: "Escolha suas peças e finalize seu pedido da Moda Pink."
}

export default async function CustomerCatalogPage({
  params
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  return <CatalogClient sourceToken={token} />
}
