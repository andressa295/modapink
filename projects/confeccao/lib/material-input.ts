/** Brazilian currency input, converted without guessing a decimal point as a thousands separator. */
export function parseMaterialPrice(value: string): number | null {
  const text = value.trim();
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text)) return null;
  const amount = Number(text.replaceAll(".", "").replace(",", "."));
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}
