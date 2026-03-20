export type OrderResponse = {
  id: string
  customerName: string
  phone: string
  status: string
  shipping: string
}

export async function fetchOrder(orderId: string): Promise<OrderResponse | null> {
  try {
    const res = await fetch(`https://seusite.com/api/orders/${orderId}`)

    if (!res.ok) throw new Error("Erro ao buscar pedido")

    return await res.json()
  } catch (err) {
    console.error("Erro ao buscar pedido:", err)
    return null
  }
}