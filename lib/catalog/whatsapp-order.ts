import type { CatalogCheckoutItem } from "./types"

export type WhatsAppCatalogLine = CatalogCheckoutItem & {
  productName: string
  values: string[]
  attributes: string[]
  price: number
}

export const SALES_WHATSAPP_NUMBER = "5511961167361"

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value)
}

export function buildWhatsAppCatalogOrderMessage({
  items,
  total,
  sourceToken
}: {
  items: WhatsAppCatalogLine[]
  total: number
  sourceToken?: string
}) {
  const blocks = items.map((item, index) => {
    const options = item.values.map((value, optionIndex) =>
      `${item.attributes[optionIndex] || `Opção ${optionIndex + 1}`}: ${value}`
    )

    return [
      `${index + 1} - ${item.productName}`,
      ...options,
      `Quantidade: ${item.quantity}`,
      `Ref: ns-${item.productId}-${item.variantId}`
    ].join("\n")
  })

  return [
    "Olá! Finalizei minha seleção no catálogo da Moda Pink 💗",
    "",
    "PEDIDO DO CATÁLOGO",
    ...blocks.flatMap(block => ["", block]),
    "",
    `Total dos produtos: ${money(total)}`,
    sourceToken && sourceToken !== "catalogo"
      ? `Origem: ${sourceToken}`
      : "",
    "",
    "Quero continuar este pedido por aqui."
  ].filter(Boolean).join("\n")
}

export function buildWhatsAppCatalogOrderUrl(message: string) {
  return `https://wa.me/${SALES_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}
