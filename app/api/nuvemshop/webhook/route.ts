import { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { normalizePhone } from "@/utils/phone"

// =====================================================
// ENV
// =====================================================
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {

  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL ausente"
  )
}

if (!supabaseKey) {

  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY ausente"
  )
}

// =====================================================
// SUPABASE
// =====================================================
const supabase = createClient(
  supabaseUrl,
  supabaseKey
)

export async function POST(
  req: NextRequest
) {

  try {

    const body =
      await req.json()

    const event =
      req.headers.get("x-topic")

    console.log(
      "🔥 webhook recebido:",
      event
    )

    // =====================================================
    // SOMENTE PEDIDOS
    // =====================================================
    if (

      event !== "orders/created" &&

      event !== "orders/updated"

    ) {

      return new Response(
        "evento ignorado",
        {
          status: 200
        }
      )
    }

    // =====================================================
    // PEDIDO
    // =====================================================
    const order = body

    console.log(
      "🛒 pedido:",
      order.id
    )

    // =====================================================
    // STORE ID
    // =====================================================
    const storeUserId =

      req.headers.get("x-store-id") ||

      order.store_id ||

      order.store?.id

    if (!storeUserId) {

      console.error(
        "❌ store id não encontrado"
      )

      return new Response(
        "store não encontrada",
        {
          status: 400
        }
      )
    }

    // =====================================================
    // BUSCA STORE
    // =====================================================
    const {

      data: store,

      error: storeError

    } = await supabase
      .from("stores")
      .select("*")
      .eq(
        "user_id",
        String(storeUserId)
      )
      .maybeSingle()

    if (
      storeError ||
      !store
    ) {

      console.error(
        "❌ erro store:",
        storeError
      )

      return new Response(
        "store error",
        {
          status: 400
        }
      )
    }

    // =====================================================
    // TELEFONE
    // =====================================================
    const phoneRaw =

      order.customer?.phone ||

      order.contact_phone ||

      order.billing_address?.phone ||

      order.shipping_address?.phone ||

      ""

    const phone =
      normalizePhone(phoneRaw)

    // =====================================================
    // CONVERSA
    // =====================================================
    let conversationId =
      null

    if (phone) {

      const {
        data: conversation
      } = await supabase
        .from("conversations")
        .select("id")
        .eq(
          "phone",
          phone
        )
        .maybeSingle()

      conversationId =
        conversation?.id || null
    }

    // =====================================================
    // PRODUTOS
    // =====================================================
    const items =
      (order.products || []).map(
        (p: any) => ({

          id: p.id,

          name: p.name,

          quantity:
            p.quantity,

          price:
            Number(p.price) || 0,

          image:

            p.image?.src ||

            p.images?.[0]?.src ||

            null,

          raw: p
        })
      )

    // =====================================================
    // ENDEREÇO
    // =====================================================
    const address = [

      order.shipping_address?.address,

      order.shipping_address?.number,

      order.shipping_address?.city,

      order.shipping_address?.province,

    ]
      .filter(Boolean)
      .join(", ")

    // =====================================================
    // MAPEAMENTO
    // =====================================================
    const mapped = {

      external_id:
        String(order.id),

      order_number:
        order.number,

      store_id:
        store.id,

      conversation_id:
        conversationId,

      customer_name:

        order.customer?.name ||

        order.billing_address?.name ||

        "Cliente",

      customer_email:
        order.customer?.email || "",

      customer_phone:
        phone,

      payment_status:

        order.payment_status ||

        "pending",

      payment_method:

        order.gateway_name ||

        order.payment_details?.method ||

        "unknown",

      shipping_status:

        order.shipping_status ||

        "pending",

      shipping_method:

        order.shipping_option ||

        (
          order.shipping_address
            ? "Entrega"
            : "Retirada"
        ),

      total:
        Number(order.total) || 0,

      subtotal:
        Number(order.subtotal) || 0,

      currency:
        order.currency || "BRL",

      address,

      items,

      raw: order,

      raw_products:
        order.products || [],

      created_at:

        order.created_at ||

        new Date().toISOString(),

      updated_at:
        new Date().toISOString(),
    }

    // =====================================================
    // UPSERT PEDIDO
    // =====================================================
    const {
      error: upsertError
    } = await supabase
      .from("orders")
      .upsert(
        mapped,
        {
          onConflict:
            "store_id,external_id"
        }
      )

    if (upsertError) {

      console.error(
        "❌ erro upsert:",
        upsertError
      )

      return new Response(
        "erro banco",
        {
          status: 500
        }
      )
    }

    console.log(
      "✅ pedido sincronizado:",
      order.id
    )

    // =====================================================
    // WHATSAPP FUTURO
    // =====================================================
    /*
    await sendWhatsAppMessage({
      phone,
      message:
        `Pedido #${order.number} recebido com sucesso 💜`
    })
    */

    return new Response(
      "ok",
      {
        status: 200
      }
    )

  } catch (err) {

    console.error(
      "💥 erro webhook:",
      err
    )

    return new Response(
      "erro",
      {
        status: 500
      }
    )
  }
}