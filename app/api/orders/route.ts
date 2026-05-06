import { createClient } from "@supabase/supabase-js"
import { normalizePhone } from "../../../utils/phone"

export async function GET(req: Request) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { searchParams } = new URL(req.url)

    const page = Number(searchParams.get("page") || 1)
    const limit = 100

    // ========================
    // 🏪 LOJAS
    // ========================
    const { data: stores, error: storeError } = await supabase
      .from("stores")
      .select("*")

    if (storeError || !stores) {
      console.error("❌ erro lojas:", storeError)
      return Response.json([])
    }

    // ========================
    // 📲 SESSÕES
    // ========================
    const { data: sessions } = await supabase
      .from("whatsapp_sessions")
      .select("*")

    function getSessionForStore(storeId: string) {
      const storeSessions =
        sessions?.filter((s) => s.store_id === storeId) || []

      if (storeSessions.length === 0) {
        return sessions?.find((s) => s.is_default) || null
      }

      return (
        storeSessions.find((s) => s.is_default) ||
        storeSessions[0]
      )
    }

    const allOrders: any[] = []

    // ========================
    // 🔄 LOOP NAS LOJAS
    // ========================
    for (const store of stores) {
      try {
        if (!store.access_token || !store.user_id) {
          console.warn("⚠️ loja sem credenciais:", store.id)
          continue
        }

        const controller = new AbortController()

        const timeout = setTimeout(() => {
          controller.abort()
        }, 15000)

        const res = await fetch(
          `https://api.nuvemshop.com.br/v1/${store.user_id}/orders?page=${page}&per_page=${limit}`,
          {
            method: "GET",
            headers: {
              Authentication: `bearer ${store.access_token}`,
              "User-Agent": "Phandshop (contato@phand.com.br)",
              "Content-Type": "application/json"
            },
            signal: controller.signal
          }
        )

        clearTimeout(timeout)

        if (!res.ok) {
          const errorText = await res.text()

          console.error("❌ erro nuvemshop:", {
            store: store.id,
            status: res.status,
            error: errorText
          })

          continue
        }

        const orders = await res.json()

        if (!Array.isArray(orders)) {
          console.error("❌ resposta inválida:", store.id)
          continue
        }

        // ========================
        // 🔄 LOOP PEDIDOS
        // ========================
        for (const o of orders) {
          try {
            // ========================
            // 📞 TELEFONE
            // ========================
            const phoneRaw =
              o.customer?.phone ||
              o.contact_phone ||
              o.billing_address?.phone ||
              o.shipping_address?.phone ||
              ""

            const phone = normalizePhone(phoneRaw)

            if (!phone) {
              console.warn(
                "⚠️ pedido sem telefone:",
                o.id
              )
              continue
            }

            // ========================
            // 📲 SESSÃO
            // ========================
            const session = getSessionForStore(store.id)

            const whatsappNumber =
              session?.phone || null

            // ========================
            // 💬 CONVERSA
            // ========================
            const { data: conversation } = await supabase
              .from("conversations")
              .select("id")
              .eq("phone", phone)
              .maybeSingle()

            // ========================
            // 📦 PRODUTOS
            // ========================
            const items = (o.products || []).map(
              (p: any) => ({
                id: p.id,
                name: p.name,
                quantity: p.quantity,
                price: Number(p.price) || 0,

                image:
                  p.image?.src ||
                  p.images?.[0]?.src ||
                  null,

                raw: p
              })
            )

            // ========================
            // 📍 ENDEREÇO
            // ========================
            const address = [
              o.shipping_address?.address,
              o.shipping_address?.number,
              o.shipping_address?.city,
              o.shipping_address?.province,
            ]
              .filter(Boolean)
              .join(", ")

            // ========================
            // 🧠 MAPEAMENTO
            // ========================
            const mapped = {
              external_id: String(o.id),

              order_number: o.number,

              store_id: store.id,

              conversation_id:
                conversation?.id || null,

              customer_name:
                o.customer?.name ||
                o.billing_address?.name ||
                "Cliente",

              customer_email:
                o.customer?.email || "",

              customer_phone: phone,

              payment_status:
                o.payment_status || "pending",

              payment_method:
                o.gateway_name ||
                o.payment_details?.method ||
                "unknown",

              shipping_status:
                o.shipping_status || "pending",

              shipping_method:
                o.shipping_option ||
                (o.shipping_address
                  ? "Entrega"
                  : "Retirada"),

              total: Number(o.total) || 0,

              subtotal:
                Number(o.subtotal) || 0,

              currency:
                o.currency || "BRL",

              address,

              items,

              raw: o,

              raw_products:
                o.products || [],

              whatsapp_number:
                whatsappNumber,

              created_at:
                o.created_at ||
                new Date().toISOString(),

              updated_at:
                new Date().toISOString(),
            }

            // ========================
            // 📤 FRONT
            // ========================
            allOrders.push({
              id: o.number,

              customer:
                mapped.customer_name,

              phone,

              status:
                mapped.payment_status,

              shipping:
                mapped.shipping_status,

              total: mapped.total,

              subtotal:
                mapped.subtotal,

              date: mapped.created_at,

              payment_method:
                mapped.payment_method,

              shipping_method:
                mapped.shipping_method,

              whatsapp_number:
                whatsappNumber,

              items
            })

            // ========================
            // 💾 UPSERT
            // ========================
            const { error: upsertError } =
              await supabase
                .from("orders")
                .upsert(mapped, {
                  onConflict:
                    "store_id,external_id"
                })

            if (upsertError) {
              console.error(
                "❌ erro upsert:",
                {
                  order: o.id,
                  error: upsertError
                }
              )
            }

          } catch (orderError) {
            console.error(
              "❌ erro pedido:",
              o?.id,
              orderError
            )
          }
        }

      } catch (storeLoopError) {
        console.error(
          "❌ erro loja:",
          store.id,
          storeLoopError
        )
      }
    }

    // ========================
    // 📊 ORDENA MAIS RECENTES
    // ========================
    allOrders.sort((a, b) => {
      return (
        new Date(b.date).getTime() -
        new Date(a.date).getTime()
      )
    })

    return Response.json(allOrders)

  } catch (err) {
    console.error("💥 erro geral:", err)
    return Response.json([])
  }
}