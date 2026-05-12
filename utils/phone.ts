export function normalizePhone(
  phone: string
): string {

  try {

    if (!phone) {
      return ""
    }

    let clean =
      String(phone)
        .split("@")[0]
        .trim()

    // remove tudo
    clean =
      clean.replace(/\D/g, "")

    // =======================
    // EMPTY
    // =======================
    if (!clean) {
      return ""
    }

    // =======================
    // ADD 55
    // =======================
    if (
      !clean.startsWith("55")
    ) {

      clean = `55${clean}`
    }

    // =======================
    // LIMITA
    // =======================
    if (
      clean.length > 13
    ) {

      clean =
        clean.slice(0, 13)
    }

    // =======================
    // INVALID
    // =======================
    if (

      clean.length < 12 ||

      clean.length > 13

    ) {

      console.log(
        "⚠️ telefone inválido:",
        clean
      )

      return ""
    }

    return clean

  } catch (err) {

    console.error(
      "❌ erro normalizePhone:",
      err
    )

    return ""
  }
}