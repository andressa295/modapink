"use client"

import { useEffect, useState } from "react"
import "../styles/numeros.css"

type NumberType = {
  setor: string
  phone: string
  status: "online" | "offline"
  users: string[]
}

export default function Numeros() {
  const [numbers, setNumbers] = useState<NumberType[]>([])

  const [showQR, setShowQR] = useState(false)
  const [qr, setQr] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [initializing, setInitializing] = useState(true)

  const [step, setStep] = useState<"qr" | "naming">("qr")

  // =======================
  // 🔥 API (PRODUÇÃO)
  // =======================
  const API_URL = "/bot"

  // =======================
  // 📡 CARREGAR SESSÕES
  // =======================
  async function loadSessions() {
    try {
      const res = await fetch(`${API_URL}/session`)

      if (!res.ok) {
        throw new Error(`Erro HTTP: ${res.status}`)
      }

      const data = await res.json()

      setNumbers(
        data.map((s: any) => ({
          setor: "WhatsApp",
          phone: s.phone || "—",
          status: s.status === "online" ? "online" : "offline",
          users: []
        }))
      )
    } catch (err) {
      console.error("Erro ao carregar sessões:", err)
    }
  }

  useEffect(() => {
    loadSessions()
  }, [])

  // =======================
  // 📲 BUSCAR QR
  // =======================
  async function loadQR() {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 4000)

      const res = await fetch(`${API_URL}/qr`, {
        signal: controller.signal
      })

      clearTimeout(timeout)

      if (!res.ok) return

      const data = await res.json()

      setQr(data.qr)
      setConnected(data.connected)
      setInitializing(data.initializing)

      if (data.connected) {
        setStep("naming")
      }

    } catch (err) {
      console.log("Aguardando backend...")
    }
  }

  // =======================
  // 🔁 POLLING QR
  // =======================
  useEffect(() => {
    if (!showQR) return

    loadQR()

    const interval = setInterval(() => {
      if (!connected) {
        loadQR()
      }
    }, 2500)

    return () => clearInterval(interval)
  }, [showQR, connected])

  // =======================
  // 🔄 ATUALIZA APÓS CONECTAR
  // =======================
  useEffect(() => {
    if (!connected) return

    const timeout = setTimeout(() => {
      loadSessions()
      setShowQR(false)
      setStep("qr")
    }, 2000)

    return () => clearTimeout(timeout)
  }, [connected])

  // =======================
  // ABRIR MODAL
  // =======================
  function handleOpenModal() {
    setShowQR(true)
    setStep("qr")
    setQr(null)
    setConnected(false)
    setInitializing(true)
  }

  return (
    <div className="numbers-page">

      <div className="numbers-header">
        <div className="numbers-title">
          Números de WhatsApp
        </div>

        <button
          className="connect-button"
          onClick={handleOpenModal}
        >
          + Conectar WhatsApp
        </button>
      </div>

      <div className="numbers-grid">
        {numbers.length === 0 && (
          <p style={{ opacity: 0.6 }}>
            Nenhum número conectado
          </p>
        )}

        {numbers.map((n, index) => (
          <div key={index} className="number-card">

            <div className="number-title">{n.setor}</div>

            <div className="number-phone">{n.phone}</div>

            <div
              className={`number-status ${
                n.status === "online"
                  ? "status-online"
                  : "status-offline"
              }`}
            >
              {n.status === "online"
                ? "🟢 Conectado"
                : "🔴 Desconectado"}
            </div>

            <div className="number-users">
              Responsáveis:
              {n.users.length > 0
                ? ` ${n.users.join(", ")}`
                : " Nenhum"}
            </div>

            <div className="number-actions">
              <button>Gerenciar</button>
            </div>

          </div>
        ))}
      </div>

      {showQR && (
        <div className="qr-modal">
          <div className="qr-box">

            <div className="qr-header">
              <h2>Conectar WhatsApp</h2>
              <button onClick={() => setShowQR(false)}>✕</button>
            </div>

            {initializing && step === "qr" && (
              <p className="qr-loading">
                Conectando ao WhatsApp...
              </p>
            )}

            {step === "qr" && !initializing && (
              <>
                <p className="qr-sub">
                  Escaneie o QR Code
                </p>

                {qr ? (
                  <div className="qr-image">
                    <img src={qr} alt="QR Code" />
                  </div>
                ) : (
                  <p className="qr-loading">
                    Gerando QR...
                  </p>
                )}
              </>
            )}

            {step === "naming" && (
              <p className="qr-sub success">
                WhatsApp conectado 🎉
              </p>
            )}

          </div>
        </div>
      )}

    </div>
  )
}