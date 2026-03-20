export function extractOrderNumber(text: string): string | null {
  if (!text) return null

  const match = text.match(/#?\d{3,}/)

  if (!match) return null

  return match[0].replace("#", "")
}