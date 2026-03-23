import OpenAI from "openai"

// 🔒 ENV isolado aqui
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

// 🧠 Interpretar intenção do cliente
export async function interpretarMensagem(mensagem: string) {
  try {
    const response = await openai.responses.create({
      model: "gpt-5-nano",
      input: `
Você é um sistema de atendimento.

Retorne apenas JSON válido:

{
  "tipo": "pedido | duvida | outro",
  "pedidoNumero": "numero se existir ou null"
}

Mensagem: "${mensagem}"
      `,
    })

    return response.output_text
  } catch (error: any) {
    console.error("❌ Erro na interpretação IA:", error.message)
    throw new Error("Erro ao interpretar mensagem")
  }
}

// 💬 Gerar resposta natural
export async function gerarResposta(mensagem: string) {
  try {
    const response = await openai.responses.create({
      model: "gpt-5-nano",
      input: `
Você é um vendedor experiente, direto e simpático.

Responda de forma natural, objetiva e focada em ajudar.

Cliente: "${mensagem}"
      `,
    })

    return response.output_text
  } catch (error: any) {
    console.error("❌ Erro ao gerar resposta IA:", error.message)
    throw new Error("Erro ao gerar resposta")
  }
}