// services/whatsapp.service.ts

import { Client, LocalAuth } from "whatsapp-web.js"
import qrcode from "qrcode"
import { sessions } from "../sessions/sessions.store"
import { Session } from "../types"
import { handleIncomingMessage } from "../controllers/message.controller"

export function createSession(sessionId: string, name?: string): Session {
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
    session.ready = true
    session.qr = null
    console.log(`✅ ${sessionId} conectado`)
  })

  client.on("message", async (msg) => {
    await handleIncomingMessage(sessionId, msg)
  })

  client.on("disconnected", () => {
    session.ready = false
  })

  client.initialize()

  return session
}