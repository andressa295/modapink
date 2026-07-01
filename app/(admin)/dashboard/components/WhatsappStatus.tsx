"use client"

import { useEffect, useState } from "react"

import {
  Activity,
  Clock3,
  LoaderCircle,
  Phone,
  Wifi,
  WifiOff
} from "lucide-react"

import styles from "./WhatsappStatus.module.css"

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
  const [mounted, setMounted] = useState(false)

  const [loading, setLoading] = useState(true)

  const [status, setStatus] = useState<Status>("connecting")

  const [phone, setPhone] = useState("Não conectado")

  const [lastSeen, setLastSeen] = useState("—")

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) {
      return
    }

    async function loadStatus() {
      try {
        const res = await fetch(
          "https://api.modapink.phand.com.br/status",
          {
            cache: "no-store"
          }
        )

        if (!res.ok) {
          throw new Error("Erro ao buscar status")
        }

        const data: StatusResponse = await res.json()

        setStatus(data.status || "offline")

        setPhone(data.phone || "Não conectado")

        if (!data.lastSeen) {
          setLastSeen("—")
        } else {
          const date = new Date(data.lastSeen)

          const diff = Math.floor(
            (Date.now() - date.getTime()) / 60000
          )

          if (diff < 1) {
            setLastSeen("agora")
          } else if (diff < 60) {
            setLastSeen(`${diff} min atrás`)
          } else {
            setLastSeen(`${Math.floor(diff / 60)}h atrás`)
          }
        }
      } catch (err) {
        console.error("Erro ao buscar status do WhatsApp:", err)

        setStatus("offline")
        setPhone("Não conectado")
        setLastSeen("—")
      } finally {
        setLoading(false)
      }
    }

    loadStatus()

    const interval = window.setInterval(
      loadStatus,
      5000
    )

    return () => window.clearInterval(interval)
  }, [mounted])

  if (!mounted) {
    return null
  }

  const statusText = {
    online: "Online",
    offline: "Offline",
    connecting: "Conectando"
  }

  const StatusIcon =
    status === "online"
      ? Wifi
      : status === "offline"
        ? WifiOff
        : LoaderCircle

  return (
    <article className={styles["dashboard-card"]}>
      <div className={styles["card-glow"]} />

      <header className={styles["card-header"]}>
        <div className={styles["card-title-group"]}>
          <span className={styles["card-icon"]}>
            <Activity size={17} />
          </span>

          <div>
            <span className={styles["card-kicker"]}>
              Conexão
            </span>

            <h3>
              Status do WhatsApp
            </h3>
          </div>
        </div>

        {!loading && (
          <span
            className={`
              ${styles["status-badge"]}
              ${styles[status]}
            `}
          >
            <StatusIcon
              size={13}
              className={
                status === "connecting"
                  ? styles["spin-icon"]
                  : undefined
              }
            />

            {statusText[status]}
          </span>
        )}
      </header>

      <div className={styles["status-box"]}>
        <div
          className={`
            ${styles["status-indicator"]}
            ${styles[status]}
          `}
        />

        <div>
          <span className={styles["status-label"]}>
            {loading ? "Carregando..." : statusText[status]}
          </span>

          <small>
            Monitoramento automático da sessão principal
          </small>
        </div>
      </div>

      <div className={styles["info-list"]}>
        <div className={styles["info-item"]}>
          <span className={styles["info-icon"]}>
            <Phone size={15} />
          </span>

          <div>
            <small>Número conectado</small>
            <strong>{phone}</strong>
          </div>
        </div>

        <div className={styles["info-item"]}>
          <span className={styles["info-icon"]}>
            <Clock3 size={15} />
          </span>

          <div>
            <small>Última atividade</small>
            <strong>{lastSeen}</strong>
          </div>
        </div>
      </div>
    </article>
  )
}