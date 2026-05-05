"use client"

import { useEffect, useRef, useState } from "react"
import "../styles/numeros.css"

type Session = {
  id: string
  status: "connecting" | "ready" | "disconnected"
  phone?: string
}

const API = process.env.NEXT_PUBLIC_API_URL!

export default function Numeros() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [showModal, setShowModal] = useState(false)
  const [sessionId, setSessionId] = useState("")
  const [qr, setQr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const qrIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // =======================
  // LOAD
  // =======================
  async function loadSessions() {
    try {
      const res = await fetch(`${API}/sessions`, { cache: "no-store" })
      const data = await res.json()
      setSessions(data)
    } catch (err) {
      console.error("❌ erro loadSessions:", err)
      setSessions([])
    }
  }

  // =======================
  // CLEAR INTERVALS
  // =======================
  function clearAllIntervals() {
    if (qrIntervalRef.current) {
      clearInterval(qrIntervalRef.current)
      qrIntervalRef.current = null
    }

    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current)
      statusIntervalRef.current = null
    }
  }

  // =======================
  // CREATE SESSION
  // =======================
  async function createSession() {
    if (!sessionId.trim() || loading) return

    clearAllIntervals()
    setLoading(true)
    setQr(null)

    try {
      const res = await fetch(`${API}/sessions/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ sessionId })
      })

      // 🔥 NÃO BLOQUEIA MAIS COM ALERT
      const data = await res.json().catch(() => null)

      if (!res.ok && !data?.ok) {
        console.warn("⚠️ erro criar sessão:", data)
        // continua fluxo mesmo assim
      }

      // pequeno delay
      await new Promise(r => setTimeout(r, 1000))

      // =======================
      // QR POLLING
      // =======================
      qrIntervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${API}/sessions/qr/${sessionId}`)

          if (!res.ok) return

          const data = await res.json()

          if (data.qr) {
            setQr(data.qr)
            setLoading(false)

            clearInterval(qrIntervalRef.current!)
            qrIntervalRef.current = null
          }
        } catch {}
      }, 1500)

      // =======================
      // STATUS POLLING
      // =======================
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

    } catch (err) {
      console.error("❌ erro createSession:", err)
      setLoading(false)
    }
  }

  // =======================
  // DELETE
  // =======================
  async function removeSession(id: string) {
    const confirmDelete = confirm("Remover essa sessão?")
    if (!confirmDelete) return

    try {
      await fetch(`${API}/sessions/${id}`, {
        method: "DELETE"
      })

      loadSessions()
    } catch (err) {
      console.error("❌ erro removeSession:", err)
    }
  }

  useEffect(() => {
    loadSessions()

    return () => clearAllIntervals()
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

            <div className="card-title">{s.id}</div>

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

      {showModal && (
        <div className="modal">
          <div className="modal-box">

            <h2>Conectar WhatsApp</h2>

            <input
              placeholder="ID (ex: principal)"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
            />

            <button onClick={createSession} disabled={loading}>
              {loading ? "Gerando..." : "Gerar QR"}
            </button>

            {loading && (
              <p className="loading">Gerando QR...</p>
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