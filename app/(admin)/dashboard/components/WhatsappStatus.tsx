"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowUpRight, Clock3, LoaderCircle, Phone, Wifi, WifiOff } from "lucide-react"
import styles from "./WhatsappStatus.module.css"

type Status = "online" | "offline" | "connecting"
type StatusResponse = {
  status?: string
  phone?: string | null
  lastSeen?: string | null
}

function normalizeStatus(value: string): Status {
  const clean = value.toLowerCase().trim()
  if (["online", "ready", "connected"].includes(clean)) return "online"
  if (["connecting", "initializing", "authenticated", "qr"].includes(clean)) return "connecting"
  return "offline"
}

function formatLastSeen(value?: string | null) {
  if (!value) return "—"
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return "—"
  const diff = Math.max(0, Math.floor((Date.now() - timestamp) / 60000))
  if (diff < 1) return "agora"
  if (diff < 60) return diff + " min atrás"
  if (diff < 1440) return Math.floor(diff / 60) + "h atrás"
  return Math.floor(diff / 1440) + "d atrás"
}

export default function WhatsappStatus() {
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [connection, setConnection] = useState<StatusResponse | null>(null)

  useEffect(() => {
    let active = true
    let requestInFlight = false
    let controller: AbortController | null = null

    async function loadStatus() {
      if (requestInFlight || document.visibilityState === "hidden") return
      requestInFlight = true
      controller = new AbortController()
      const timeout = window.setTimeout(() => controller?.abort(), 12000)

      try {
        const response = await fetch("https://api.modapink.phand.com.br/status", {
          cache: "no-store",
          signal: controller.signal
        })
        if (!response.ok) throw new Error("Status do WhatsApp indisponível")
        const result: StatusResponse = await response.json()
        if (!result.status) throw new Error("Resposta de status inválida")
        if (!active) return
        setConnection(result)
        setUnavailable(false)
      } catch (error) {
        if (active) {
          console.warn("Não foi possível consultar a conexão do WhatsApp:", error)
          setUnavailable(true)
        }
      } finally {
        window.clearTimeout(timeout)
        requestInFlight = false
        if (active) setLoading(false)
      }
    }

    void loadStatus()
    const interval = window.setInterval(() => void loadStatus(), 15000)
    const onVisibility = () => {
      if (document.visibilityState === "visible") void loadStatus()
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      active = false
      controller?.abort()
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  const status = connection?.status ? normalizeStatus(connection.status) : "connecting"
  const statusText = { online: "Conectado", offline: "Desconectado", connecting: "Conectando" }
  const StatusIcon = unavailable ? WifiOff : status === "online" ? Wifi : status === "offline" ? WifiOff : LoaderCircle
  const label = loading ? "Verificando" : unavailable ? "Consulta indisponível" : statusText[status]
  const statusClass = unavailable ? styles.unavailable : styles[status]

  return (
    <article className={styles.card} aria-busy={loading}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Conexão</span>
          <h2>WhatsApp</h2>
        </div>
        <span className={styles.badge + " " + statusClass} role="status">
          <StatusIcon size={12} aria-hidden="true" className={!unavailable && status === "connecting" ? styles.spin : undefined} />
          {label}
        </span>
      </header>

      <div className={styles.connection}>
        <span className={styles.connectionIcon}><Phone size={18} aria-hidden="true" /></span>
        <div>
          <strong>Atendimento automático 1</strong>
          <span>{connection?.phone || (loading ? "Carregando número…" : unavailable ? "Número indisponível" : "Sem número conectado")}</span>
        </div>
      </div>

      <div className={styles.lastActivity}>
        <span><Clock3 size={13} aria-hidden="true" />Última atividade</span>
        <strong>{formatLastSeen(connection?.lastSeen)}</strong>
      </div>

      {unavailable && (
        <p className={styles.notice}>
          {connection ? "A consulta falhou. Os dados exibidos são da última atualização." : "Não foi possível confirmar a conexão. Tentaremos novamente em instantes."}
        </p>
      )}

      <Link href="/dashboard/numeros" className={styles.manage}>
        Gerenciar números<ArrowUpRight size={14} aria-hidden="true" />
      </Link>
    </article>
  )
}
