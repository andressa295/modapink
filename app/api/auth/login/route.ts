import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { dashboardHome, parseDashboardRole } from "@/lib/dashboard-access"

type LoginBody = {
  email?: unknown
  password?: unknown
}

export async function POST(request: Request) {
  let body: LoginBody

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Dados de login inválidos" },
      { status: 400 }
    )
  }

  const email = typeof body.email === "string" ? body.email.trim() : ""
  const password = typeof body.password === "string" ? body.password : ""

  if (!email || !password) {
    return NextResponse.json(
      { error: "Informe o email e a senha" },
      { status: 400 }
    )
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data.session || !data.user) {
      return NextResponse.json(
        { error: "Email ou senha inválidos" },
        { status: 401 }
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json(
        { error: "Erro ao validar usuário" },
        { status: 500 }
      )
    }

    const role = parseDashboardRole(profile?.role)

    if (!role) {
      await supabase.auth.signOut()
      return NextResponse.json(
        { error: "Acesso não autorizado" },
        { status: 403 }
      )
    }

    return NextResponse.json({
      redirectTo: dashboardHome(role),
    })
  } catch (error) {
    console.error("Erro no login pelo servidor:", error)
    return NextResponse.json(
      { error: "O serviço de login está indisponível. Tente novamente." },
      { status: 503 }
    )
  }
}
