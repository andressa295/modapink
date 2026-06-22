"use client"

import { useCallback, useEffect, useState } from "react"

import styles from "./RecentConversations.module.css"

import { createClient } from "@/lib/supabase/client"

type Conversation = {
  id: string
  name: string
  phone: string
  message: string
  time: string
}

function formatTime(
  dateString?: string | null
) {
  if (!dateString) {
    return "—"
  }

  const date =
    new Date(dateString)

  const diff =
    Math.floor(
      (
        Date.now() -
        date.getTime()
      ) / 60000
    )

  if (diff <= 1) {
    return "agora"
  }

  if (diff < 60) {
    return `${diff} min atrás`
  }

  if (diff < 1440) {
    return `${Math.floor(diff / 60)}h atrás`
  }

  return `${Math.floor(diff / 1440)}d atrás`
}

function formatPhone(
  phone?: string | null
) {
  if (!phone) {
    return "Sem número"
  }

  return phone
    .replace("@c.us", "")
    .replace("@lid", "")
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
          .limit(20)

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
            .slice(0, 3)
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
                conv.last_message ||
                "Sem mensagem",

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
    <div
      className={
        styles["dashboard-card"]
      }
    >
      <h3>
        Conversas recentes
      </h3>

      <div
        className={
          styles["conversation-list"]
        }
      >
        {loading && (
          <p className={styles.empty}>
            Carregando...
          </p>
        )}

        {!loading &&
          conversations.length === 0 && (
            <p className={styles.empty}>
              Nenhuma conversa ainda
            </p>
          )}

        {!loading &&
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={
                styles["conversation-item"]
              }
            >
              <div
                className={
                  styles["conversation-content"]
                }
              >
                <strong
                  className={
                    styles["conversation-name"]
                  }
                >
                  {conv.name}
                </strong>

                <p
                  className={
                    styles["conversation-message"]
                  }
                >
                  {conv.message}
                </p>

                <small
                  className={
                    styles["conversation-phone"]
                  }
                >
                  {conv.phone}
                </small>
              </div>

              <span
                className={
                  styles["conversation-time"]
                }
              >
                {conv.time}
              </span>
            </div>
          ))}
      </div>
    </div>
  )
}