/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server"

import {
  getCatalogAdminClient,
  getCatalogStore,
  mapNuvemshopProducts,
  nuvemshopRequest
} from "@/lib/catalog/nuvemshop"
import type { CatalogCheckoutItem } from "@/lib/catalog/types"

export const dynamic = "force-dynamic"

type CheckoutRequest = {
  customer?: {
    name?: string
    email?: string
    phone?: string
  }
  items?: CatalogCheckoutItem[]
  sourceToken?: string
}

function cleanText(value: unknown, maxLength: number) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLength)
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as CheckoutRequest
    const fullName = cleanText(body.customer?.name, 120)
    const email = cleanText(body.customer?.email, 160).toLowerCase()
    const phone = cleanText(body.customer?.phone, 30).replace(/\D/g, "")
    const sourceToken = cleanText(body.sourceToken, 120)
    const rawItems = Array.isArray(body.items) ? body.items : []
    const nameParts = fullName.split(/\s+/).filter(Boolean)

    if (nameParts.length < 2) {
      return errorResponse("Informe seu nome e sobrenome.")
    }

    if (!isEmail(email)) {
      return errorResponse("Informe um e-mail válido.")
    }

    if (phone.length < 10 || phone.length > 15) {
      return errorResponse("Informe um WhatsApp válido com DDD.")
    }

    if (rawItems.length === 0 || rawItems.length > 100) {
      return errorResponse("Seu carrinho está vazio ou possui itens demais.")
    }

    const consolidatedItems = new Map<number, CatalogCheckoutItem>()

    rawItems.forEach(item => {
      const variantId = Number(item?.variantId)
      const productId = Number(item?.productId)
      const quantity = Math.floor(Number(item?.quantity))

      if (
        Number.isInteger(variantId) &&
        variantId > 0 &&
        Number.isInteger(productId) &&
        productId > 0 &&
        Number.isInteger(quantity) &&
        quantity > 0 &&
        quantity <= 100
      ) {
        const existing = consolidatedItems.get(variantId)
        consolidatedItems.set(variantId, {
          variantId,
          productId,
          quantity: Math.min(100, (existing?.quantity || 0) + quantity)
        })
      }
    })

    const items = Array.from(consolidatedItems.values())

    if (items.length === 0) {
      return errorResponse("Não encontramos itens válidos no carrinho.")
    }

    const { store, settings } = await getCatalogStore()
    const productIds = Array.from(new Set(items.map(item => item.productId)))
    const rawProducts = await nuvemshopRequest<any[]>(
      store,
      `/products?ids=${productIds.join(",")}&per_page=${Math.min(200, productIds.length)}`
    )
    const products = mapNuvemshopProducts(rawProducts, settings)
    const productMap = new Map(products.map(product => [product.id, product]))
    let total = 0

    for (const item of items) {
      const product = productMap.get(item.productId)
      const variant = product?.variants.find(entry => entry.id === item.variantId)

      if (!product || !variant) {
        return errorResponse(
          "Um produto do carrinho não está mais disponível. Atualize o catálogo e tente novamente."
        )
      }

      if (!variant.available) {
        return errorResponse(`${product.name} está sem estoque nessa opção.`)
      }

      if (variant.stock !== null && item.quantity > variant.stock) {
        return errorResponse(
          `${product.name} possui apenas ${variant.stock} unidade(s) nessa opção.`
        )
      }

      total += variant.price * item.quantity
    }

    if (total + 0.001 < settings.minimumOrder) {
      return errorResponse(
        `O pedido mínimo é de R$ ${settings.minimumOrder.toFixed(2).replace(".", ",")}.`
      )
    }

    const firstName = nameParts.shift() || "Cliente"
    const lastName = nameParts.join(" ")
    const draftOrder = await nuvemshopRequest<any>(
      store,
      "/draft_orders",
      {
        method: "POST",
        body: JSON.stringify({
          contact_name: firstName,
          contact_lastname: lastName,
          contact_email: email,
          contact_phone: phone,
          payment_status: "unpaid",
          sale_channel: "Catálogo Moda Pink",
          note: sourceToken
            ? `Pedido iniciado pelo catálogo. Origem: ${sourceToken}`
            : "Pedido iniciado pelo catálogo.",
          products: items.map(item => ({
            variant_id: item.variantId,
            quantity: item.quantity
          }))
        })
      }
    )

    const checkoutUrl =
      draftOrder?.checkout_url ||
      draftOrder?.abandoned_checkout_url

    if (!checkoutUrl) {
      throw new Error("A Nuvemshop não retornou o link do checkout.")
    }

    try {
      const supabase = getCatalogAdminClient()
      const summary = items.map(item => {
        const product = productMap.get(item.productId)
        const variant = product?.variants.find(entry => entry.id === item.variantId)

        return {
          product_id: item.productId,
          product_name: product?.name || "Produto",
          variant_id: item.variantId,
          variant_values: variant?.values || [],
          quantity: item.quantity,
          unit_price: variant?.price || 0
        }
      })

      await supabase.from("events").insert({
        type: "catalog_checkout_created",
        conversation_id:
          isUuid(sourceToken)
            ? sourceToken
            : null,
        payload: {
          source_token: sourceToken || null,
          customer: {
            name: fullName,
            email,
            phone
          },
          draft_order_id: draftOrder.id,
          checkout_url: checkoutUrl,
          total,
          items: summary
        }
      })
    } catch (logError) {
      console.error("Checkout criado, mas o evento não foi salvo:", logError)
    }

    return NextResponse.json({
      checkoutUrl,
      draftOrderId: draftOrder.id,
      total
    })
  } catch (error) {
    console.error("Erro ao gerar checkout do catálogo:", error)

    const message = error instanceof Error
      ? error.message
      : "Não foi possível gerar o checkout."

    const status = message.includes("Nuvemshop:") ? 502 : 500
    return errorResponse(message, status)
  }
}
