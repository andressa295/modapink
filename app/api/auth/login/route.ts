import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { dashboardHome, parseDashboardRole } from "@/lib/dashboard-access"

type LoginBody = {
  email?: unknown
  password?: unknown
}

type SupabaseErrorLike = {
  status?: number
  code?: string
  message?: string
  name?: string
}

function isInfrastructureError(error: unknown) {
  if (!error || typeof error !== "object") return false

  const candidate = error as SupabaseErrorLike
  const status = Number(candidate.status || 0)
  const details = [
    candidate.name,
    candidate.code,
    candidate.message,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  return (
    status === 0 ||
    status >= 500 ||
    details.includes("fetch") ||
    details.includes("timeout") ||
    details.includes("timed out") ||
    details.includes("abort") ||
    details.includes("network") ||
    details.includes("retryable")
  )
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

    if (error) {
      if (isInfrastructureError(error)) {
        console.error("Supabase Auth temporariamente indisponível:", error)
        return NextResponse.json(
          {
            error:
              "O Supabase está temporariamente instável. Aguarde alguns minutos e tente novamente.",
          },
          { status: 503 }
        )
      }

      return NextResponse.json(
        { error: "Email ou senha inválidos" },
        { status: 401 }
      )
    }

    if (!data.session || !data.user) {
      return NextResponse.json(
        {
          error:
            "O serviço de login não concluiu a autenticação. Tente novamente.",
        },
        { status: 503 }
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle()

    if (profileError) {
      console.error("Falha ao validar perfil no Supabase:", profileError)
      return NextResponse.json(
        {
          error:
            "O Supabase está temporariamente instável. Aguarde alguns minutos e tente novamente.",
        },
        { status: 503 }
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
      {
        error:
          "O Supabase está temporariamente instável. Aguarde alguns minutos e tente novamente.",
      },
      { status: 503 }
    )
  }
}
