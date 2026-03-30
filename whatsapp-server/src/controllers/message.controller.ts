// controllers/message.controller.ts

import { sessions } from "../sessions/sessions.store"
import { detectChannel } from "../services/routing.service"
import { runAutomation } from "../services/automation.service"

export async function handleIncomingMessage(sessionId: string, msg: any) {
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

  // 🔥 chama automação
  await runAutomation(session, conv, msg)
}