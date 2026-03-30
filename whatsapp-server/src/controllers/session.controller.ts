import { Request, Response } from "express"
import { sessions } from "../sessions/sessions.store"
import { createSession } from "../services/whatsapp.service"

export function create(req: Request, res: Response) {
  const { sessionId, name } = req.body

  if (!sessionId) {
    return res.status(400).json({ error: "sessionId obrigatório" })
  }

  createSession(sessionId, name)

  return res.json({ ok: true })
}

export function list(req: Request, res: Response) {
  return res.json(
    Object.values(sessions).map((s) => ({
      id: s.id,
      name: s.name,
      ready: s.ready,
      hasQr: !!s.qr,
    }))
  )
}