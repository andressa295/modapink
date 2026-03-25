import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const page = Number(searchParams.get("page") || 1)
    const limit = 20

    // ========================
    // 🏪 LOJAS
    // ========================
    const { data: stores, error } = await supabase
      .from("stores")
      .select("*")

    if (error || !stores) {
      console.error("Erro ao buscar lojas:", error)
      return new Response("Erro ao buscar lojas", { status: 500 })
    }

    // ========================
    // 📲 SESSÕES WHATSAPP
    // ========================
    const { data: sessions } = await supabase
      .from("whatsapp_sessions")
      .select("*")

    function getSessionForStore(storeId: number) {
      const storeSessions = sessions?.filter(s => s.store_id === storeId)

      if (!storeSessions || storeSessions.length === 0) {
        return sessions?.find(s => s.is_default) || null
      }

      return storeSessions.find(s => s.is_default) || storeSessions[0]
    }

    let allOrders: any[] = []

    for (const store of stores) {
      try {
        const res = await fetch(
          `https://api.nuvemshop.com.br/v1/${store.user_id}/orders?page=${page}&per_page=${limit}`,
          {
            headers: {
              Authentication: `bearer ${store.access_token}`,
              "User-Agent": "Phandshop/1.0",
            },
          }
        )

        const orders = await res.json()
        if (!Array.isArray(orders)) continue

        for (const o of orders) {

          // ========================
          // 👤 CLIENTE
          // ========================
          const customerName = o.customer?.name || "Cliente não identificado"

          const customerPhone =
            o.customer?.phone ||
            o.contact_phone ||
            o.billing_address?.phone ||
            "Sem telefone"

          const customerEmail =
            o.customer?.email ||
            "Sem email"

          // ========================
          // 📍 ENDEREÇO
          // ========================
          const address = o.shipping_address || o.billing_address || {}

          const fullAddress = [
            address.address || "Rua não informada",
            address.number || "S/N",
            address.locality,
            address.city,
            address.province,
            address.zipcode,
          ]
            .filter(Boolean)
            .join(", ")

          // ========================
          // 💳 PAGAMENTO
          // ========================
          const paymentStatus = o.payment_status || "pending"

          const paymentMethod =
            o.gateway_name ||
            o.payment_details?.method ||
            "Não identificado"

          // ========================
          // 🚚 ENVIO
          // ========================
          const shippingStatus = o.shipping_status || "pending"

          let shippingMethod = o.shipping_option || ""

          if (!shippingMethod) {
            if (o.shipping_address) {
              shippingMethod = "Entrega"
            } else {
              shippingMethod = "Retirada na loja"
            }
          }

          // ========================
          // 🛒 ITENS
          // ========================
          const items = (o.products || []).map((p: any) => ({
            name: p.name,
            quantity: p.quantity,
            price: Number(p.price),
          }))

          // ========================
          // 📲 WHATSAPP (ROTEAMENTO)
          // ========================
          const session = getSessionForStore(store.store_id)
          const whatsappNumber = session?.phone || null

          // ========================
          // 💾 BANCO
          // ========================
          const mapped = {
            external_id: o.id.toString(),
            order_number: o.number,
            store_id: store.store_id,

            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhone,

            payment_status: paymentStatus,
            payment_method: paymentMethod,

            shipping_status: shippingStatus,
            shipping_method: shippingMethod,

            total: Number(o.total) || 0,
            currency: o.currency || "BRL",

            address: fullAddress,
            items,
            raw: o,

            whatsapp_number: whatsappNumber, // 🔥 NOVO

            created_at: o.created_at,
            updated_at: new Date().toISOString(),
          }

          // ========================
          // 📤 FRONTEND
          // ========================
          allOrders.push({
            id: o.number,
            customer: customerName,
            phone: customerPhone,

            status: paymentStatus,
            shipping: shippingStatus,

            total: Number(o.total) || 0,
            date: o.created_at,

            payment_method: paymentMethod,
            shipping_method: shippingMethod,

            whatsapp_number: whatsappNumber, // 🔥 ESSENCIAL
          })

          // ========================
          // 🔄 UPSERT
          // ========================
          await supabase.from("orders").upsert(mapped, {
            onConflict: "external_id",
          })
        }

      } catch (err) {
        console.error("Erro ao buscar pedidos:", err)
      }
    }

    return Response.json(allOrders)

  } catch (err) {
    console.error("Erro geral:", err)
    return new Response("Erro interno", { status: 500 })
  }
}