// app/api/nuvemshop/webhook/route.js

export const dynamic = 'force-dynamic' // 🔥 Adicione esta linha aqui

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log("LGPD webhook recebido:", body)

    return new Response(JSON.stringify({ ok: true }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error("Erro no Webhook:", error)
    return new Response("Erro interno", { status: 500 })
  }
}