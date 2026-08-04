export type CatalogVariant = {
  id: number
  values: string[]
  price: number
  pixPrice: number
  compareAtPrice: number | null
  stock: number | null
  available: boolean
  sku: string | null
}

export type CatalogCategory = {
  id: number
  name: string
}

export type CatalogProduct = {
  id: number
  name: string
  handle: string
  description: string
  images: string[]
  categories: CatalogCategory[]
  attributes: string[]
  variants: CatalogVariant[]
  priceFrom: number
  pixPriceFrom: number
  compareAtPriceFrom: number | null
  available: boolean
}

export type CatalogSettings = {
  storeName: string
  minimumOrder: number
  siteUrl: string
  helpUrl: string
  pixDiscountPercent: number
}

export type CatalogResponse = {
  products: CatalogProduct[]
  categories: CatalogCategory[]
  settings: CatalogSettings
  updatedAt: string
}

export type CatalogCheckoutItem = {
  productId: number
  variantId: number
  quantity: number
}
