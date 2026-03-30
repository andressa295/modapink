"use client"

import { useEffect, useState } from "react"
import "../styles/numeros.css"

type NumberType = {
  id: string
  name: string
  status: "online" | "offline"
  phone?: string
}

// 🔥 AJUSTE AQUI CONFORME SEU AMBIENTE
// LOCAL:
const API = "http://localhost:3000/api/whatsapp/session"

// VPS:
// const API = "https://modapink.phand.com.br/api/whatsapp/session"

export default function Numeros() {
  const [numbers, setNumbers] = useState<NumberType[]>([])
  const [loading, setLoading] = useState(true)

  const [showQR, setShowQR] = useState(false)
  const [qr, setQr] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [initializing, setInitializing] = useState(true)

  const [showNaming, setShowNaming] = useState(false)
  const [newName, setNewName] = useState("")
  const [savingName, setSavingName] = useState(false)

  const [currentSession, setCurrentSession] = useState<string | null>(null)

  // =======================
  // 📡 LOAD SESSÕES
  // =======================
  async function loadSessions() {
    try {
      setLoading(true)

      const res = await fetch(API, { cache: "no-store" })

      if (!res.ok) {
        console.error("Erro API:", res.status)
        setNumbers([])
        return
      }

      const data = await res.json()

      if (!Array.isArray(data)) {
        console.error("Resposta inválida:", data)
        setNumbers([])
        return
      }

      setNumbers(
        data.map((s: any) => ({
          id: s.id,
          name: s.name || s.setor || "WhatsApp",
          status: s.status === "online" ? "online" : "offline",
          phone: s.phone
        }))
      )

    } catch (err) {
      console.error("Erro ao carregar sessões:", err)
      setNumbers([])
    } finally {
      setLoading(false)
    }
  }

  // =======================
  // 📲 QR
  // =======================
  async function loadQR(sessionId: string) {
    try {
      const res = await fetch(`${API}/${sessionId}/qr`)

      if (!res.ok) {
        console.error("Erro QR:", res.status)
        setInitializing(false)
        return
      }

      const data = await res.json()

      if (data.ready) {
        setConnected(true)
        setQr(null)
        setInitializing(false)
        return
      }

      if (data.qr) {
        setQr(data.qr)
        setConnected(false)
        setInitializing(false)
        return
      }

      setQr(null)
      setConnected(false)
      setInitializing(true)

    } catch (err) {
      console.error("Erro QR:", err)
      setInitializing(false)
    }
  }

  // =======================
  // 🔁 POLLING QR
  // =======================
  useEffect(() => {
    if (!showQR || !currentSession) return

    loadQR(currentSession)

    const interval = setInterval(() => {
      loadQR(currentSession)
    }, 2000)

    return () => clearInterval(interval)
  }, [showQR, currentSession])

  // =======================
  // 🔄 APÓS CONECTAR
  // =======================
  useEffect(() => {
    if (!connected) return

    setTimeout(() => {
      setShowQR(false)
      setShowNaming(true)
      loadSessions()
    }, 1000)
  }, [connected])

  // =======================
  // 💾 SALVAR NOME
  // =======================
  async function saveName() {
    if (!newName.trim() || !currentSession) return

    try {
      setSavingName(true)

      await fetch(`${API}/${currentSession}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName })
      })

      setShowNaming(false)
      setNewName("")
      loadSessions()

    } catch (err) {
      console.error("Erro ao salvar nome:", err)
    } finally {
      setSavingName(false)
    }
  }

  // =======================
  // ➕ NOVA SESSÃO
  // =======================
  async function createNewSession() {
    const phone = prompt("Digite o número com DDD")
    if (!phone) return

    try {
      const res = await fetch(API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          phone,
          setor: "Atendimento"
        })
      })

      let data: any = null

      try {
        data = await res.json()
      } catch {
        console.error("Resposta inválida")
      }

      if (!res.ok) {
        console.error("Erro HTTP:", res.status, data)
        alert("Erro no servidor.")
        return
      }

      if (!data?.id) {
        console.error("Resposta sem id:", data)
        alert("Erro ao criar sessão.")
        return
      }

      setCurrentSession(data.id)
      setShowQR(true)
      setQr(null)
      setConnected(false)
      setInitializing(true)

    } catch (err) {
      console.error("Erro ao criar sessão:", err)
      alert("Erro de rede")
    }
  }

  async function disconnect(id: string) {
    if (!confirm("Deseja desconectar este número?")) return

    try {
      await fetch(`${API}/${id}`, { method: "POST" })
      loadSessions()
    } catch (err) {
      console.error("Erro ao desconectar:", err)
    }
  }

  async function removeSession(id: string) {
    if (!confirm("Excluir permanentemente este WhatsApp?")) return

    try {
      await fetch(`${API}/${id}`, { method: "DELETE" })
      loadSessions()
    } catch (err) {
      console.error("Erro ao excluir:", err)
    }
  }

  useEffect(() => {
    loadSessions()
  }, [])

  return (
    <div className="numbers-page">

      <div className="numbers-header">
        <h1>Números de WhatsApp</h1>

        <button onClick={createNewSession}>
          + Conectar
        </button>
      </div>

      <div className="numbers-grid">

        {loading && <p className="empty">Carregando...</p>}

        {!loading && numbers.length === 0 && (
          <p className="empty">Nenhum número conectado</p>
        )}

        {numbers.map((n) => (
          <div key={n.id} className="card">

            <div className="card-title">{n.name}</div>
            <div className="card-id">{n.phone}</div>

            <div className={`status ${n.status}`}>
              {n.status === "online" ? "🟢 Online" : "🔴 Offline"}
            </div>

            <div className="card-actions">
              <button onClick={() => disconnect(n.id)}>
                Desconectar
              </button>

              <button onClick={() => removeSession(n.id)}>
                Excluir
              </button>
            </div>

          </div>
        ))}

      </div>

    </div>
  )
}