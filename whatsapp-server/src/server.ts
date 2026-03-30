import express from "express"
import cors from "cors"
import qrcode from "qrcode"
import { Client, LocalAuth } from "whatsapp-web.js"

const app = express()
app.use(cors())
app.use(express.json())

console.log("🔥 SERVER MULTI WHATSAPP INICIANDO")

// =======================
// TIPOS
// =======================
type Channel = "VENDAS" | "SAC" | "FINANCEIRO"

type Message = {
  id: number
  body: string
  from: string
  timestamp: number
  fromMe: boolean
}

type Conversation = {
  contact: string
  channel: Channel
  lastMessageAt: number
  messages: Message[]
}

type Session = {
  id: string
  name: string
  client: Client
  conversations: Record<string, Conversation>
  qr: string | null
  ready: boolean
}

const sessions: Record<string, Session> = {}

// =======================
// DETECTAR CANAL
// =======================
function detectChannel(text: string): Channel {
  const t = text.toLowerCase()

  if (t.includes("comprar") || t.includes("preço")) return "VENDAS"
  if (t.includes("boleto") || t.includes("pagamento")) return "FINANCEIRO"

  return "SAC"
}

// =======================
// CRIAR SESSÃO (FIXADA)
// =======================
function createSession(sessionId: string, name?: string) {
  if (sessions[sessionId]) return sessions[sessionId]

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: sessionId }),
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    }
  })

  const session: Session = {
    id: sessionId,
    name: name || sessionId,
    client,
    conversations: {},
    qr: null,
    ready: false
  }

  sessions[sessionId] = session

  client.on("qr", async (qr) => {
    session.qr = await qrcode.toDataURL(qr)
  })

  client.on("ready", () => {
    console.log(`✅ ${sessionId} conectado`)
    session.ready = true
    session.qr = null
  })

  client.on("message", (msg) => handleIncoming(sessionId, msg))

  client.on("disconnected", () => {
    console.log(`❌ ${sessionId} desconectado`)
    session.ready = false
  })

  client.initialize()

  return session
}

// =======================
// RECEBER MSG (CORRIGIDO)
// =======================
function handleIncoming(sessionId: string, msg: any) {
  const session = sessions[sessionId]
  if (!session) return

  const contact = msg.from

  if (!session.conversations[contact]) {
    session.conversations[contact] = {
      contact,
      channel: detectChannel(msg.body || ""),
      lastMessageAt: Date.now(),
      messages: []
    }
  }

  const conv = session.conversations[contact]

  conv.messages.push({
    id: Date.now(),
    body: msg.body || "",
    from: msg.from,
    timestamp: Date.now(),
    fromMe: false
  })

  conv.lastMessageAt = Date.now()
}

// =======================
// ROTAS
// =======================

// HEALTH
app.get("/", (_, res) => {
  res.send("OK")
})

// CRIAR SESSÃO
app.post("/sessions", (req, res) => {
  const { sessionId, name } = req.body

  if (!sessionId) {
    return res.status(400).json({ error: "sessionId obrigatório" })
  }

  createSession(sessionId, name)

  res.json({ ok: true })
})

// CRIAR PADRÃO
app.post("/sessions/defaults", (_, res) => {
  createSession("vendas", "Vendas")
  createSession("sac", "SAC")
  createSession("financeiro", "Financeiro")

  res.json({ ok: true })
})

// LISTAR SESSÕES
app.get("/sessions", (_, res) => {
  res.json(
    Object.values(sessions).map((s) => ({
      id: s.id,
      name: s.name,
      ready: s.ready,
      hasQr: !!s.qr
    }))
  )
})

// QR (CORRIGIDO: CRIA SE NÃO EXISTIR)
app.get("/sessions/:id/qr", (req, res) => {
  const id = req.params.id

  const session = sessions[id] || createSession(id)

  res.json({
    qr: session.qr,
    ready: session.ready
  })
})

// CONVERSAS (BASE DO ESPELHAMENTO)
app.get("/conversations/:id", (req, res) => {
  const s = sessions[req.params.id]
  if (!s) return res.json([])

  res.json(
    Object.values(s.conversations).sort(
      (a, b) => b.lastMessageAt - a.lastMessageAt
    )
  )
})

// MUDAR CANAL
app.post("/conversations/:id/:contact/channel", (req, res) => {
  const { id, contact } = req.params
  const { channel } = req.body

  const s = sessions[id]

  if (!s || !s.conversations[contact]) {
    return res.status(404).json({})
  }

  s.conversations[contact].channel = channel

  res.json({ ok: true })
})

// ENVIAR MSG (CORRIGIDO PARA ESPELHAR)
app.post("/send", async (req, res) => {
  const { sessionId, contact, message } = req.body
  const s = sessions[sessionId]

  if (!s || !s.ready) {
    return res.status(400).json({ error: "Sessão offline" })
  }

  await s.client.sendMessage(contact, message)

  if (!s.conversations[contact]) {
    s.conversations[contact] = {
      contact,
      channel: "SAC",
      lastMessageAt: Date.now(),
      messages: []
    }
  }

  s.conversations[contact].messages.push({
    id: Date.now(),
    body: message,
    from: "me",
    timestamp: Date.now(),
    fromMe: true
  })

  s.conversations[contact].lastMessageAt = Date.now()

  res.json({ ok: true })
})

// 🔌 DESCONECTAR (NOVO E CORRETO)
app.post("/sessions/:id/disconnect", async (req, res) => {
  const { id } = req.params
  const s = sessions[id]

  if (!s) {
    return res.status(404).json({ error: "Sessão não encontrada" })
  }

  try {
    await s.client.destroy()
  } catch (e) {
    console.error("Erro ao destruir client:", e)
  }

  delete sessions[id]

  res.json({ ok: true })
})

// AUTO START
createSession("loja1", "Principal")

app.listen(3001, () => {
  console.log("🚀 API rodando 3001")
})