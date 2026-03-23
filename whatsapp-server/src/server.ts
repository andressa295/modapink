import express from "express"
import cors from "cors"
import { client } from "./bot/client"
import { handleMessage } from "./bot/handler"
import qrcode from "qrcode"

// ⚠️ Node 18+ já tem fetch nativo
// se der erro, instala: npm i node-fetch

const app = express()
app.use(cors())
app.use(express.json())

// 🔄 ESTADO GLOBAL
let qrCodeBase64: string | null = null
let isConnected = false
let isInitializing = true

// 📲 QR
client.on("qr", async (qr: string) => {
  console.log("📲 QR gerado")
  qrCodeBase64 = await qrcode.toDataURL(qr)
  isInitializing = false
})

// ✅ CONECTADO
client.on("ready", async () => {
  console.log("✅ WhatsApp conectado")

  isConnected = true
  qrCodeBase64 = null
  isInitializing = false

  try {
    const phone = client.info?.wid?.user

    if (!phone) {
      console.warn("⚠️ Não foi possível obter o número")
      return
    }

    console.log("📱 Número conectado:", phone)

    // 🔥 SALVAR NO NEXT (Supabase)
    await fetch("http://localhost:3000/api/whatsapp/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone,
      }),
    })

  } catch (err) {
    console.error("❌ Erro ao salvar sessão:", err)
  }
})

// ❌ DESCONECTADO
client.on("disconnected", (reason) => {
  console.log("❌ Desconectado:", reason)

  isConnected = false
  isInitializing = true

  // 🔥 tenta reconectar sozinho
  setTimeout(() => {
    console.log("🔄 Tentando reconectar...")
    client.initialize()
  }, 5000)
})

// 🚨 ERRO AUTH
client.on("auth_failure", (msg) => {
  console.error("🚨 Falha na autenticação:", msg)
})

// ⏳ LOADING
client.on("loading_screen", (percent, message) => {
  console.log(`⏳ ${percent}% - ${message}`)
})

// 🧠 BOT
client.on("message", handleMessage)

// 🚀 INICIALIZA
client.initialize()

// =======================
// 🌐 ROTAS
// =======================

// 📲 QR
app.get("/qr", (req, res) => {
  res.json({
    qr: qrCodeBase64,
    connected: isConnected,
    initializing: isInitializing,
  })
})

// 📤 ENVIAR MENSAGEM
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
    console.error("❌ Erro ao enviar:", error)

    res.status(500).json({
      error: "Erro ao enviar mensagem",
    })
  }
})

// ❤️ HEALTH CHECK
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    connected: isConnected,
    initializing: isInitializing,
  })
})

// =======================
// 🚀 START
// =======================

const PORT = 3001

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`)
})