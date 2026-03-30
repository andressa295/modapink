// src/services/routing.service.ts

import { Channel } from "../types"

// =======================
// DETECTAR CANAL (INTELIGENTE)
// =======================
export function detectChannel(text: string): Channel {
  const t = text.toLowerCase()

  if (t.includes("comprar") || t.includes("preço")) return "VENDAS"
  if (t.includes("boleto") || t.includes("pagamento")) return "FINANCEIRO"

  return "SAC"
}

// =======================
// ROTEAMENTO (DECISÃO)
// =======================
export async function handleRouting(
  session: any,
  conv: any,
  text: string
): Promise<boolean> {
  // =======================
  // SAC
  // =======================
  if (text === "1" || text.includes("sac")) {
    await session.client.sendMessage(
      conv.contact,
      "🛠 SAC selecionado.\nFale com um atendente:\nhttps://wa.me/5511999999999"
    )

    conv.channel = "SAC"
    return true
  }

  // =======================
  // VENDAS
  // =======================
  if (text === "2" || text.includes("vendas")) {
    await session.client.sendMessage(
      conv.contact,
      "💰 Vendas selecionado.\nFale com nosso time:\nhttps://wa.me/5511888888888"
    )

    conv.channel = "VENDAS"
    return true
  }

  // =======================
  // FINANCEIRO
  // =======================
  if (text === "3" || text.includes("financeiro")) {
    await session.client.sendMessage(
      conv.contact,
      "💳 Financeiro selecionado.\nAtendimento:\nhttps://wa.me/5511777777777"
    )

    conv.channel = "FINANCEIRO"
    return true
  }

  // =======================
  // NÃO TRATADO
  // =======================
  return false
}