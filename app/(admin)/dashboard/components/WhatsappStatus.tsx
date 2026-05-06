"use client"

import { useEffect, useState } from "react"
import "./WhatsappStatus.css"

type Status =
  | "online"
  | "offline"
  | "connecting"

type StatusResponse = {
  status?: Status
  phone?: string | null
  lastSeen?: string | null
}

export default function WhatsappStatus() {
  // =======================
  // HYDRATION FIX
  // =======================
  const [mounted, setMounted] =
    useState(false)

  // =======================
  // STATES
  // =======================
  const [loading, setLoading] =
    useState(true)

  const [status, setStatus] =
    useState<Status>("connecting")

  const [phone, setPhone] =
    useState("Não conectado")

  const [lastSeen, setLastSeen] =
    useState("—")

  // =======================
  // MOUNT
  // =======================
  useEffect(() => {
    setMounted(true)
  }, [])

  // =======================
  // LOAD STATUS
  // =======================
  useEffect(() => {
    if (!mounted) return

    async function loadStatus() {
      try {
        const res = await fetch(
          "https://api.modapink.phand.com.br/status",
          {
            cache: "no-store"
          }
        )

        if (!res.ok) {
          throw new Error(
            "Erro ao buscar status"
          )
        }

        const data: StatusResponse =
          await res.json()

        // =======================
        // STATUS
        // =======================
        setStatus(
          data.status || "offline"
        )

        // =======================
        // PHONE
        // =======================
        setPhone(
          data.phone ||
            "Não conectado"
        )

        // =======================
        // LAST SEEN
        // =======================
        if (!data.lastSeen) {
          setLastSeen("—")
        } else {
          const date = new Date(
            data.lastSeen
          )

          const diff = Math.floor(
            (Date.now() -
              date.getTime()) /
              60000
          )

          if (diff < 1) {
            setLastSeen("agora")
          } else if (diff < 60) {
            setLastSeen(
              `${diff} min atrás`
            )
          } else {
            setLastSeen(
              `${Math.floor(
                diff / 60
              )}h atrás`
            )
          }
        }

      } catch (err) {
        console.error(
          "❌ erro status:",
          err
        )

        setStatus("offline")

        setPhone("Não conectado")

        setLastSeen("—")

      } finally {
        setLoading(false)
      }
    }

    loadStatus()

    // =======================
    // AUTO UPDATE
    // =======================
    const interval = setInterval(
      loadStatus,
      5000
    )

    return () =>
      clearInterval(interval)

  }, [mounted])

  // =======================
  // EVITA HYDRATION ERROR
  // =======================
  if (!mounted) {
    return null
  }

  const statusText = {
    online: "Online",
    offline: "Offline",
    connecting: "Conectando..."
  }

  return (
    <div className="dashboard-card">
      <div className="card-header">
        <h3>
          Status do WhatsApp
        </h3>

        {!loading && (
          <span
            className={`status-badge ${status}`}
          >
            {statusText[status]}
          </span>
        )}
      </div>

      <div className="whatsapp-status">
        <div
          className={`status-indicator ${status}`}
        />

        <span>
          {loading
            ? "Carregando..."
            : statusText[status]}
        </span>
      </div>

      <p className="whatsapp-number">
        {phone}
      </p>

      <small>
        Última atividade:
        {" "}
        {lastSeen}
      </small>
    </div>
  )
}