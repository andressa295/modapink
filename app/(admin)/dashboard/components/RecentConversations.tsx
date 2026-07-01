"use client"

import Link from "next/link"

import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react"

import {
  ArrowUpRight,
  Clock3,
  MessageCircle,
  Phone,
  Wifi
} from "lucide-react"

import styles from "./RecentConversations.module.css"

import { createClient } from "@/lib/supabase/client"

type Conversation = {
  id: string
  name: string
  phone: string
  message: string
  time: string
}

function formatTime(dateString?: string | null) {
  if (!dateString) {
    return "—"
  }

  const date =
    new Date(dateString)

  const diff =
    Math.floor(
      (Date.now() - date.getTime()) / 60000
    )

  if (diff <= 1) {
    return "agora"
  }

  if (diff < 60) {
    return `${diff} min`
  }

  if (diff < 1440) {
    return `${Math.floor(diff / 60)}h`
  }

  return `${Math.floor(diff / 1440)}d`
}

function formatPhone(phone?: string | null) {
  if (!phone) {
    return "Sem número"
  }

  return phone
    .replace("@c.us", "")
    .replace("@lid", "")
}

function getInitials(name?: string) {
  if (!name) {
    return "C"
  }

  const clean =
    name
      .trim()
      .replace(/\s+/g, " ")

  const parts =
    clean.split(" ")

  if (parts.length === 1) {
    return clean
      .charAt(0)
      .toUpperCase()
  }

  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`
    .toUpperCase()
}

function shortMessage(message?: string) {
  if (!message) {
    return "Sem mensagem recente"
  }

  return message
    .replace(/\s+/g, " ")
    .trim()
}

export default function RecentConversations() {
  const [
    conversations,
    setConversations
  ] = useState<Conversation[]>([])

  const [
    loading,
    setLoading
  ] = useState(true)

  const totalLabel =
    useMemo(() => {
      if (loading) {
        return "Sincronizando"
      }

      if (conversations.length === 1) {
        return "1 conversa"
      }

      return `${conversations.length} conversas`
    }, [
      loading,
      conversations.length
    ])

  const loadConversations =
    useCallback(async () => {
      const supabase =
        createClient()

      try {
        const {
          data,
          error
        } = await supabase
          .from("conversations")
          .select(`
            id,
            customer_name,
            phone,
            last_message,
            last_message_at,
            updated_at
          `)
          .not(
            "phone",
            "is",
            null
          )
          .order(
            "last_message_at",
            {
              ascending: false,
              nullsFirst: false
            }
          )
          .limit(30)

        if (error) {
          console.error(
            "Erro conversations:",
            error
          )

          setLoading(false)

          return
        }

        const uniqueByPhone =
          new Map<string, any>()

        data?.forEach((conv: any) => {
          const phone =
            conv.phone

          if (!phone) {
            return
          }

          if (!uniqueByPhone.has(phone)) {
            uniqueByPhone.set(
              phone,
              conv
            )
          }
        })

        const formatted =
          Array.from(
            uniqueByPhone.values()
          )
            .slice(0, 4)
            .map((conv: any) => ({
              id:
                conv.id,

              name:
                conv.customer_name ||
                formatPhone(conv.phone) ||
                "Cliente",

              phone:
                formatPhone(conv.phone),

              message:
                shortMessage(
                  conv.last_message
                ),

              time:
                formatTime(
                  conv.last_message_at ||
                  conv.updated_at
                )
            }))

        setConversations(
          formatted
        )
      } catch (err) {
        console.error(
          "💥 erro loadConversations:",
          err
        )
      } finally {
        setLoading(false)
      }
    }, [])

  useEffect(() => {
    const supabase =
      createClient()

    loadConversations()

    const interval =
      setInterval(
        loadConversations,
        10000
      )

    const channel =
      supabase
        .channel("dashboard-recent-conversations")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "conversations"
          },
          () => {
            loadConversations()
          }
        )
        .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [loadConversations])

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.iconBox}>
            <MessageCircle size={18} />
          </div>

          <div>
            <span className={styles.eyebrow}>
              Atendimento
            </span>

            <h3>
              Conversas recentes
            </h3>
          </div>
        </div>

        <div className={styles.headerRight}>
          <span className={styles.liveBadge}>
            <Wifi size={12} />
            Ao vivo
          </span>

          <Link
            href="/dashboard/conversas"
            className={styles.viewAll}
          >
            Ver todas
            <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>

      <div className={styles.summary}>
        <div>
          <strong>
            {totalLabel}
          </strong>

          <span>
            Últimas interações do WhatsApp.
          </span>
        </div>

        <span className={styles.sync}>
          <Clock3 size={12} />
          10s
        </span>
      </div>

      <div className={styles.list}>
        {loading && (
          <>
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className={styles.skeleton}
              >
                <div className={styles.skeletonAvatar} />

                <div className={styles.skeletonLines}>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ))}
          </>
        )}

        {!loading &&
          conversations.length === 0 && (
            <div className={styles.empty}>
              <strong>
                Nenhuma conversa ainda
              </strong>

              <span>
                Quando uma cliente chamar, a conversa aparece aqui.
              </span>
            </div>
          )}

        {!loading &&
          conversations.map((conv) => (
            <Link
              key={conv.id}
              href={`/dashboard/conversas?conversation=${conv.id}`}
              className={styles.item}
            >
              <div className={styles.avatar}>
                {getInitials(conv.name)}
              </div>

              <div className={styles.content}>
                <div className={styles.top}>
                  <strong>
                    {conv.name}
                  </strong>

                  <span>
                    {conv.time}
                  </span>
                </div>

                <p>
                  {conv.message}
                </p>

                <div className={styles.meta}>
                  <span>
                    <Phone size={11} />
                    {conv.phone}
                  </span>

                  <small>
                    WhatsApp
                  </small>
                </div>
              </div>

              <div className={styles.arrow}>
                <ArrowUpRight size={14} />
              </div>
            </Link>
          ))}
      </div>
    </div>
  )
}