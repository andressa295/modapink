import express from "express"
import cors from "cors"
import qrcode from "qrcode"
import fetch from "node-fetch"
import { client } from "./bot/client"
import { handleMessage } from "./bot/handler"

const app = express()

app.use(cors())
app.use(express.json())

let qrCodeBase64: string | null = null
let isReady = false
let isInitializing = true

// =======================
// 📲 QR
// =======================
client.on("qr", async (qr) => {
  console.log("📲 QR gerado")

  try {
    qrCodeBase64 = await qrcode.toDataURL(qr)
    isInitializing = false
  } catch (err) {
    console.error("Erro ao gerar QR:", err)
  }
})

// =======================
// ✅ CONECTADO
// =======================
client.on("ready", async () => {
  console.log("✅ WhatsApp conectado")

  isReady = true
  isInitializing = false
  qrCodeBase64 = null

  const phone = client.info?.wid?.user || "desconhecido"

  try {
    await fetch("http://localhost:3000/api/whatsapp/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ phone })
    })

    console.log("📡 Sessão enviada para o frontend")
  } catch (err) {
    console.error("❌ Erro ao salvar sessão:", err)
  }
})

// =======================
// ❌ DESCONECTADO
// =======================
client.on("disconnected", () => {
  console.log("❌ WhatsApp desconectado")

  isReady = false
  isInitializing = true
  qrCodeBase64 = null

  client.initialize()
})

// =======================
// 💬 MENSAGENS
// =======================
client.on("message", handleMessage)

// =======================
// 🚀 START
// =======================
client.initialize()

// =======================
// 📡 ROTA QR
// =======================
app.get("/qr", (req, res) => {
  res.json({
    qr: qrCodeBase64,
    connected: isReady,
    initializing: isInitializing
  })
})

// =======================
// 📡 ROTA SESSION
// =======================
app.get("/session", (req, res) => {
  res.json([
    {
      phone: isReady ? client.info?.wid?.user : null,
      status: isReady ? "online" : "offline"
    }
  ])
})

// =======================
// ❤️ HEALTH
// =======================
app.get("/", (req, res) => {
  res.send("API WhatsApp rodando 🚀")
})

// =======================
// 🌍 LISTEN
// =======================
const PORT = 3001

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor rodando em http://0.0.0.0:${PORT}`)
})