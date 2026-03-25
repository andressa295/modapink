export type OrderResponse = {
  id: string
  customerName: string
  phone: string

  status: string
  shipping: string

  // 🔥 NOVOS CAMPOS
  payment_method?: string | null
  shipping_method?: string | null
}

export async function fetchOrder(orderId: string): Promise<OrderResponse | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(
      `https://seusite.com/api/orders/${orderId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        },
        signal: controller.signal
      }
    )

    clearTimeout(timeout)

    if (!res.ok) {
      throw new Error(`Erro HTTP: ${res.status}`)
    }

    const data = await res.json()

    // 🔥 NORMALIZAÇÃO (ANTI-BUG)
    const normalized: OrderResponse = {
      id: String(data.id),

      customerName:
        data.customerName ||
        data.customer_name ||
        "Cliente",

      phone:
        data.phone ||
        data.customer_phone ||
        "Sem telefone",

      status:
        data.status ||
        data.payment_status ||
        "pending",

      shipping:
        data.shipping ||
        data.shipping_status ||
        "pending",

      payment_method:
        data.payment_method ||
        data.gateway_name ||
        null,

      shipping_method:
        data.shipping_method ||
        data.shipping_option ||
        null,
    }

    return normalized

  } catch (err: any) {
    if (err.name === "AbortError") {
      console.error("Timeout ao buscar pedido")
    } else {
      console.error("Erro ao buscar pedido:", err)
    }

    return null
  }
}