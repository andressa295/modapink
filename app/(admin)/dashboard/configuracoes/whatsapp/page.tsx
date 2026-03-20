"use client"

import { useEffect, useState } from "react"

export default function WhatsAppConfig() {
  const [qr, setQr] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  async function loadQR() {
    try {
      const res = await fetch("http://localhost:3001/qr")
      const data = await res.json()

      setQr(data.qr)
      setConnected(data.connected)
    } catch (err) {
      console.error("Erro ao buscar QR", err)
    }
  }

  useEffect(() => {
    loadQR()

    const interval = setInterval(loadQR, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{ padding: 40 }}>

      <h1 style={{ fontSize: 22, fontWeight: 600 }}>
        Conectar WhatsApp
      </h1>

      {connected ? (
        <p style={{ color: "green", marginTop: 20 }}>
          ✅ WhatsApp conectado!
        </p>
      ) : (
        <div style={{ marginTop: 20 }}>

          <p style={{ marginBottom: 10 }}>
            Escaneie o QR Code com seu WhatsApp
          </p>

          {qr ? (
            <img src={qr} width={260} />
          ) : (
            <p>Gerando QR Code...</p>
          )}

        </div>
      )}

    </div>
  )
}