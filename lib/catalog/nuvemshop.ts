/* eslint-disable @typescript-eslint/no-explicit-any */

import "server-only"

import { createClient } from "@supabase/supabase-js"

import type {
  CatalogCategory,
  CatalogProduct,
  CatalogResponse,
  CatalogSettings
} from "./types"

import {
  resolveVariantPricing
} from "./pricing"

const NUVEMSHOP_API = "https://api.nuvemshop.com.br/v1"
const USER_AGENT = "Phandshop/1.0 (contato@phand.com.br)"
const DEFAULT_SITE = "https://atacadomodapink.com.br"

type StoreRecord = {
  id: string
  store_id: number | string | null
  user_id: number | string | null
  access_token: string | null
  shop: string | null
  name: string | null
}

type StoreData = {
  store: StoreRecord
  settings: CatalogSettings
}

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error("As credenciais do Supabase não estão configuradas.")
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  })
}

function localize(value: unknown): string {
  if (typeof value === "string") {
    return value
  }

  if (!value || typeof value !== "object") {
    return ""
  }

  const translations = value as Record<string, unknown>
  const preferred = ["pt", "pt_BR", "es", "en"]

  for (const language of preferred) {
    if (typeof translations[language] === "string") {
      return String(translations[language])
    }
  }

  const first = Object.values(translations)
    .find(item => typeof item === "string")

  return typeof first === "string" ? first : ""
}

function cleanDomain(value: string) {
  return value
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .toLowerCase()
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
}

