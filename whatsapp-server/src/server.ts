import express from "express"
import cors from "cors"
import { Client, LocalAuth } from "whatsapp-web.js"
import qrcode from "qrcode"
import axios from "axios"
import OpenAI from "openai"

const app = express()
app.use(cors())
app.use(express.json())

// 🔐 ENV
const STORE_ID = process.env.NUVEMSHOP_STORE_ID!
const ACCESS_TOKEN = process.env.NUVEMSHOP_ACCESS_TOKEN!
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!

// 🤖 OPENAI
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
})

// 🔥 NUVEMSHOP SERVICE
async function getOrderByNumber(orderNumber: string) {
  try {
    const response = await axios.get(
      `https://api.nuvemshop.com.br/v1/${STORE_ID}/orders`,
      {
        headers: {
          Authentication: `bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        params: {
          number: orderNumber,
        },
      }
    )

    return response.data
  } catch (error: any) {
    console.error("Erro Nuvemshop:", error.response?.data || error.message)
    throw new Error("Erro ao buscar pedido")
  }
}

// 🧠 IA - INTERPRETAR MENSAGEM
async function interpretarMensagem(mensagem: string) {
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
}

// 💬 IA - RESPOSTA VENDEDOR
async function gerarResposta(mensagem: string) {
  const response = await openai.responses.create({
    model: "gpt-5-nano",
    input: `
Você é um vendedor experiente, direto e simpático.

Responda de forma natural, objetiva e focada em ajudar.

Cliente: "${mensagem}"
    `,
  })

  return response.output_text
}

// 🔄 ESTADO
let qrCodeBase64: string | null = null
let isConnected = false
let isInitializing = true

// 🤖 CLIENT WHATSAPP
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
    ],
  },
})

// 🔥 EVENTOS

client.on("qr", async (qr: string) => {
  console.log("📲 QR gerado")
  qrCodeBase64 = await qrcode.toDataURL(qr)
  isInitializing = false
})

client.on("ready", () => {
  console.log("✅ WhatsApp conectado")
  isConnected = true
  qrCodeBase64 = null
  isInitializing = false
})

client.on("disconnected", (reason) => {
  console.log("❌ WhatsApp desconectado:", reason)
  isConnected = false
  isInitializing = true
})

client.on("auth_failure", (msg) => {
  console.error("🚨 Falha na autenticação:", msg)
})

client.on("loading_screen", (percent, message) => {
  console.log(`⏳ ${percent}% - ${message}`)
})

// 🚀 INICIALIZA
client.initialize()

// 🧠 CÉREBRO DO BOT
client.on("message", async (message) => {
  try {
    if (message.fromMe) return
    if (message.from.includes("@g.us")) return

    const text = message.body.trim()
    console.log("📩 Mensagem:", text)

    // 🧠 IA interpreta
    const aiRaw = await interpretarMensagem(text)

    let ai
    try {
      ai = JSON.parse(aiRaw)
    } catch {
      await message.reply("Não entendi 😕 Pode reformular?")
      return
    }

    // 📦 PEDIDO
    if (ai.tipo === "pedido" && ai.pedidoNumero) {
      const orders = await getOrderByNumber(ai.pedidoNumero)

      if (!orders || orders.length === 0) {
        await message.reply("❌ Pedido não encontrado.")
        return
      }

      const order = orders[0]

      const produtos = order.products
        .map((p: any) => `• ${p.name} (x${p.quantity})`)
        .join("\n")

      await message.reply(`
📦 Pedido #${order.number}

👤 Cliente: ${order.customer?.name}
💰 Total: R$ ${order.total}
📌 Status: ${order.status}
💳 Pagamento: ${order.payment_status}

🛍️ Produtos:
${produtos}
      `)

      return
    }

    // 💬 OUTROS CASOS (IA responde)
    const resposta = await gerarResposta(text)

    await message.reply(resposta)

  } catch (error) {
    console.error("Erro geral:", error)

    await message.reply(
      "⚠️ Tive um problema aqui. Tente novamente em instantes."
    )
  }
})

// 🌐 ROTAS

// QR
app.get("/qr", (req, res) => {
  res.json({
    qr: qrCodeBase64,
    connected: isConnected,
    initializing: isInitializing,
  })
})

// SEND
app.post("/send", async (req, res) => {
  try {
    const { number, message } = req.body

    if (!number || !message) {
      return res.status(400).json({
        error: "Número e mensagem são obrigatórios",
      })
    }

    if (!isConnected) {
      return res.status(400).json({
        error: "WhatsApp não conectado",
      })
    }

    const chatId = `${number}@c.us`

    await client.sendMessage(chatId, message)

    res.json({ success: true })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Erro ao enviar" })
  }
})

// HEALTH
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    connected: isConnected,
  })
})

// 🚀 START
app.listen(3001, () => {
  console.log("🚀 Servidor rodando em http://localhost:3001")
})