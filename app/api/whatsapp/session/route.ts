import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// =======================
// 🔥 CREATE SESSION (ESTÁVEL)
// =======================
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const body = await req.json()

    let { phone, store_id, setor, is_default } = body

    // =======================
    // 🧪 VALIDAÇÃO
    // =======================
    if (!phone) {
      return NextResponse.json(
        { error: "Telefone obrigatório" },
        { status: 400 }
      )
    }

    phone = String(phone).replace(/\D/g, "")

    if (phone.length < 10) {
      return NextResponse.json(
        { error: "Telefone inválido" },
        { status: 400 }
      )
    }

    // =======================
    // 🔧 DEFAULTS
    // =======================
    store_id = store_id ?? null
    setor = setor ?? "Atendimento"
    is_default = is_default ?? false

    // =======================
    // 💾 UPSERT (IGUAL AO QUE FUNCIONAVA)
    // =======================
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

    if (error) {
      console.error("❌ ERRO UPSERT:", error)

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    // =======================
    // 🔥 GARANTE FORMATO CORRETO
    // =======================
    const session = Array.isArray(data) ? data[0] : data

    return NextResponse.json(session)

  } catch (err: any) {
    console.error("❌ ERRO GERAL POST:", err)

    return NextResponse.json(
      { error: err.message || String(err) },
      { status: 500 }
    )
  }
}

// =======================
// 🔁 LISTAR SESSÕES
// =======================
export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("whatsapp_sessions")
      .select("*")
      .order("is_default", { ascending: false })
      .order("last_seen", { ascending: false })

    if (error) {
      console.error("❌ ERRO GET:", error)

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [])

  } catch (err: any) {
    console.error("❌ ERRO GERAL GET:", err)

    return NextResponse.json(
      { error: err.message || String(err) },
      { status: 500 }
    )
  }
}