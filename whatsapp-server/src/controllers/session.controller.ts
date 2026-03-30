// controllers/session.controller.ts

import { sessions } from "../sessions/sessions.store"
import { createSession } from "../services/whatsapp.service"

export function create(req, res) {
  const { sessionId, name } = req.body

  if (!sessionId) {
    return res.status(400).json({ error: "sessionId obrigatório" })
  }

  createSession(sessionId, name)

  res.json({ ok: true })
}

export function list(req, res) {
  res.json(
    Object.values(sessions).map((s) => ({
      id: s.id,
      name: s.name,
      ready: s.ready,
      hasQr: !!s.qr
    }))
  )
}