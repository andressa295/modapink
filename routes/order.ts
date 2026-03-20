import { Router } from "express"
import { getOrderByNumber } from "../services/nuvemshop"

const router = Router()

router.get("/:number", async (req, res) => {
  const { number } = req.params

  try {
    const orders = await getOrderByNumber(number)

    if (!orders || orders.length === 0) {
      return res.json({ error: "Pedido não encontrado" })
    }

    const order = orders[0]

    return res.json({
      number: order.number,
      status: order.status,
      payment_status: order.payment_status,
      total: order.total,
      customer: order.customer?.name,
      products: order.products,
      shipping: order.shipping_address,
    })
  } catch (error) {
    return res.status(500).json({ error: "Erro interno" })
  }
})

export default router