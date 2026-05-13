import { createClient } from "@supabase/supabase-js"

const supabase = createClient(

  process.env.NEXT_PUBLIC_SUPABASE_URL!,

  process.env.SUPABASE_SERVICE_ROLE_KEY!

)

const WEBHOOK_URL =
  "https://api.modapink.phand.com.br/nuvemshop/webhook"

export async function POST() {

  try {

    // =====================================================
    // BUSCA STORES
    // =====================================================
    const {
      data: stores,
      error
    } = await supabase

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

    // =====================================================
    // SEM STORES
    // =====================================================
    if (

      !stores ||

      stores.length === 0

    ) {

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

        // =====================================================
        // VALIDAÇÕES
        // =====================================================
        if (

          !store.access_token ||

          !store.user_id

        ) {

          console.warn(
            "⚠️ loja sem credenciais:",
            store.id
          )

          results.push({

            store:
              store.id,

            success:
              false,

            reason:
              "sem credenciais"

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

        // =====================================================
        // LOOP EVENTOS
        // =====================================================
        for (const event of events) {

          try {

            // =====================================================
            // LISTA WEBHOOKS
            // =====================================================
            const existingRes =
              await fetch(

                `https://api.nuvemshop.com.br/v1/${store.user_id}/webhooks`,

                {

                  method: "GET",

                  headers: {

                    Authorization:
                      `Bearer ${store.access_token}`,

                    "Content-Type":
                      "application/json",

                    "User-Agent":
                      "Phandshop/1.0 (contato@phand.com.br)"

                  }

                }
              )

            // =====================================================
            // ERRO LISTAGEM
            // =====================================================
            if (!existingRes.ok) {

              const errorText =
                await existingRes.text()

              console.error(
                "❌ erro listar webhooks:",
                {
                  store: store.id,
                  error: errorText
                }
              )

              continue
            }

            const existingHooks =
              await existingRes.json()

            // =====================================================
            // EXISTE?
            // =====================================================
            const alreadyExists =

              Array.isArray(existingHooks)

              &&

              existingHooks.some(

                (hook: any) =>

                  hook.event === event

                  &&

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

                store:
                  store.store_id,

                event,

                success:
                  true,

                skipped:
                  true

              })

              continue
            }

            // =====================================================
            // CRIA WEBHOOK
            // =====================================================
            const res =
              await fetch(

                `https://api.nuvemshop.com.br/v1/${store.user_id}/webhooks`,

                {

                  method: "POST",

                  headers: {

                    Authorization:
                      `Bearer ${store.access_token}`,

                    "Content-Type":
                      "application/json",

                    "User-Agent":
                      "Phandshop/1.0 (contato@phand.com.br)"

                  },

                  body: JSON.stringify({

                    event,

                    url:
                      WEBHOOK_URL

                  })

                }
              )

            const data =
              await res.json()

            // =====================================================
            // ERRO WEBHOOK
            // =====================================================
            if (!res.ok) {

              console.error(
                `❌ erro webhook ${event}:`,
                data
              )

              results.push({

                store:
                  store.store_id,

                event,

                success:
                  false,

                error:
                  data

              })

              continue
            }

            // =====================================================
            // OK
            // =====================================================
            console.log(
              `✅ webhook criado: ${event}`
            )

            results.push({

              store:
                store.store_id,

              event,

              success:
                true,

              webhook_id:
                data.id

            })

          } catch (eventError) {

            console.error(
              `❌ erro evento ${event}:`,
              eventError
            )

            results.push({

              store:
                store.store_id,

              event,

              success:
                false

            })
          }
        }

      } catch (storeError) {

        console.error(
          `❌ erro loja ${store.store_id}:`,
          storeError
        )

        results.push({

          store:
            store.store_id,

          success:
            false

        })
      }
    }

    // =====================================================
    // RETORNO
    // =====================================================
    return Response.json({

      success:
        true,

      total_stores:
        stores.length,

      webhook_url:
        WEBHOOK_URL,

      results

    })

  } catch (err) {

    console.error(
      "💥 erro geral:",
      err
    )

    return new Response(

      "Erro interno",

      {
        status: 500
      }

    )
  }
}