import axios from "axios"

// 🔒 ENV (isolado aqui dentro)
const STORE_ID = process.env.NUVEMSHOP_STORE_ID!
const ACCESS_TOKEN = process.env.NUVEMSHOP_ACCESS_TOKEN!

const api = axios.create({
  baseURL: `https://api.nuvemshop.com.br/v1/${STORE_ID}`,
  headers: {
    Authentication: `bearer ${ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  },
})

// 📦 Buscar pedido por número
export async function getOrderByNumber(orderNumber: string) {
  try {
    const response = await api.get("/orders", {
      params: {
        number: orderNumber,
      },
    })

    return response.data
  } catch (error: any) {
    console.error("❌ Erro ao buscar pedido:", error.response?.data || error.message)

    throw new Error("Erro ao buscar pedido na Nuvemshop")
  }
}

// 📦 Buscar pedido por ID
export async function getOrderById(orderId: number) {
  try {
    const response = await api.get(`/orders/${orderId}`)
    return response.data
  } catch (error: any) {
    console.error("❌ Erro ao buscar pedido por ID:", error.response?.data || error.message)
    throw new Error("Erro ao buscar pedido")
  }
}

// 📦 Listar pedidos recentes
export async function getRecentOrders(limit = 5) {
  try {
    const response = await api.get("/orders", {
      params: {
        page: 1,
        per_page: limit,
      },
    })

    return response.data
  } catch (error: any) {
    console.error("❌ Erro ao listar pedidos:", error.response?.data || error.message)
    throw new Error("Erro ao listar pedidos")
  }
}

// 📦 Formatar pedido (pra resposta do WhatsApp)
export function formatOrder(order: any) {
  const produtos = order.products
    ?.map((p: any) => `• ${p.name} (x${p.quantity})`)
    .join("\n")

  return `
📦 Pedido #${order.number}

👤 Cliente: ${order.customer?.name || "Não informado"}
💰 Total: R$ ${order.total}
📌 Status: ${order.status}
💳 Pagamento: ${order.payment_status}

🛍️ Produtos:
${produtos || "Nenhum produto"}
`
}