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
    const limit = 20

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
      const storeSessions = sessions?.filter(s => s.store_id === storeId)

      if (!storeSessions || storeSessions.length === 0) {
        return sessions?.find(s => s.is_default) || null
      }

      return storeSessions.find(s => s.is_default) || storeSessions[0]
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
        const timeout = setTimeout(() => controller.abort(), 8000)

        const res = await fetch(
          `https://api.nuvemshop.com.br/v1/${store.user_id}/orders?page=${page}&per_page=${limit}`,
          {
            headers: {
              Authorization: `Bearer ${store.access_token}`,
              "User-Agent": "Phandshop/1.0",
              "Content-Type": "application/json"
            },
            signal: controller.signal
          }
        )

        clearTimeout(timeout)

        if (!res.ok) {
          console.error("❌ erro nuvemshop:", await res.text())
          continue
        }

        const orders = await res.json()

        if (!Array.isArray(orders)) continue

        for (const o of orders) {
          const phoneRaw =
            o.customer?.phone ||
            o.contact_phone ||
            o.billing_address?.phone ||
            ""

          const phone = normalizePhone(phoneRaw)

          const session = getSessionForStore(store.id)
          const whatsappNumber = session?.phone || null

          const mapped = {
            external_id: o.id.toString(),
            order_number: o.number,
            store_id: store.id,

            customer_name: o.customer?.name || "Cliente",
            customer_email: o.customer?.email || "",
            customer_phone: phone,

            payment_status: o.payment_status || "pending",
            payment_method:
              o.gateway_name ||
              o.payment_details?.method ||
              "unknown",

            shipping_status: o.shipping_status || "pending",
            shipping_method:
              o.shipping_option ||
              (o.shipping_address ? "Entrega" : "Retirada"),

            total: Number(o.total) || 0,
            currency: o.currency || "BRL",

            address: [
              o.shipping_address?.address,
              o.shipping_address?.number,
              o.shipping_address?.city
            ]
              .filter(Boolean)
              .join(", "),

            items: (o.products || []).map((p: any) => ({
              name: p.name,
              quantity: p.quantity,
              price: Number(p.price),
            })),

            raw: o,
            whatsapp_number: whatsappNumber,

            created_at: o.created_at,
            updated_at: new Date().toISOString(),
          }

          // ========================
          // FRONT FORMAT
          // ========================
          allOrders.push({
            id: o.number,
            customer: mapped.customer_name,
            phone: phone,
            status: mapped.payment_status,
            shipping: mapped.shipping_status,
            total: mapped.total,
            date: o.created_at,
            payment_method: mapped.payment_method,
            shipping_method: mapped.shipping_method,
            whatsapp_number: whatsappNumber,
          })

          // ========================
          // UPSERT (SEM TRAVAR)
          // ========================
          const { error: upsertError } = await supabase
            .from("orders")
            .upsert(mapped, {
              onConflict: "external_id"
            })

          if (upsertError) {
            console.error("❌ erro upsert:", upsertError)
          }
        }

      } catch (err) {
        console.error("❌ erro loja:", store.id, err)
      }
    }

    return Response.json(allOrders)

  } catch (err) {
    console.error("💥 erro geral:", err)
    return Response.json([])
  }
}