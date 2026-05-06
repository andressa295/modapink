import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const WEBHOOK_URL =
  "https://modapink.phand.com.br/api/nuvemshop/webhook"

export async function POST() {
  try {
    // =====================================================
    // BUSCA STORES
    // =====================================================
    const { data: stores, error } = await supabase
      .from("stores")
      .select("*")

    if (error) {
      console.error(
        "❌ erro buscar stores:",
        error
      )

      return new Response(
        "Erro ao buscar stores",
        {
          status: 500
        }
      )
    }

    if (!stores || stores.length === 0) {
      return new Response(
        "Nenhuma loja encontrada",
        {
          status: 200
        }
      )
    }

    const results: any[] = []

    // =====================================================
    // LOOP STORES
    // =====================================================
    for (const store of stores) {
      try {
        if (
          !store.access_token ||
          !store.user_id
        ) {
          console.warn(
            "⚠️ loja sem credenciais:",
            store.id
          )

          results.push({
            store: store.id,
            success: false,
            reason: "sem credenciais"
          })

          continue
        }

        // =====================================================
        // EVENTOS
        // =====================================================
        const events = [
          "orders/created",
          "orders/updated",
          "products/created",
          "products/updated"
        ]

        for (const event of events) {
          try {
            // =====================================================
            // VERIFICA EXISTENTE
            // =====================================================
            const existingRes = await fetch(
              `https://api.nuvemshop.com.br/v1/${store.user_id}/webhooks`,
              {
                method: "GET",
                headers: {
                  Authentication: `bearer ${store.access_token}`,
                  "Content-Type":
                    "application/json",

                  "User-Agent":
                    "Phandshop/1.0 (contato@phand.com.br)",
                }
              }
            )

            if (!existingRes.ok) {
              console.error(
                "❌ erro listar webhooks:",
                store.id
              )

              continue
            }

            const existingHooks =
              await existingRes.json()

            const alreadyExists =
              Array.isArray(existingHooks) &&
              existingHooks.some(
                (hook: any) =>
                  hook.event === event &&
                  hook.url === WEBHOOK_URL
              )

            // =====================================================
            // IGNORA DUPLICADO
            // =====================================================
            if (alreadyExists) {
              console.log(
                `⚠️ webhook já existe: ${event}`
              )

              results.push({
                store: store.store_id,
                event,
                success: true,
                skipped: true
              })

              continue
            }

            // =====================================================
            // CRIA WEBHOOK
            // =====================================================
            const res = await fetch(
              `https://api.nuvemshop.com.br/v1/${store.user_id}/webhooks`,
              {
                method: "POST",

                headers: {
                  Authentication: `bearer ${store.access_token}`,

                  "Content-Type":
                    "application/json",

                  "User-Agent":
                    "Phandshop/1.0 (contato@phand.com.br)",
                },

                body: JSON.stringify({
                  event,
                  url: WEBHOOK_URL,
                }),
              }
            )

            const data = await res.json()

            if (!res.ok) {
              console.error(
                `❌ erro webhook ${event}:`,
                data
              )

              results.push({
                store: store.store_id,
                event,
                success: false,
                error: data
              })

              continue
            }

            console.log(
              `✅ webhook criado: ${event}`
            )

            results.push({
              store: store.store_id,
              event,
              success: true,
              webhook_id: data.id
            })

          } catch (eventError) {
            console.error(
              `❌ erro evento ${event}:`,
              eventError
            )

            results.push({
              store: store.store_id,
              event,
              success: false
            })
          }
        }

      } catch (storeError) {
        console.error(
          `❌ erro loja ${store.store_id}:`,
          storeError
        )

        results.push({
          store: store.store_id,
          success: false
        })
      }
    }

    // =====================================================
    // RETORNO
    // =====================================================
    return Response.json({
      success: true,
      total_stores: stores.length,
      webhook_url: WEBHOOK_URL,
      results
    })

  } catch (err) {
    console.error("💥 erro geral:", err)

    return new Response(
      "Erro interno",
      {
        status: 500
      }
    )
  }
}