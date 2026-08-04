const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function decodeCatalogToken(
  value: string
) {
  const token =
    String(value || "").trim()

  // Mantém compatibilidade com links antigos que já usavam o UUID completo.
  if (UUID_PATTERN.test(token)) {
    return token.toLowerCase()
  }

  if (!/^[A-Za-z0-9_-]{22}$/.test(token)) {
    return null
  }

  try {
    const hex =
      Buffer
        .from(token, "base64url")
        .toString("hex")

    if (hex.length !== 32) {
      return null
    }

    const uuid = [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20)
    ].join("-")

    return UUID_PATTERN.test(uuid)
      ? uuid
      : null
  } catch {
    return null
  }
}
