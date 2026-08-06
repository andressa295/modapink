import { createClient } from "@supabase/supabase-js"
import { normalizePhone } from "../../../utils/phone"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const PAGE_SIZE = 100
const MAX_PAGES = 8
const UPSERT_BATCH = 100
const QUERY_BATCH = 100

type StoreRow = {
  id: string
  user_id: string | number
  access_token: string
}

type SessionRow = {
  store_id?: string | number | null
  phone?: string | null
  is_default?: boolean | null
  deleted_at?: string | null
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }

  return result
}

function storeSession(
  sessions: SessionRow[],
  store: StoreRow
) {
  const active = sessions.filter((session) => !session.deleted_at)
  const storeKeys = new Set([
    String(store.id),
    String(store.user_id)
  ])

  const matching = active.filter((session) => {
    return session.store_id != null &&
      storeKeys.has(String(session.store_id))
  })

  return (
    matching.find((session) => session.is_default) ||
    matching[0] ||
    active.find((session) => session.is_default) ||
    active[0] ||
    null
  )
}

async function fetchStoreOrders(
  store: StoreRow,
  firstPage: number,
  pageCount: number
) {
  const orders: any[] = []

  for (let offset = 0; offset < pageCount; offset += 1) {
    const page = firstPage + offset
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)

    try {
      const response = await fetch(
        `https://api.nuvemshop.com.br/v1/${store.user_id}/orders?page=${page}&per_page=${PAGE_SIZE}`,
        {
          method: "GET",
          headers: {
            Authentication: `bearer ${store.access_token}`,
            "User-Agent": "Phandshop (contato@phand.com.br)",
            "Content-Type": "application/json"
          },
          cache: "no-store",
          signal: controller.signal
        }
      )

      if (!response.ok) {
        const body = await response.text()
        throw new Error(
          `NUVEMSHOP_${response.status}:${body.slice(0, 180)}`
        )
      }

      const batch = await response.json()

      if (!Array.isArray(batch)) {
        throw new Error("A Nuvemshop retornou uma lista de pedidos inválida.")
      }

      orders.push(...batch)

      if (batch.length < PAGE_SIZE) break
    } finally {
      clearTimeout(timeout)
    }
  }

  return orders
}

function orderPhone(order: any) {
  return normalizePhone(
    order.customer?.phone ||
    order.contact_phone ||
    order.billing_address?.phone ||
    order.shipping_address?.phone ||
    ""
  )
}

function orderAddress(order: any) {
  return [
    order.shipping_address?.address,
    order.shipping_address?.number,
    order.shipping_address?.city,
    order.shipping_address?.province
  ]
    .filter(Boolean)
    .join(", ")
}

function orderItems(order: any) {
  return (order.products || []).map((product: any) => ({
    id: product.id,
    name: product.name,
    quantity: product.quantity,
    price: Number(product.price) || 0,
    image:
      product.image?.src ||
      product.images?.[0]?.src ||
      null,
    raw: product
  }))
}

