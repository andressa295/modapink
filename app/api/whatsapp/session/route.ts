import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// =======================
// 📲 CRIAR / ATUALIZAR SESSÃO
// =======================
export async function POST(req: Request) {
  const supabase = await createClient()

  try {
    const body = await req.json()
    let { phone } = body

    if (!phone) {
      return NextResponse.json(
        { error: "Telefone obrigatório" },
        { status: 400 }
      )
    }

    // normaliza telefone
    phone = String(phone).replace(/\D/g, "")

    // =======================
    // 🔍 VERIFICA SE EXISTE
    // =======================
    const { data: existing, error: findError } = await supabase
      .from("whatsapp_sessions")
      .select("*")
      .eq("phone", phone)
      .maybeSingle()

    if (findError) {
      console.error("Erro ao buscar sessão:", findError)
      return NextResponse.json(
        { error: "Erro ao verificar sessão" },
        { status: 500 }
      )
    }

    // =======================
    // 🔄 ATUALIZA SE EXISTIR
    // =======================
    if (existing) {
      const { data, error } = await supabase
        .from("whatsapp_sessions")
        .update({
          status: "online",
          last_seen: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single()

      if (error) {
        console.error("Erro ao atualizar sessão:", error)
        return NextResponse.json(
          { error: "Erro ao atualizar sessão" },
          { status: 500 }
        )
      }

      return NextResponse.json(data)
    }

    // =======================
    // 🆕 CRIA NOVA SESSÃO
    // =======================
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
      console.error("Erro ao criar sessão:", error)
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
      .order("created_at", { ascending: false })

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