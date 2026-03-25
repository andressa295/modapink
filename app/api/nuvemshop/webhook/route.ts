import { NextRequest } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    console.log("🔥 WEBHOOK RECEBIDO:", body)

    const event = req.headers.get("x-topic")

    if (event === "orders/created") {
      const order = body

      console.log("🛒 NOVO PEDIDO:", order.id)

      // 🔥 aqui você vai integrar com WhatsApp depois
    }

    return new Response("ok", { status: 200 })

  } catch (err) {
    console.error("Erro webhook:", err)

    return new Response("erro", { status: 500 })
  }
}