import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const supabase = await createClient()

  const body = await req.json()
  const { phone } = body

  if (!phone) {
    return NextResponse.json(
      { error: "Telefone obrigatório" },
      { status: 400 }
    )
  }

  // evita duplicar sessão
  const { data: existing } = await supabase
    .from("whatsapp_sessions")
    .select("*")
    .eq("phone", phone)
    .single()

  if (existing) {
    return NextResponse.json(existing)
  }

  const { data, error } = await supabase
    .from("whatsapp_sessions")
    .insert({
      phone,
      status: "online",
      last_seen: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Erro ao salvar sessão" },
      { status: 500 }
    )
  }

  return NextResponse.json(data)
}

// 🔁 LISTAR
export async function GET() {
  const supabase = await createClient()

  const { data } = await supabase
    .from("whatsapp_sessions")
    .select("*")
    .order("created_at", { ascending: false })

  return NextResponse.json(data || [])
}