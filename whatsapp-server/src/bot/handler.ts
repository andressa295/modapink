import { interpretarMensagem, gerarResposta } from "../services/openai"
import { getOrderByNumber, formatOrder } from "../services/nuvemshop"

export async function handleMessage(message: any) {
  try {
    if (message.fromMe) return
    if (message.from.includes("@g.us")) return

    const text = message.body?.trim()
    if (!text) return

    console.log("📩 Mensagem:", text)

    const aiRaw = await interpretarMensagem(text)

    let ai
    try {
      ai = JSON.parse(aiRaw)
    } catch {
      await message.reply("Não entendi 😕 Pode reformular?")
      return
    }

    // 📦 Pedido
    if (ai.tipo === "pedido" && ai.pedidoNumero) {
      const orders = await getOrderByNumber(ai.pedidoNumero)

      if (!orders || orders.length === 0) {
        await message.reply("❌ Pedido não encontrado.")
        return
      }

      const order = orders[0]
      await message.reply(formatOrder(order))
      return
    }

    // 💬 Resposta padrão IA
    const resposta = await gerarResposta(text)
    await message.reply(resposta)

  } catch (error) {
    console.error("❌ Erro no handler:", error)

    await message.reply(
      "⚠️ Tive um problema aqui. Tente novamente em instantes."
    )
  }
}