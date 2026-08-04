import type { Metadata } from "next"
import { Suspense } from "react"

import CatalogClient from "./CatalogClient"

export const metadata: Metadata = {
  title: "Catálogo | Moda Pink",
  description:
    "Escolha suas peças da Moda Pink e monte seu pedido pelo celular."
}

export default function CatalogPage() {
  return (
    <Suspense fallback={<div>Carregando catálogo...</div>}>
      <CatalogClient />
    </Suspense>
  )
}