export async function GET(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return Response.json(
        { error: "Configuração do Supabase ausente." },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const { searchParams } = new URL(req.url)
    const firstPage = clamp(
      Number(searchParams.get("page") || 1) || 1,
      1,
      10_000
    )
    const pageCount = clamp(
      Number(searchParams.get("pages") || 1) || 1,
      1,
      MAX_PAGES
    )
    const syncOnly = searchParams.get("sync_only") === "1"

    const [storesResult, sessionsResult] = await Promise.all([
      supabase
        .from("stores")
        .select("id,user_id,access_token"),
      supabase
        .from("whatsapp_sessions")
        .select("store_id,phone,is_default,deleted_at")
    ])

    if (storesResult.error) {
      console.error("Erro ao buscar lojas:", storesResult.error)
      return Response.json(
        { error: "Não foi possível acessar a loja conectada." },
        { status: 500 }
      )
    }

    const stores = (storesResult.data || [])
      .filter((store: any) => store.user_id && store.access_token) as StoreRow[]
    const sessions = (sessionsResult.data || []) as SessionRow[]

    if (stores.length === 0) {
      return syncOnly
        ? Response.json({ ok: true, synced: 0, stores: 0, failures: [] })
        : Response.json([])
    }

    const fetched = await Promise.allSettled(
      stores.map(async (store) => ({
        store,
        orders: await fetchStoreOrders(store, firstPage, pageCount)
      }))
    )

    const failures: string[] = []
    const collected: Array<{ store: StoreRow; order: any }> = []

    for (const result of fetched) {
      if (result.status === "rejected") {
        const message = result.reason instanceof Error
          ? result.reason.message
          : String(result.reason)

        console.error("Erro ao sincronizar loja:", message)
        failures.push(message)
        continue
      }

      for (const order of result.value.orders) {
        collected.push({
          store: result.value.store,
          order
        })
      }
    }

    if (collected.length === 0 && failures.length > 0) {
      return Response.json(
        {
          error: "A Nuvemshop não respondeu à sincronização dos pedidos.",
          failures
        },
        { status: 502 }
      )
    }

    const phones = Array.from(
      new Set(
        collected
          .map(({ order }) => orderPhone(order))
          .filter(Boolean)
      )
    )

    const conversationByPhone = new Map<string, string>()

    for (const phoneBatch of chunks(phones, QUERY_BATCH)) {
      const { data, error } = await supabase
        .from("conversations")
        .select("id,phone")
        .in("phone", phoneBatch)

      if (error) {
        console.warn(
          "Não foi possível relacionar todas as conversas aos pedidos:",
          error.message
        )
        break
      }

      for (const conversation of data || []) {
        if (conversation.phone) {
          conversationByPhone.set(
            normalizePhone(conversation.phone),
            conversation.id
          )
        }
      }
    }

    const mappedRows = collected.map(({ store, order }) => {
      const phone = orderPhone(order)
      const session = storeSession(sessions, store)
      const items = orderItems(order)

      return {
        external_id: String(order.id),
        order_number: order.number ?? null,
        store_id: store.id,
        conversation_id:
          (phone && conversationByPhone.get(phone)) ||
          null,
        customer_name:
          order.customer?.name ||
          order.billing_address?.name ||
          "Cliente",
        customer_email: order.customer?.email || "",
        customer_phone: phone,
        payment_status: order.payment_status || "pending",
        payment_method:
          order.gateway_name ||
          order.payment_details?.method ||
          order.payment_method ||
          "unknown",
        shipping_status: order.shipping_status || "pending",
        shipping_method:
          order.shipping_option ||
          order.shipping_option_reference ||
          order.shipping_method ||
          (order.shipping_address ? "Entrega" : "Retirada"),
        tracking_number:
          order.shipping_tracking_number ||
          order.tracking_number ||
          null,
        tracking_url: order.shipping_tracking_url || null,
        total: Number(order.total) || 0,
        subtotal: Number(order.subtotal) || 0,
        currency: order.currency || "BRL",
        address: orderAddress(order),
        items,
        raw: order,
        raw_products: order.products || [],
        whatsapp_number: session?.phone || null,
        created_at: order.created_at || new Date().toISOString(),
        updated_at:
          order.updated_at ||
          order.modified_at ||
          new Date().toISOString()
      }
    })

    for (const batch of chunks(mappedRows, UPSERT_BATCH)) {
      const { error } = await supabase
        .from("orders")
        .upsert(batch, {
          onConflict: "external_id"
        })

      if (error) {
        console.error("Erro ao salvar pedidos sincronizados:", error)
        return Response.json(
          {
            error: "Os pedidos foram encontrados, mas não puderam ser salvos.",
            details: error.message
          },
          { status: 500 }
        )
      }
    }

    if (syncOnly) {
      return Response.json({
        ok: true,
        synced: mappedRows.length,
        stores: stores.length,
        failures
      })
    }

    const responseRows = collected.map(({ store, order }) => {
      const phone = orderPhone(order)
      const session = storeSession(sessions, store)

      return {
        id: order.number,
        customer:
          order.customer?.name ||
          order.billing_address?.name ||
          "Cliente",
        phone,
        status: order.payment_status || "pending",
        shipping: order.shipping_status || "pending",
        total: Number(order.total) || 0,
        subtotal: Number(order.subtotal) || 0,
        date: order.created_at || new Date().toISOString(),
        payment_method:
          order.gateway_name ||
          order.payment_details?.method ||
          "unknown",
        shipping_method:
          order.shipping_option ||
          order.shipping_option_reference ||
          order.shipping_method ||
          (order.shipping_address ? "Entrega" : "Retirada"),
        whatsapp_number: session?.phone || null,
        items: orderItems(order)
      }
    })

    responseRows.sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })

    return Response.json(responseRows)
  } catch (error) {
    console.error("Erro geral ao sincronizar pedidos:", error)

    return Response.json(
      { error: "Não foi possível sincronizar os pedidos." },
      { status: 500 }
    )
  }
}
