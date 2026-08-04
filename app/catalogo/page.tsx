import type { Metadata } from "next"

import CatalogClient from "./CatalogClient"

export const metadata: Metadata = {
  title: "Catálogo | Moda Pink Atacado",
  description: "Monte seu pedido de atacado da Moda Pink."
}

export default function CatalogPage() {
  return <CatalogClient />
}
