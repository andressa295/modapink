import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const PAGE_SIZE = 100
const DEFAULT_PAGES = 5
const MAX_PAGES = 8
const UPSERT_BATCH = 100

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

function customerName(order: any) {
  const customer = order.customer || {}
  const fullName = [customer.first_name, customer.last_name]
    .filter(Boolean)
    .join(" ")

  return (
    customer.name ||
    fullName ||
    order.billing_address?.name ||
    order.shipping_address?.name ||
    "Cliente"
  )
}

function customerPhone(order: any) {
  return String(
    order.customer?.phone ||
    order.contact_phone ||
    order.billing_address?.phone ||
    order.shipping_address?.phone ||
    ""
  ).replace(/\D/g, "")
}

function customerEmail(order: any) {
  return String(
    order.customer?.email ||
    order.contact_email ||
    order.billing_address?.email ||
    ""
  )
}

function shippingMethod(order: any) {
  return String(
    order.shipping_option ||
    order.shipping_option_reference ||
    order.shipping_method ||
    (order.shipping_address ? "Entrega" : "Retirada")
  )
}

function paymentMethod(order: any) {
  return String(
    order.gateway_name ||
    order.payment_details?.method ||
    order.payment_details?.type ||
    order.payment_method ||
    order.payment_provider ||
    "unknown"
  )
}

function orderAddress(order: any) {
  return [
    order.shipping_address?.address,
    order.shipping_address?.number,
    order.shipping_address?.city,
    order.shipping_address?.province,
    order.shipping_address?.zipcode
  ]
    .filter(Boolean)
    .join(", ")
}

function orderItems(order: any) {
  return (Array.isArray(order.products) ? order.products : []).map(
    (product: any) => ({
      id: product.id,
      name: product.name,
      quantity: Number(product.quantity) || 0,
      price: Number(product.price) || 0,
      image:
        product.image?.src ||
        product.images?.[0]?.src ||
        null,
      raw: product
    })
  )
}

async function fetchStoreOrders(
  storeId: string | number,
  accessToken: string,
  pages: number
) {
  const orders: any[] = []

  for (let page = 1; page <= pages; page += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)

    try {
      const response = await fetch(
        `https://api.nuvemshop.com.br/v1/${storeId}/orders?page=${page}&per_page=${PAGE_SIZE}`,
        {
          headers: {
            Authentication: `bearer ${accessToken}`,
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
          `Nuvemshop ${response.status}: ${body.slice(0, 180)}`
        )
      }

      const batch = await response.json()

      if (!Array.isArray(batch)) {
        throw new Error("A Nuvemshop retornou pedidos em formato inválido.")
      }

      orders.push(...batch)

      if (batch.length < PAGE_SIZE) break
    } finally {
      clearTimeout(timeout)
    }
  }

  return orders
}

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return Response.json(
        { error: "Configuração do Supabase ausente." },
        { status: 500 }
      )
    }

    const url = new URL(request.url)
    const pages = clamp(
      Number(url.searchParams.get("pages") || DEFAULT_PAGES) || DEFAULT_PAGES,
      1,
      MAX_PAGES
    )

    const supabase = createClient(supabaseUrl, serviceKey)
    const { data: stores, error: storesError } = await supabase
      .from("stores")
      .select("user_id,access_token")

    if (storesError) {
      return Response.json(
        {
          error: "Não foi possível acessar a loja conectada.",
          details: storesError.message
        },
        { status: 500 }
      )
    }

    const connectedStores = (stores || []).filter(
      (store: any) => store.user_id && store.access_token
    )

    if (connectedStores.length === 0) {
      return Response.json(
        { error: "Nenhuma loja Nuvemshop conectada foi encontrada." },
        { status: 404 }
      )
    }

    const results = await Promise.allSettled(
      connectedStores.map(async (store: any) => {
        return fetchStoreOrders(
          store.user_id,
          store.access_token,
          pages
        )
      })
    )

    const orders: any[] = []
    const failures: string[] = []

    for (const result of results) {
      if (result.status === "fulfilled") {
        orders.push(...result.value)
      } else {
        failures.push(
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason)
        )
      }
    }

    if (orders.length === 0) {
      return Response.json(
        {
          error: "Nenhum pedido foi recebido da Nuvemshop.",
          failures
        },
        { status: failures.length ? 502 : 404 }
      )
    }

    const uniqueOrders = Array.from(
      new Map(
        orders.map((order) => [String(order.id), order])
      ).values()
    )

    const rows = uniqueOrders.map((order: any) => ({
      external_id: String(order.id),
      order_number: Number(order.number) || null,
      customer_name: customerName(order),
      customer_email: customerEmail(order),
      customer_phone: customerPhone(order),
      payment_status: String(order.payment_status || "pending"),
      payment_method: paymentMethod(order),
      shipping_status: String(order.shipping_status || "pending"),
      shipping_method: shippingMethod(order),
      currency: String(order.currency || "BRL"),
      address: orderAddress(order),
      items: orderItems(order),
      raw: order,
      total: Number(order.total) || 0,
      created_at: order.created_at || new Date().toISOString()
    }))

    for (const batch of chunks(rows, UPSERT_BATCH)) {
      const { error } = await supabase
        .from("orders")
        .upsert(batch, { onConflict: "external_id" })

      if (error) {
        return Response.json(
          {
            error: "Os pedidos chegaram, mas o banco recusou a gravação.",
            details: error.message,
            attempted: rows.length
          },
          { status: 500 }
        )
      }
    }

    const paid = rows.filter((row) => {
      const status = row.payment_status.toLowerCase()
      return status === "paid" || status === "pago" || status.includes("pago")
    }).length

    return Response.json({
      ok: true,
      synced: rows.length,
      paid,
      stores: connectedStores.length,
      pages,
      failures
    })
  } catch (error) {
    console.error("Erro na sincronização segura do financeiro:", error)

    return Response.json(
      {
        error: "Não foi possível sincronizar os pedidos do financeiro.",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
