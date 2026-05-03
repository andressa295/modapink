"use client"

import { useEffect, useRef, useState } from "react"
import "../styles/numeros.css"

type Session = {
  id: string
  status: "connecting" | "ready" | "disconnected"
  phone?: string
}

const API = "https://api.modapink.phand.com.br"

export default function Numeros() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [showModal, setShowModal] = useState(false)
  const [sessionId, setSessionId] = useState("")
  const [qr, setQr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // 🔥 refs pra controlar interval (evita bug)
  const qrIntervalRef = useRef<any>(null)
  const statusIntervalRef = useRef<any>(null)

  // =======================
  // LOAD SESSIONS
  // =======================
  async function loadSessions() {
    const res = await fetch(`${API}/sessions`, { cache: "no-store" })
    const data = await res.json()
    setSessions(data)
  }

  // =======================
  // CREATE SESSION
  // =======================
  async function createSession() {
    if (!sessionId.trim()) return

    setLoading(true)
    setQr(null)

    await fetch(`${API}/sessions/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId })
    })

    // 🔥 QR POLLING
    qrIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/sessions/qr/${sessionId}`)
        if (!res.ok) return

        const data = await res.json()

        if (data.qr) {
          setQr(data.qr)
          setLoading(false)
        }
      } catch {}
    }, 1500)

    // 🔥 STATUS POLLING (detectar quando conecta)
    statusIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/sessions/status/${sessionId}`)
        if (!res.ok) return

        const data = await res.json()

        if (data.status === "ready") {
          clearAllIntervals()

          setQr(null)
          setShowModal(false)
          setSessionId("")

          loadSessions()
        }
      } catch {}
    }, 2000)

    loadSessions()
  }

  // =======================
  // CLEAR INTERVALS
  // =======================
  function clearAllIntervals() {
    if (qrIntervalRef.current) {
      clearInterval(qrIntervalRef.current)
    }

    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current)
    }
  }

  // =======================
  // DELETE
  // =======================
  async function removeSession(id: string) {
    await fetch(`${API}/sessions/${id}`, {
      method: "DELETE"
    })

    loadSessions()
  }

  // =======================
  // INIT
  // =======================
  useEffect(() => {
    loadSessions()

    return () => {
      clearAllIntervals()
    }
  }, [])

  return (
    <div className="numbers-page">

      <div className="numbers-header">
        <h1>WhatsApp</h1>

        <button onClick={() => setShowModal(true)}>
          + Conectar número
        </button>
      </div>

      <div className="numbers-grid">
        {sessions.length === 0 && (
          <p className="empty">Nenhum número conectado</p>
        )}

        {sessions.map((s) => (
          <div key={s.id} className="card">

            <div className="card-title">
              {s.id}
            </div>

            <div className="card-id">
              {s.phone || "Aguardando conexão"}
            </div>

            <div className={`status ${s.status}`}>
              {s.status === "ready" && "🟢 Online"}
              {s.status === "connecting" && "🟡 Conectando..."}
              {s.status === "disconnected" && "🔴 Offline"}
            </div>

            <button onClick={() => removeSession(s.id)}>
              Remover
            </button>

          </div>
        ))}
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="modal">
          <div className="modal-box">

            <h2>Conectar WhatsApp</h2>

            <input
              placeholder="ID da sessão (ex: principal)"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
            />

            <button onClick={createSession}>
              Gerar QR
            </button>

            {loading && (
              <p className="loading">
                Gerando QR...
              </p>
            )}

            {qr && (
              <div className="qr-box">
                <img src={qr} />
                <p>Escaneie no WhatsApp</p>
              </div>
            )}

            <button
              className="close"
              onClick={() => {
                clearAllIntervals()
                setShowModal(false)
                setQr(null)
                setSessionId("")
              }}
            >
              Fechar
            </button>

          </div>
        </div>
      )}

    </div>
  )
}