import { createClient as createAdminClient } from "@supabase/supabase-js"

import { createClient as createSessionClient } from "@/lib/supabase/server"
import {
  DEFAULT_STORE_SETTINGS,
  normalizeStoreSettings,
  sanitizeStoreSettingsPatch
} from "@/lib/store-settings"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error("Configuração do Supabase ausente.")
  }

  return createAdminClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  })
}

async function authorize() {
  const sessionClient = await createSessionClient()
  const { data: { user } } = await sessionClient.auth.getUser()

  if (!user) {
    return { error: "Sessão expirada.", status: 401 } as const
  }

  const admin = adminClient()
  const { data: profile, error } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (error || !profile || !["admin", "agent"].includes(profile.role)) {
    return { error: "Você não tem permissão para alterar as configurações.", status: 403 } as const
  }

  return { admin } as const
}

async function currentSettings(admin: ReturnType<typeof adminClient>) {
  const { data, error } = await admin
    .from("store_settings")
    .select("settings, updated_at")
    .eq("store_key", "default")
    .maybeSingle()

  if (error) throw error

  return normalizeStoreSettings(data?.settings || DEFAULT_STORE_SETTINGS)
}

export async function GET() {
  try {
    const auth = await authorize()

    if ("error" in auth) {
      return Response.json({ error: auth.error }, { status: auth.status })
    }

    return Response.json({
      settings: await currentSettings(auth.admin)
    })
  } catch (error) {
    console.error("Erro ao carregar store_settings:", error)
    return Response.json(
      { error: "Não foi possível carregar as configurações." },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await authorize()

    if ("error" in auth) {
      return Response.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const section = String(body?.section || "dashboard").slice(0, 80)
    const patch = sanitizeStoreSettingsPatch(body?.settings)
    const current = await currentSettings(auth.admin)
    const now = new Date().toISOString()
    const next = normalizeStoreSettings({
      ...current,
      ...patch,
      bot_texts: patch.bot_texts
        ? { ...current.bot_texts, ...patch.bot_texts }
        : current.bot_texts,
      updated_from: section,
      updated_at: now
    })

    const { error } = await auth.admin
      .from("store_settings")
      .upsert(
        {
          store_key: "default",
          settings: next,
          updated_at: now
        },
        { onConflict: "store_key" }
      )

    if (error) throw error

    return Response.json({ settings: next })
  } catch (error) {
    console.error("Erro ao salvar store_settings:", error)
    return Response.json(
      { error: "Não foi possível salvar as configurações." },
      { status: 500 }
    )
  }
}
