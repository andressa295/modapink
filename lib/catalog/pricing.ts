type VariantPricingInput = {
  price?: unknown
  promotional_price?: unknown
  compare_at_price?: unknown
}

function toNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed)
    ? parsed
    : 0
}

function roundMoney(value: number) {
  return Math.round(
    (value + Number.EPSILON) * 100
  ) / 100
}

export function resolveVariantPricing(
  variant: VariantPricingInput
) {
  const regularPrice =
    toNumber(variant?.price)
  const promotionalPrice =
    toNumber(variant?.promotional_price)
  const storefrontComparePrice =
    toNumber(variant?.compare_at_price)

  const price =
    promotionalPrice > 0
      ? promotionalPrice
      : regularPrice

  const originalPrices = [
    regularPrice,
    storefrontComparePrice
  ].filter(value =>
    value > price
  )

  return {
    price:
      roundMoney(price),
    compareAtPrice:
      originalPrices.length
        ? roundMoney(
            Math.max(...originalPrices)
          )
        : null
  }
}
