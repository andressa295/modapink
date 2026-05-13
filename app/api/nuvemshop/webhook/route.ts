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

// =====================================================
// STATUS MAPPER
// =====================================================
function mapPaymentStatus(
  status: string
) {

  switch (
    String(status || "")
      .toLowerCase()
  ) {

    case "authorized":

    case "paid":

      return "Pago"

    case "pending":

      return "Aguardando pagamento"

    case "refunded":

      return "Reembolsado"

    case "cancelled":

      return "Cancelado"

    default:

      return status || "Pendente"
  }
}

function mapShippingStatus(
  status: string
) {

  switch (
    String(status || "")
      .toLowerCase()
  ) {

    case "shipped":

      return "Enviado"

    case "ready_to_pick":

      return "Pronto para retirada"

    case "delivered":

      return "Entregue"

    case "pending":

      return "Separando pedido"

    default:

      return status || "Pendente"
  }
}

// =====================================================
// WEBHOOK
// =====================================================
export async function POST(
  req: NextRequest
) {

  try {

    // =====================================================
    // BODY
    // =====================================================
    const body =
      await req.json()

    // =====================================================
    // EVENT
    // =====================================================
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

      event !== "orders/created"

      &&

      event !== "orders/updated"

    ) {

      console.log(
        "⚠️ evento ignorado"
      )

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
    // STORE USER ID
    // =====================================================
    const storeUserId =

      req.headers.get("x-store-id")

      ||

      order.store_id

      ||

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
    // STORE
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
    // PHONE
    // =====================================================
    const phoneRaw =

      order.customer?.phone

      ||

      order.contact_phone

      ||

      order.billing_address?.phone

      ||

      order.shipping_address?.phone

      ||

      ""

    const phone =
      normalizePhone(phoneRaw)

    console.log(
      "📱 PHONE:",
      {
        raw: phoneRaw,
        normalized: phone
      }
    )

    // =====================================================
    // CONVERSATION
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
    // ITEMS
    // =====================================================
    const items =
      (order.products || [])
        .map((p: any) => ({

          id:
            p.id,

          name:
            p.name,

          quantity:
            p.quantity,

          price:
            Number(p.price) || 0,

          image:

            p.image?.src

            ||

            p.images?.[0]?.src

            ||

            null,

          raw:
            p

        }))

    // =====================================================
    // ADDRESS
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
    // MAPPED
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

        order.customer?.name

        ||

        order.billing_address?.name

        ||

        "Cliente",

      customer_email:
        order.customer?.email || "",

      customer_phone:
        phone,

      payment_status:
        mapPaymentStatus(
          order.payment_status
        ),

      payment_method:

        order.gateway_name

        ||

        order.payment_details?.method

        ||

        "unknown",

      shipping_status:
        mapShippingStatus(
          order.shipping_status
        ),

      shipping_method:

        order.shipping_option

        ||

        (
          order.shipping_address
            ? "Entrega"
            : "Retirada"
        ),

      tracking_number:

        order.shipping_tracking_number

        ||

        order.tracking_number

        ||

        null,

      tracking_url:

        order.shipping_tracking_url

        ||

        null,

      total:
        Number(order.total) || 0,

      subtotal:
        Number(order.subtotal) || 0,

      currency:
        order.currency || "BRL",

      address,

      items,

      raw:
        order,

      raw_products:
        order.products || [],

      created_at:

        order.created_at

        ||

        new Date()
          .toISOString(),

      updated_at:
        new Date()
          .toISOString(),

    }

    // =====================================================
    // UPSERT
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

    // =====================================================
    // ERROR
    // =====================================================
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
    // FUTURO WHATSAPP
    // =====================================================
    /*
    await sendWhatsAppMessage({

      phone,

      message:
        \`Pedido #${order.number} recebido com sucesso 💖\`

    })
    */

    // =====================================================
    // RESPONSE
    // =====================================================
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