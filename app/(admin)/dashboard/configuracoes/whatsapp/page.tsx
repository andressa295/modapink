"use client"

import { useEffect, useState } from "react"

export default function WhatsAppConfig() {
  const [qr, setQr] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false)

  const API_URL = "https://modapink.phand.com.br/bot"

  // 🔥 gera ID único sempre (multi sessão real)
  const [sessionId, setSessionId] = useState<string | null>(null)

  // =======================
  // 🔥 CRIAR SESSÃO NOVA
  // =======================
  async function createSession(newId: string) {
    await fetch(`${API_URL}/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sessionId: newId
      })
    })
  }

  // =======================
  // 🔥 DELETAR SESSÃO (FORÇA QR NOVO)
  // =======================
  async function destroySession(id: string) {
    try {
      await fetch(`${API_URL}/sessions/${id}`, {
        method: "DELETE"
      })
    } catch (err) {
      console.error("Erro ao deletar sessão:", err)
    }
  }

  // =======================
  // 📲 BUSCAR QR
  // =======================
  async function loadQR(id: string) {
    try {
      const res = await fetch(`${API_URL}/sessions/${id}/qr`, {
        cache: "no-store"
      })

      const data = await res.json()

      // ✅ CONECTADO
      if (data.ready) {
        setConnected(true)
        setQr(null)
        setLoading(false)
        return
      }

      // 🔥 QR GERADO
      if (data.qr) {
        setQr(data.qr)
        setConnected(false)
        setLoading(false)
        return
      }

      // ⏳ ainda iniciando
      setLoading(true)

    } catch (err) {
      console.error("Erro ao buscar QR:", err)
      setLoading(false)
    }
  }

  // =======================
  // 🔁 POLLING
  // =======================
  useEffect(() => {
    if (!sessionId) return

    const interval = setInterval(() => {
      loadQR(sessionId)
    }, 2000)

    return () => clearInterval(interval)
  }, [sessionId])

  // =======================
  // 🚀 CONECTAR NOVO WHATSAPP
  // =======================
  async function connectNew() {
    setLoading(true)
    setConnected(false)
    setQr(null)

    // 🔥 gera id único sempre
    const newId = `sess_${Date.now()}`

    // 🔥 garante QR novo sempre
    await destroySession(newId)

    await createSession(newId)

    setSessionId(newId)

    // primeira carga
    await loadQR(newId)
  }

  return (
    <div className="wa-page">

      <div className="wa-card">

        <h1 className="wa-title">
          Conectar WhatsApp
        </h1>

        {!sessionId && (
          <button className="wa-btn" onClick={connectNew}>
            Conectar novo número
          </button>
        )}

        {sessionId && (
          <>
            {/* ✅ CONECTADO */}
            {connected && (
              <div className="wa-success">
                <div className="wa-check">✓</div>
                <p>WhatsApp conectado com sucesso</p>

                <button
                  className="wa-btn"
                  onClick={connectNew}
                >
                  Conectar outro número
                </button>
              </div>
            )}

            {/* 📲 QR */}
            {!connected && (
              <div className="wa-content">

                <p className="wa-sub">
                  Escaneie o QR Code
                </p>

                {loading && (
                  <p className="wa-loading">
                    Inicializando WhatsApp...
                  </p>
                )}

                {!loading && qr && (
                  <div className="wa-qr-box">
                    <img src={qr} alt="QR Code" />
                  </div>
                )}

                {!loading && !qr && (
                  <p className="wa-loading">
                    Gerando QR Code...
                  </p>
                )}

                <button
                  className="wa-btn"
                  onClick={connectNew}
                >
                  Gerar novo QR
                </button>

              </div>
            )}
          </>
        )}

      </div>

    </div>
  )
}