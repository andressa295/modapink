"use client"

import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowUpRight } from "lucide-react"
import styles from "./RecentConversations.module.css"
import { createClient } from "@/lib/supabase/client"

type ConversationRow = {
  id: string
  customer_name: string | null
  phone: string | null
  last_message: string | null
  last_message_at: string | null
  updated_at: string | null
}

type Conversation = {
  id: string
  name: string
  phone: string
  message: string
  time: string
}

function formatTime(value?: string | null) {
  if (!value) return "—"
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return "—"
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000))
  if (minutes <= 1) return "agora"
  if (minutes < 60) return minutes + " min"
  if (minutes < 1440) return Math.floor(minutes / 60) + "h"
  return Math.floor(minutes / 1440) + "d"
}

function formatPhone(value?: string | null) {
  if (!value || value.endsWith("@lid")) return "Contato WhatsApp"
  return value.replace("@c.us", "")
}

function getInitials(name: string) {
  const parts = name.trim().replace(/\s+/g, " ").split(" ")
  return (parts[0].charAt(0) + (parts[1]?.charAt(0) || "")).toUpperCase()
}

export default function RecentConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let active = true
    let requestInFlight = false

    async function loadConversations() {
      if (requestInFlight || document.visibilityState === "hidden") return
      requestInFlight = true

      try {
        const { data, error } = await supabase
          .from("conversations")
          .select("id, customer_name, phone, last_message, last_message_at, updated_at")
          .not("phone", "is", null)
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .limit(30)

        if (error) throw error
        const uniqueByPhone = new Map<string, ConversationRow>()
        for (const conversation of (data || []) as ConversationRow[]) {
          if (conversation.phone && !uniqueByPhone.has(conversation.phone)) {
            uniqueByPhone.set(conversation.phone, conversation)
          }
        }
        const formatted = Array.from(uniqueByPhone.values()).slice(0, 4).map((conversation) => ({
          id: conversation.id,
          name: conversation.customer_name?.trim() || (conversation.phone?.endsWith("@lid") ? "Cliente" : formatPhone(conversation.phone)),
          phone: formatPhone(conversation.phone),
          message: conversation.last_message?.replace(/\s+/g, " ").trim() || "Sem mensagem recente",
          time: formatTime(conversation.last_message_at || conversation.updated_at)
        }))

        if (active) {
          setConversations(formatted)
          setUnavailable(false)
        }
      } catch (error) {
        console.warn("Não foi possível carregar conversas recentes:", error)
        if (active) setUnavailable(true)
      } finally {
        requestInFlight = false
        if (active) setLoading(false)
      }
    }

    void loadConversations()
    const interval = window.setInterval(() => void loadConversations(), 10000)
    const channel = supabase
      .channel("dashboard-recent-conversations")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => void loadConversations())
      .subscribe()
    const onVisibility = () => {
      if (document.visibilityState === "visible") void loadConversations()
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      active = false
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisibility)
      void supabase.removeChannel(channel)
    }
  }, [])

  return (
    <article className={styles.card} aria-busy={loading}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Atendimento</span>
          <h2>Últimas conversas</h2>
        </div>
        <Link href="/dashboard/conversas" className={styles.viewAll}>
          <WhatsAppIcon size={15} aria-hidden="true" />Abrir atendimento<ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </header>

      <div className={styles.list}>
        {loading && [1, 2, 3, 4].map((item) => (
          <div key={item} className={styles.skeleton} aria-hidden="true">
            <span className={styles.skeletonAvatar} />
            <div><span /><span /></div>
          </div>
        ))}

        {!loading && !unavailable && conversations.length === 0 && (
          <div className={styles.empty}>
            <WhatsAppIcon size={22} aria-hidden="true" />
            <strong>Nenhuma conversa por enquanto</strong>
            <span>As próximas interações do WhatsApp aparecerão aqui.</span>
          </div>
        )}

        {!loading && conversations.map((conversation) => (
          <Link key={conversation.id} href={"/dashboard/conversas?conversation=" + encodeURIComponent(conversation.id)} className={styles.item}>
            <span className={styles.avatar} aria-hidden="true">{getInitials(conversation.name)}</span>
            <div className={styles.content}>
              <div className={styles.customer}>
                <strong>{conversation.name}</strong>
                <small>{conversation.phone}</small>
              </div>
              <p>{conversation.message}</p>
              <span className={styles.time}>{conversation.time}</span>
            </div>
            <ArrowUpRight size={14} className={styles.arrow} aria-hidden="true" />
          </Link>
        ))}
      </div>

      {unavailable && (
        <p className={styles.notice} role="status">
          {conversations.length ? "Atualização indisponível. Exibindo as últimas conversas carregadas." : "Não foi possível carregar as conversas. Tentaremos novamente em instantes."}
        </p>
      )}
    </article>
  )
}
