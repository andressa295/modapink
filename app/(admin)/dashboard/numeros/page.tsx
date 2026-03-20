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
  const [channelName, setChannelName] = useState("")
  const [saving, setSaving] = useState(false)

  // MOCK inicial
  useEffect(() => {
    setNumbers([
      {
        setor: "Vendas",
        phone: "(11) 9999-0000",
        status: "offline",
        users: ["Rafaela", "Bruna"]
      },
      {
        setor: "SAC",
        phone: "(11) 9999-1111",
        status: "offline",
        users: ["Rodrigo"]
      },
      {
        setor: "Logística",
        phone: "(11) 9999-2222",
        status: "offline",
        users: []
      }
    ])
  }, [])

  // 🔥 FETCH ROBUSTO
  async function loadQR() {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 4000)

      const res = await fetch("http://localhost:3001/qr", {
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
      // 🔥 NÃO quebrar UI
      console.log("Aguardando backend...")
    }
  }

  // 🔁 polling INTELIGENTE
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

  // abrir modal
  function handleOpenModal() {
    setShowQR(true)
    setStep("qr")
    setQr(null)
    setConnected(false)
    setChannelName("")
    setInitializing(true)
  }

  // salvar canal
  async function handleSaveChannel() {
    if (!channelName.trim()) return

    try {
      setSaving(true)

      const newNumber: NumberType = {
        setor: channelName,
        phone: "Conectado agora",
        status: "online",
        users: []
      }

      setNumbers((prev) => [...prev, newNumber])

      setShowQR(false)
      setChannelName("")
      setStep("qr")

    } catch (err) {
      console.error("Erro ao salvar canal", err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="numbers-page">

      {/* HEADER */}
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

      {/* GRID */}
      <div className="numbers-grid">
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

      {/* MODAL */}
      {showQR && (
        <div className="qr-modal">
          <div className="qr-box">

            <div className="qr-header">
              <h2>Conectar WhatsApp</h2>
              <button onClick={() => setShowQR(false)}>✕</button>
            </div>

            {/* 🔥 ESTADO: INICIALIZANDO */}
            {initializing && step === "qr" && (
              <p className="qr-loading">
                Conectando ao WhatsApp...
              </p>
            )}

            {/* QR */}
            {step === "qr" && !initializing && (
              <>
                <p className="qr-sub">
                  Escaneie o QR Code
                </p>

                {qr ? (
                  <div className="qr-image">
                    <img src={qr} />
                  </div>
                ) : (
                  <p className="qr-loading">
                    Gerando QR...
                  </p>
                )}
              </>
            )}

            {/* NOME */}
            {step === "naming" && (
              <>
                <p className="qr-sub success">
                  WhatsApp conectado 🎉
                </p>

                <input
                  type="text"
                  placeholder="Nome do canal"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  className="qr-input"
                />

                <button
                  className="qr-save"
                  onClick={handleSaveChannel}
                  disabled={!channelName || saving}
                >
                  {saving ? "Salvando..." : "Salvar canal"}
                </button>
              </>
            )}

          </div>
        </div>
      )}

    </div>
  )
}