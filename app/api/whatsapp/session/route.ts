import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const supabase = await createClient()

  try {
    const body = await req.json()

    let { phone, store_id, setor, is_default } = body

    if (!phone) {
      return NextResponse.json(
        { error: "Telefone obrigatório" },
        { status: 400 }
      )
    }

    // 🔥 normaliza telefone
    phone = String(phone).replace(/\D/g, "")

    if (phone.length < 10) {
      return NextResponse.json(
        { error: "Telefone inválido" },
        { status: 400 }
      )
    }

    // 🔥 fallback inteligente
    store_id = store_id || null
    setor = setor || "Atendimento"
    is_default = is_default || false

    const { data, error } = await supabase
      .from("whatsapp_sessions")
      .upsert(
        {
          phone,
          store_id,
          setor,
          is_default,
          status: "online",
          last_seen: new Date().toISOString(),
        },
        {
          onConflict: "phone",
        }
      )
      .select()
      .single()

    if (error) {
      console.error("Erro ao salvar sessão:", error)
      return NextResponse.json(
        { error: "Erro ao salvar sessão" },
        { status: 500 }
      )
    }

    return NextResponse.json(data)

  } catch (err) {
    console.error("Erro geral:", err)
    return NextResponse.json(
      { error: "Erro interno" },
      { status: 500 }
    )
  }
}

// =======================
// 🔁 LISTAR SESSÕES
// =======================
export async function GET() {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from("whatsapp_sessions")
      .select("*")
      .order("is_default", { ascending: false })
      .order("last_seen", { ascending: false })

    if (error) {
      console.error("Erro ao listar sessões:", error)
      return NextResponse.json(
        { error: "Erro ao buscar sessões" },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [])

  } catch (err) {
    console.error("Erro geral:", err)
    return NextResponse.json(
      { error: "Erro interno" },
      { status: 500 }
    )
  }
}