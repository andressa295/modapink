// src/services/automation.service.ts

import { runBot } from "./bot.service"
import { handleRouting } from "./routing.service"
import { getOrdersByPhone } from "./nuvemshop.service"
import { checkForRating } from "./rating.service"

// =======================
// NORMALIZAR TELEFONE
// =======================
function normalizePhone(phone: string) {
  return phone.replace("@c.us", "").replace(/\D/g, "")
}

// =======================
// AUTOMAÇÃO PRINCIPAL
// =======================
export async function runAutomation(session: any, conv: any, msg: any) {
  const text = msg.body?.toLowerCase()
  if (!text) return

  const phone = normalizePhone(conv.contact)

  // =======================
  // 1. BOT (MENU / RESPOSTAS)
  // =======================
  const handledByBot = await runBot(session, conv, text)
  if (handledByBot) return

  // =======================
  // 2. CONSULTA PEDIDO (NUVEMSHOP)
  // =======================
  if (
    text.includes("pedido") ||
    text.includes("compra") ||
    text.includes("entrega")
  ) {
    try {
      const orders = await getOrdersByPhone(phone)

      if (!orders || orders.length === 0) {
        await session.client.sendMessage(
          conv.contact,
          "Não encontrei nenhum pedido com esse número 😕"
        )
        return
      }

      const lastOrder = orders[0]

      // 🔥 salva contexto
      conv.lastOrderId = lastOrder.id
      conv.lastOrderStatus = lastOrder.status

      await session.client.sendMessage(
        conv.contact,
        `📦 Pedido #${lastOrder.number}\nStatus: ${lastOrder.status}`
      )

      return
    } catch (err) {
      console.error("Erro Nuvemshop:", err)
    }
  }

  // =======================
  // 3. ROTEAMENTO
  // =======================
  const routed = await handleRouting(session, conv, text)
  if (routed) return

  // =======================
  // 4. FALLBACK (NÃO ENTENDI)
  // =======================
  await session.client.sendMessage(
    conv.contact,
    "Não entendi 🤔\nDigite *menu* para ver as opções."
  )

  // =======================
  // 5. AVALIAÇÃO (24H)
  // =======================
  const shouldRate = checkForRating(conv)

  if (shouldRate) {
    await session.client.sendMessage(
      conv.contact,
      "⭐ Como foi seu atendimento?\nResponda de 1 a 5."
    )
  }
}