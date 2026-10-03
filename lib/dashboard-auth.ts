import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { parseDashboardRole } from "@/lib/dashboard-access"

export async function getDashboardAccess(sessionClient: SupabaseClient) {
  try {
    const { data, error: authError } = await sessionClient.auth.getClaims()
    const userId = typeof data?.claims?.sub === "string"
      ? data.claims.sub
      : null

    if (authError || !userId) {
      return { user: null, role: null }
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !key) {
      return { user: { id: userId }, role: null }
    }

    // A identidade é validada criptograficamente pelo JWT antes da consulta do perfil.
    const admin = createAdminClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const { data: profile, error } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle()

    return {
      user: { id: userId },
      role: error ? null : parseDashboardRole(profile?.role),
    }
  } catch {
    return { user: null, role: null }
  }
}

export async function requireDashboardAdmin() {
  const access = await getDashboardAccess(await createClient())

  if (!access.user) {
    return Response.json(
      { error: "Sessão expirada." },
      { status: 401 }
    )
  }

  if (access.role !== "admin") {
    return Response.json(
      { error: "Acesso exclusivo de administrador." },
      { status: 403 }
    )
  }

  return null
}
