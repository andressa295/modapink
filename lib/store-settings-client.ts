import type { StoreSettings } from "./store-settings"
import { normalizeStoreSettings } from "./store-settings"

async function readResponse(response: Response) {
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload?.error || "Não foi possível atualizar as configurações.")
  }

  return payload
}

export async function loadStoreSettings() {
  const response = await fetch("/api/store-settings", {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin"
  })
  const payload = await readResponse(response)

  return normalizeStoreSettings(payload.settings)
}

export async function patchStoreSettings(
  section: string,
  settings: Partial<StoreSettings>
) {
  const response = await fetch("/api/store-settings", {
    method: "PATCH",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ section, settings })
  })
  const payload = await readResponse(response)

  return normalizeStoreSettings(payload.settings)
}
