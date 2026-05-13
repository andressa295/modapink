export function normalizePhone(
  phone: string
): string {

  try {

    if (!phone) {
      return ""
    }

    const clean =
      String(phone)
        .trim()

    if (!clean) {

      console.log(
        "⚠️ telefone vazio"
      )

      return ""
    }

    console.log(
      "✅ telefone normalizado:",
      clean
    )

    return clean

  } catch (err) {

    console.error(
      "❌ erro normalizePhone:",
      err
    )

    return ""
  }
}