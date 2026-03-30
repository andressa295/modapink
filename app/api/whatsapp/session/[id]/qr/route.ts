import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const BOT_URL = "http://localhost:3001"

// =======================
// 🔧 HELPER RESPONSE
// =======================
function errorResponse(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status })
}

// =======================
// 🔌 DESCONECTAR
// =======================
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id } = params

    if (!id) return errorResponse("ID inválido", 400)

    // 🔎 busca sessão
    const { data: session, error } = await supabase
      .from("whatsapp_sessions")
      .select("session_key")
      .eq("id", id)
      .single()

    if (error || !session) {
      return errorResponse("Sessão não encontrada", 404)
    }

    // 🔌 tenta desconectar no bot
    try {
      await fetch(`${BOT_URL}/sessions/${session.session_key}/disconnect`, {
        method: "POST",
      })
    } catch (botError) {
      console.error("⚠️ Erro ao desconectar no bot:", botError)
    }

    // 💾 atualiza banco (sempre)
    const { error: updateError } = await supabase
      .from("whatsapp_sessions")
      .update({
        status: "offline",
        last_seen: new Date().toISOString(),
      })
      .eq("id", id)

    if (updateError) {
      return errorResponse(updateError.message)
    }

    return NextResponse.json({ ok: true })

  } catch (err: any) {
    console.error("❌ ERRO DISCONNECT:", err)
    return errorResponse(err.message)
  }
}

// =======================
// ✏️ ATUALIZAR NOME
// =======================
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id } = params

    if (!id) return errorResponse("ID inválido", 400)

    const body = await req.json()
    const { name } = body

    if (!name || !name.trim()) {
      return errorResponse("Nome inválido", 400)
    }

    const { error } = await supabase
      .from("whatsapp_sessions")
      .update({ name })
      .eq("id", id)

    if (error) {
      return errorResponse(error.message)
    }

    return NextResponse.json({ ok: true })

  } catch (err: any) {
    console.error("❌ ERRO PATCH:", err)
    return errorResponse(err.message)
  }
}

// =======================
// 🗑 EXCLUIR COMPLETO
// =======================
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id } = params

    if (!id) return errorResponse("ID inválido", 400)

    // 🔎 busca sessão
    const { data: session, error } = await supabase
      .from("whatsapp_sessions")
      .select("session_key")
      .eq("id", id)
      .single()

    if (error || !session) {
      return errorResponse("Sessão não encontrada", 404)
    }

    // 🔥 tenta destruir no bot
    try {
      await fetch(`${BOT_URL}/sessions/${session.session_key}`, {
        method: "DELETE",
      })
    } catch (botError) {
      console.error("⚠️ Erro ao deletar no bot:", botError)
    }

    // 💾 soft delete no banco
    const { error: updateError } = await supabase
      .from("whatsapp_sessions")
      .update({
        deleted_at: new Date().toISOString(),
        status: "offline",
      })
      .eq("id", id)

    if (updateError) {
      return errorResponse(updateError.message)
    }

    return NextResponse.json({ ok: true })

  } catch (err: any) {
    console.error("❌ ERRO DELETE:", err)
    return errorResponse(err.message)
  }
}