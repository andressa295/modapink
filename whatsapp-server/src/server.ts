import express from "express"
import cors from "cors"
import { client } from "./bot/client"
import { handleMessage } from "./bot/handler"
import qrcode from "qrcode"

const app = express()
app.use(cors())
app.use(express.json())

let qrCodeBase64: string | null = null

// QR
client.on("qr", async (qr) => {
  console.log("📲 QR gerado")
  qrCodeBase64 = await qrcode.toDataURL(qr)
})

// conectado
client.on("ready", () => {
  console.log("✅ WhatsApp conectado")
})

// mensagens
client.on("message", handleMessage)

client.initialize()

// rota QR
app.get("/qr", (req, res) => {
  res.json({ qr: qrCodeBase64 })
})

app.listen(3001, () => {
  console.log("🚀 Servidor rodando em http://localhost:3001")
})