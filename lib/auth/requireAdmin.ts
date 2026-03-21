// /lib/auth/requireAdmin.ts

import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function requireAdmin() {
  const supabase = createSupabaseServerClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  console.log("USER SERVER:", user)

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") {
    redirect("/login")
  }

  return user
}