function buildSettings(raw: any, defaultPhone = ""): CatalogSettings {
  const siteUrl = String(raw?.site_url || DEFAULT_SITE).replace(/\/$/, "")
  const cleanPhone = defaultPhone.replace(/\D/g, "")
  const automaticHelpUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent("Oi, preciso de ajuda para montar meu pedido no catálogo da Moda Pink.")}`
    : `${siteUrl}/contato`
  const configuredPixDiscount =
    toNumber(
      raw?.catalog_pix_discount_percent ??
      process.env.CATALOG_PIX_DISCOUNT_PERCENT ??
      10,
      10
    )
  const pixDiscountPercent = Math.min(
    100,
    Math.max(
      0,
      configuredPixDiscount > 0
        ? configuredPixDiscount
        : 10
    )
  )

  return {
    storeName: String(raw?.store_name || "Moda Pink"),
    minimumOrder: Math.max(0, toNumber(raw?.minimum_order, 200)),
    siteUrl,
    helpUrl: String(
      raw?.sac_url ||
      process.env.CATALOG_WHATSAPP_URL ||
      automaticHelpUrl
    ),
    pixDiscountPercent
  }
}

export async function getCatalogStore(): Promise<StoreData> {
  const supabase = createAdminClient()

  const [storesResult, settingsResult, sessionsResult] = await Promise.all([
    supabase
      .from("stores")
      .select("id, store_id, user_id, access_token, shop, name")
      .not("access_token", "is", null),
    supabase
      .from("store_settings")
      .select("settings")
      .eq("store_key", "default")
      .maybeSingle(),
    supabase
      .from("whatsapp_sessions")
      .select("phone")
      .eq("is_default", true)
      .limit(1)
  ])

  if (storesResult.error) {
    throw new Error(`Não foi possível localizar a loja: ${storesResult.error.message}`)
  }

  const defaultPhone = String(sessionsResult.data?.[0]?.phone || "")
  const settings = buildSettings(settingsResult.data?.settings, defaultPhone)
  const stores = (storesResult.data || []) as StoreRecord[]
  const configuredId = String(process.env.NUVEMSHOP_STORE_ID || "").trim()
  const targetDomain = cleanDomain(
    process.env.CATALOG_STORE_DOMAIN || settings.siteUrl
  )

  const store =
    stores.find(item =>
      configuredId &&
      [item.store_id, item.user_id].some(id => String(id || "") === configuredId)
    ) ||
    stores.find(item => {
      const shopDomain = cleanDomain(String(item.shop || ""))
      return Boolean(
        shopDomain &&
        (targetDomain.includes(shopDomain) || shopDomain.includes(targetDomain))
      )
    }) ||
    (stores.length === 1 ? stores[0] : null)

  if (!store?.access_token || !store.user_id) {
    throw new Error(
      "A conexão da Moda Pink com a Nuvemshop não foi encontrada."
    )
  }

  return { store, settings }
}

export async function nuvemshopRequest<T>(
  store: StoreRecord,
  path: string,
  init?: RequestInit
): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)

  try {
    const response = await fetch(
      `${NUVEMSHOP_API}/${store.user_id}${path}`,
      {
        ...init,
        headers: {
          Authentication: `bearer ${store.access_token}`,
          "Content-Type": "application/json",
          "User-Agent": USER_AGENT,
          ...(init?.headers || {})
        },
        signal: controller.signal,
        cache: "no-store"
      }
    )

    const text = await response.text()
    const data = text ? JSON.parse(text) : null

    if (!response.ok) {
      const detail =
        data?.description ||
        data?.message ||
        `Erro ${response.status}`

      throw new Error(`Nuvemshop: ${detail}`)
    }

    return data as T
  } finally {
    clearTimeout(timeout)
  }
}

export function mapNuvemshopProducts(
  rawProducts: any[],
  settings: CatalogSettings
): CatalogProduct[] {
  const discountFactor = 1 - settings.pixDiscountPercent / 100

  return rawProducts
    .filter(product =>
      product?.visibility === "visible" ||
      product?.published === true
    )
    .map(product => {
      const attributes = (product.attributes || []).map(localize)
      const variants = (product.variants || []).map((variant: any) => {
        const {
          price,
          compareAtPrice
        } = resolveVariantPricing(variant)
        const hasStock =
          variant.stock_management !== true ||
          variant.stock === null ||
          toNumber(variant.stock) > 0

        return {
          id: toNumber(variant.id),
          values: (variant.values || []).map(localize),
          price: roundMoney(price),
          pixPrice: roundMoney(price * discountFactor),
          compareAtPrice,
          stock:
            variant.stock_management === true
              ? Math.max(0, toNumber(variant.stock))
              : null,
          available: hasStock,
          sku: variant.sku ? String(variant.sku) : null
        }
      })
      .filter((variant: any) => variant.id > 0 && variant.price >= 0)

      const availableVariants = variants.filter((variant: any) => variant.available)
      const pricedVariants = availableVariants.length > 0
        ? availableVariants
        : variants
      const lowestPriceVariant =
        pricedVariants.reduce(
          (lowest: any, variant: any) =>
            !lowest || variant.price < lowest.price
              ? variant
              : lowest,
          null
        )

      const categories: CatalogCategory[] = (product.categories || [])
        .map((category: any) => ({
          id: toNumber(category?.id ?? category),
          name: localize(category?.name) || "Outros"
        }))
        .filter((category: CatalogCategory) => category.id > 0)

      return {
        id: toNumber(product.id),
        name: localize(product.name) || "Produto",
        handle: localize(product.handle),
        description: stripHtml(localize(product.description)),
        images: (product.images || [])
          .sort((a: any, b: any) => toNumber(a.position) - toNumber(b.position))
          .map((image: any) => String(image.src || ""))
          .filter(Boolean),
        categories,
        attributes,
        variants,
        priceFrom: lowestPriceVariant?.price || 0,
        pixPriceFrom: lowestPriceVariant?.pixPrice || 0,
        compareAtPriceFrom: lowestPriceVariant?.compareAtPrice || null,
        available: availableVariants.length > 0
      }
    })
    .filter(product => product.id > 0 && product.variants.length > 0)
}

export async function loadCatalog(): Promise<CatalogResponse> {
  const { store, settings } = await getCatalogStore()
  const products: any[] = []
  const perPage = 200

  for (let page = 1; page <= 50; page += 1) {
    const batch = await nuvemshopRequest<any[]>(
      store,
      `/products?visibility=visible&sort_by=created-at-descending&page=${page}&per_page=${perPage}`
    )

    if (!Array.isArray(batch)) {
      break
    }

    products.push(...batch)

    if (batch.length < perPage) {
      break
    }
  }

  const uniqueProducts =
    Array.from(
      new Map(
        products.map(product => [
          Number(product?.id || 0),
          product
        ])
      ).values()
    )
      .filter(product =>
        Number(product?.id || 0) > 0
      )

  const mappedProducts = mapNuvemshopProducts(uniqueProducts, settings)
  const categoryMap = new Map<number, CatalogCategory>()

  mappedProducts.forEach(product => {
    product.categories.forEach(category => {
      categoryMap.set(category.id, category)
    })
  })

  return {
    products: mappedProducts,
    categories: Array.from(categoryMap.values())
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    settings,
    updatedAt: new Date().toISOString()
  }
}

export function getCatalogAdminClient() {
  return createAdminClient()
}
