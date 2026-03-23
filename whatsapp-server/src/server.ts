import express from "express"
import cors from "cors"
import { client } from "./bot/client"
import { handleMessage } from "./bot/handler"
import qrcode from "qrcode"

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
  qrCodeBase64 = await qrcode.toDataURL(qr)
  isInitializing = false
})

// =======================
// ✅ CONECTADO
// =======================
client.on("ready", () => {
  console.log("✅ WhatsApp conectado")
  isReady = true
  qrCodeBase64 = null
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
// ❤️ HEALTHCHECK
// =======================
app.get("/", (req, res) => {
  res.send("API WhatsApp rodando 🚀")
})

// =======================
// 🌍 LISTEN PRODUÇÃO
// =======================
app.listen(3001, "0.0.0.0", () => {
  console.log("🚀 Servidor rodando em http://0.0.0.0:3001")
})