import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  try {
    // 🔥 1. BUSCA TODAS AS LOJAS
    const { data: stores, error } = await supabase
      .from("stores")
      .select("*")

    if (error) {
      console.error("Erro ao buscar stores:", error)
      return new Response("Erro ao buscar stores", { status: 500 })
    }

    if (!stores || stores.length === 0) {
      return new Response("Nenhuma loja encontrada", { status: 200 })
    }

    // 🔥 2. REGISTRA WEBHOOK PARA CADA LOJA
    for (const store of stores) {
      try {
        const res = await fetch(
          `https://api.nuvemshop.com.br/v1/${store.user_id}/webhooks`,
          {
            method: "POST",
            headers: {
              Authentication: `bearer ${store.access_token}`,
              "Content-Type": "application/json",
              "User-Agent": "Phandshop/1.0 (contato@phand.com.br)",
            },
            body: JSON.stringify({
              event: "orders/created",
              url: "https://modapink.phand.com.br/api/nuvemshop/webhook",
            }),
          }
        )

        const data = await res.json()

        console.log(`✅ Webhook criado para loja ${store.store_id}:`, data)

      } catch (err) {
        console.error(`❌ Erro ao registrar webhook da loja ${store.store_id}:`, err)
      }
    }

    return new Response("Webhooks registrados com sucesso 🚀", {
      status: 200,
    })

  } catch (err) {
    console.error("Erro geral:", err)

    return new Response("Erro interno", { status: 500 })
  }
}