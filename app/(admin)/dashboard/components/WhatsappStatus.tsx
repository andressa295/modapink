"use client"

import { useEffect, useState } from "react"
import "./WhatsappStatus.css"

type Status = "online" | "offline" | "connecting"

export default function WhatsappStatus() {

  const [status, setStatus] = useState<Status>("connecting")
  const [lastSeen, setLastSeen] = useState("—")
  const [phone, setPhone] = useState("+55 11 99999-9999")

  useEffect(() => {

    async function loadStatus() {
      try {
        const res = await fetch("http://localhost:3001/status")
        const data = await res.json()

        setStatus(data.status)
        setPhone(data.phone || "+55 11 99999-9999")

        const date = new Date(data.lastSeen)
        const diff = Math.floor((Date.now() - date.getTime()) / 60000)

        if (diff < 1) setLastSeen("agora")
        else if (diff < 60) setLastSeen(`${diff} min atrás`)
        else setLastSeen(`${Math.floor(diff / 60)}h atrás`)

      } catch {
        setStatus("offline")
      }
    }

    loadStatus()

    const interval = setInterval(loadStatus, 5000)
    return () => clearInterval(interval)

  }, [])

  const statusText = {
    online: "Online",
    offline: "Offline",
    connecting: "Conectando..."
  }

  return (

    <div className="dashboard-card">

      <h3>Status do WhatsApp</h3>

      <div className="whatsapp-status">

        <div className={`status-indicator ${status}`} />

        <span>{statusText[status]}</span>

      </div>

      <p className="whatsapp-number">
        {phone}
      </p>

      <small>
        Última atividade: {lastSeen}
      </small>

    </div>

  )

}