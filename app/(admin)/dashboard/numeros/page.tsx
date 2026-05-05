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
  const [sessionId, setSessionId] = useState("principal") // 🔥 Inicia com o principal
  const [qr, setQr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Lista de IDs permitidos (Deve ser igual às abas da página de conversas)
  const idsPermitidos = [
    { id: "principal", nome: "Bot Principal" },
    { id: "vendedora-1", nome: "Vendedora 1" },
    { id: "vendedora-2", nome: "Vendedora 2" },
    { id: "vendedora-3", nome: "Vendedora 3" },
  ]

  const qrIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // =======================
  // CARREGAR SESSÕES
  // =======================
  async function loadSessions() {
    try {
      const res = await fetch(`${API}/sessions`, { cache: "no-store" })
      const data = await res.json()
      setSessions(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error("❌ erro loadSessions:", err)
      setSessions([])
    }
  }

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
  // CRIAR / CONECTAR SESSÃO
  // =======================
  async function createSession() {
    if (!sessionId || loading) return

    clearAllIntervals()
    setLoading(true)
    setQr(null)

    try {
      // 1. Solicita a criação da sessão no Back-end
      await fetch(`${API}/sessions/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      })

      // Pequeno delay para o WhatsApp Web iniciar
      await new Promise(r => setTimeout(r, 2000))

      // 2. Inicia busca pelo QR Code (Polling)
      qrIntervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${API}/sessions/qr/${sessionId}`)
          if (!res.ok) return
          const data = await res.json()

          if (data.qr) {
            setQr(data.qr)
            setLoading(false)
            // Para de buscar o QR assim que recebe um
            if (qrIntervalRef.current) clearInterval(qrIntervalRef.current)
          }
        } catch {}
      }, 2000)

      // 3. Inicia monitoramento do Status
      statusIntervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${API}/sessions/status/${sessionId}`)
          if (!res.ok) return
          const data = await res.json()

          if (data.status === "ready") {
            clearAllIntervals()
            setQr(null)
            setShowModal(false)
            setSessionId("principal")
            loadSessions() // Atualiza a lista na tela
          }
        } catch {}
      }, 3000)

    } catch (err) {
      console.error("❌ erro createSession:", err)
      setLoading(false)
    }
  }

  // =======================
  // REMOVER SESSÃO
  // =======================
  async function removeSession(id: string) {
    const confirmDelete = confirm(`Deseja desconectar e remover a sessão: ${id}?`)
    if (!confirmDelete) return

    try {
      await fetch(`${API}/sessions/${id}`, { method: "DELETE" })
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
        <h1>Conexões WhatsApp</h1>
        <button className="btn-add" onClick={() => setShowModal(true)}>
          + Conectar novo número
        </button>
      </div>

      <div className="numbers-grid">
        {sessions.length === 0 && (
          <div className="empty-state">
            <p>Nenhum número conectado no momento.</p>
          </div>
        )}

        {sessions.map((s) => (
          <div key={s.id} className="card">
            <div className="card-header">
              <span className="badge">Sessão</span>
              <h3>{s.id.toUpperCase()}</h3>
            </div>

            <div className="card-body">
              <p className="phone">{s.phone || "Número não identificado"}</p>
              
              <div className={`status-indicator ${s.status}`}>
                {s.status === "ready" && <span>🟢 Online</span>}
                {s.status === "connecting" && <span>🟡 Aguardando QR Code</span>}
                {s.status === "disconnected" && <span>🔴 Desconectado</span>}
              </div>
            </div>

            <div className="card-footer">
              <button className="btn-delete" onClick={() => removeSession(s.id)}>
                Remover Conexão
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL DE CONEXÃO */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Vincular Novo Aparelho</h2>
            <p>Selecione quem será o dono desta conexão:</p>

            <select 
              value={sessionId} 
              onChange={(e) => setSessionId(e.target.value)}
              className="select-session"
              disabled={loading || qr !== null}
            >
              {idsPermitidos.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.nome}</option>
              ))}
            </select>

            {!qr && (
              <button 
                className="btn-primary" 
                onClick={createSession} 
                disabled={loading}
              >
                {loading ? "Iniciando Puppeteer..." : "Gerar QR Code"}
              </button>
            )}

            {qr && (
              <div className="qr-container">
                <img src={qr} alt="WhatsApp QR Code" />
                <p>Abra o WhatsApp {'>'} Aparelhos Conectados {'>'} Conectar um Aparelho</p>
              </div>
            )}

            <button
              className="btn-close"
              onClick={() => {
                clearAllIntervals()
                setShowModal(false)
                setQr(null)
                setSessionId("principal")
              }}
            >
              Cancelar e Fechar
            </button>
          </div>
        </div>
      )}

    </div>
  )
}