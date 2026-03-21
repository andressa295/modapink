import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export async function requireAdmin() {
  const supabase = await createClient()

  // 🔐 pega usuário
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  console.log("USER SERVER:", user)

  if (error || !user) {
    redirect("/login")
  }

  // 🔐 busca perfil
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profileError || profile?.role !== "admin") {
    redirect("/login")
  }

  return { user, profile }
}