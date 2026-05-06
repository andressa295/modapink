// 🔥 Força o Next.js a tratar como rota dinâmica (essencial para webhooks)
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log("LGPD webhook recebido:", body)

    // Agora você pode importar seu createClient() aqui dentro sem medo
    // const supabase = createClient()

    return new Response(JSON.stringify({ ok: true }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error("Erro no Webhook:", error)
    return new Response("Erro interno", { status: 500 })
  }
}