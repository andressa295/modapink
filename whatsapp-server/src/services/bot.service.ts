// services/bot.service.ts

export async function runBot(session: any, conv: any, text: string) {
  if (text === "menu") {
    await session.client.sendMessage(
      conv.contact,
      "Digite:\n1 - SAC\n2 - Vendas\n3 - Financeiro"
    )
    return true
  }

  if (text === "oi" || text === "olá") {
    await session.client.sendMessage(
      conv.contact,
      "Olá! Digite 'menu' para começar."
    )
    return true
  }

  return false
}