"use client"

import { useEffect, useState } from "react"

import styles from "../styles/relatorios.module.css"

import MetricCard from "../components/reports/MetricCard"

import { createClient } from "@/lib/supabase/client"

type Metrics = {
  conversations: number
  customers: number
  avgResponse: string
  rating: string
}

type ChannelStats = {
  name: string
  chats: number
  response: string
  rating: string
}

type AttendanceChannel = {
  id: "principal" | "vendedora_1" | "sac"
  name: string
}

const ATTENDANCE_CHANNELS: AttendanceChannel[] = [
  {
    id: "principal",
    name: "Número principal"
  },
  {
    id: "vendedora_1",
    name: "Vendedora 1"
  },
  {
    id: "sac",
    name: "SAC"
  }
]

function getFromDate(range: string) {
  const date =
    new Date()

  if (range === "today") {
    date.setHours(0, 0, 0, 0)

    return date
  }

  if (range === "7d") {
    date.setDate(
      date.getDate() - 7
    )

    date.setHours(0, 0, 0, 0)

    return date
  }

  if (range === "30d") {
    date.setDate(
      date.getDate() - 30
    )

    date.setHours(0, 0, 0, 0)

    return date
  }

  date.setHours(0, 0, 0, 0)

  return date
}

function formatTimeFromMs(
  ms: number | null
) {
  if (
    ms === null ||
    !Number.isFinite(ms) ||
    ms <= 0
  ) {
    return "—"
  }

  const totalSeconds =
    Math.floor(ms / 1000)

  const minutes =
    Math.floor(totalSeconds / 60)

  const seconds =
    totalSeconds % 60

  if (minutes <= 0) {
    return `${seconds}s`
  }

  if (minutes < 60) {
    return `${minutes}m ${seconds}s`
  }

  const hours =
    Math.floor(minutes / 60)

  const restMinutes =
    minutes % 60

  return `${hours}h ${restMinutes}m`
}

function calculateAverageResponseMs(
  messages: any[]
) {
  if (
    !messages ||
    messages.length === 0
  ) {
    return null
  }

  const byConversation =
    new Map<string, any[]>()

  messages.forEach((message: any) => {
    if (!message.conversation_id) {
      return
    }

    const list =
      byConversation.get(
        message.conversation_id
      ) || []

    list.push(message)

    byConversation.set(
      message.conversation_id,
      list
    )
  })

  const responseTimes: number[] = []

  byConversation.forEach((list) => {
    const ordered =
      [...list].sort(
        (a: any, b: any) =>
          new Date(a.created_at).getTime() -
          new Date(b.created_at).getTime()
      )

    for (
      let i = 0;
      i < ordered.length;
      i++
    ) {
      const current =
        ordered[i]

      if (current.sender !== "user") {
        continue
      }

      const nextAgent =
        ordered
          .slice(i + 1)
          .find(
            (item: any) =>
              item.sender === "agent"
          )

      if (!nextAgent) {
        continue
      }

      const diff =
        new Date(nextAgent.created_at).getTime() -
        new Date(current.created_at).getTime()

      if (diff > 0) {
        responseTimes.push(diff)
      }
    }
  })

  if (responseTimes.length === 0) {
    return null
  }

  return (
    responseTimes.reduce(
      (sum, value) => sum + value,
      0
    ) / responseTimes.length
  )
}

function normalizeText(
  value?: string | null
) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

function isPrincipalConversation(
  conversation: any
) {
  const session =
    normalizeText(
      conversation.session_key
    )

  const assignedTo =
    normalizeText(
      conversation.assigned_to
    )

  const state =
    normalizeText(
      conversation.state
    )

  const mode =
    normalizeText(
      conversation.mode
    )

  const isSac =
    session === "sac" ||
    assignedTo === "sac" ||
    state === "sac" ||
    mode === "sac"

  const isVendedora =
    session === "vendedora_1" ||
    session === "vendedora1" ||
    session === "vendedora" ||
    assignedTo === "vendedora_1" ||
    assignedTo === "vendedora1" ||
    assignedTo === "vendedora"

  if (
    isSac ||
    isVendedora
  ) {
    return false
  }

  return (
    session === "principal" ||
    session === "" ||
    !session
  )
}

function isVendedoraConversation(
  conversation: any
) {
  const session =
    normalizeText(
      conversation.session_key
    )

  const assignedTo =
    normalizeText(
      conversation.assigned_to
    )

  return (
    session === "vendedora_1" ||
    session === "vendedora1" ||
    session === "vendedora" ||
    assignedTo === "vendedora_1" ||
    assignedTo === "vendedora1" ||
    assignedTo === "vendedora"
  )
}

function isSacConversation(
  conversation: any
) {
  const session =
    normalizeText(
      conversation.session_key
    )

  const assignedTo =
    normalizeText(
      conversation.assigned_to
    )

  const state =
    normalizeText(
      conversation.state
    )

  const mode =
    normalizeText(
      conversation.mode
    )

  return (
    session === "sac" ||
    assignedTo === "sac" ||
    state === "sac" ||
    mode === "sac"
  )
}

function filterConversationsByChannel(
  conversations: any[],
  channelId: AttendanceChannel["id"]
) {
  if (channelId === "principal") {
    return conversations.filter(
      isPrincipalConversation
    )
  }

  if (channelId === "vendedora_1") {
    return conversations.filter(
      isVendedoraConversation
    )
  }

  if (channelId === "sac") {
    return conversations.filter(
      isSacConversation
    )
  }

  return []
}

export default function Relatorios() {
  const [
    range,
    setRange
  ] = useState("today")

  const [
    metrics,
    setMetrics
  ] = useState<Metrics>({
    conversations: 0,
    customers: 0,
    avgResponse: "—",
    rating: "—"
  })

  const [
    channels,
    setChannels
  ] = useState<ChannelStats[]>([])

  const [
    loading,
    setLoading
  ] = useState(true)

  useEffect(() => {
    const supabase =
      createClient()

    async function loadData() {
      setLoading(true)

      const fromDate =
        getFromDate(range)

      const fromIso =
        fromDate.toISOString()

      const {
        data: conversations,
        error: conversationsError
      } = await supabase
        .from("conversations")
        .select(`
          id,
          phone,
          customer_id,
          customer_name,
          assigned_to,
          session_key,
          state,
          mode,
          created_at,
          last_message_at
        `)
        .gte("created_at", fromIso)

      if (conversationsError) {
        console.error(
          "Erro conversations:",
          conversationsError
        )
      }

      const {
        data: messages,
        error: messagesError
      } = await supabase
        .from("messages")
        .select(`
          id,
          conversation_id,
          sender,
          created_at
        `)
        .gte("created_at", fromIso)
        .order("created_at", {
          ascending: true
        })

      if (messagesError) {
        console.error(
          "Erro messages:",
          messagesError
        )
      }

      const conversationsList =
        conversations || []

      const messagesList =
        messages || []

      const uniqueCustomers =
        new Set(
          conversationsList
            .map((conversation: any) =>
              conversation.phone ||
              conversation.customer_id ||
              conversation.customer_name
            )
            .filter(Boolean)
        )

      const avgResponseMs =
        calculateAverageResponseMs(
          messagesList
        )

      const avgResponse =
        formatTimeFromMs(
          avgResponseMs
        )

      let rating =
        "—"

      const {
        data: reviews,
        error: reviewsError
      } = await supabase
        .from("conversation_reviews")
        .select("rating, created_at")
        .gte("created_at", fromIso)

      if (
        !reviewsError &&
        reviews &&
        reviews.length > 0
      ) {
        const ratings =
          reviews
            .map((review: any) =>
              Number(review.rating)
            )
            .filter(
              (value: number) =>
                Number.isFinite(value)
            )

        if (ratings.length > 0) {
          const avgRating =
            ratings.reduce(
              (sum, value) => sum + value,
              0
            ) / ratings.length

          rating =
            avgRating.toFixed(1)
        }
      }

      const channelStats =
        ATTENDANCE_CHANNELS.map((channel) => {
          const channelConversations =
            filterConversationsByChannel(
              conversationsList,
              channel.id
            )

          const channelConversationIds =
            new Set(
              channelConversations.map(
                (conversation: any) =>
                  conversation.id
              )
            )

          const channelMessages =
            messagesList.filter(
              (message: any) =>
                channelConversationIds.has(
                  message.conversation_id
                )
            )

          const channelAvgMs =
            calculateAverageResponseMs(
              channelMessages
            )

          return {
            name:
              channel.name,

            chats:
              channelConversations.length,

            response:
              formatTimeFromMs(
                channelAvgMs
              ),

            rating
          }
        })

      setMetrics({
        conversations:
          conversationsList.length,

        customers:
          uniqueCustomers.size,

        avgResponse,

        rating
      })

      setChannels(
        channelStats
      )

      setLoading(false)
    }

    loadData()
  }, [range])

  return (
    <div className={styles["reports-page"]}>
      <div className={styles["reports-header"]}>
        <div>
          <div className={styles["reports-title"]}>
            Relatórios
          </div>

          <div className={styles["reports-subtitle"]}>
            Acompanhe conversas, clientes e desempenho dos canais.
          </div>
        </div>

        <select
          className={styles["reports-filter"]}
          value={range}
          onChange={(e) =>
            setRange(e.target.value)
          }
        >
          <option value="today">
            Hoje
          </option>

          <option value="7d">
            Últimos 7 dias
          </option>

          <option value="30d">
            Últimos 30 dias
          </option>
        </select>
      </div>

      <div className={styles["metrics-grid"]}>
        <MetricCard
          title="Conversas"
          value={
            loading
              ? "..."
              : metrics.conversations
          }
        />

        <MetricCard
          title="Clientes atendidos"
          value={
            loading
              ? "..."
              : metrics.customers
          }
        />

        <MetricCard
          title="Tempo médio resposta"
          value={
            loading
              ? "..."
              : metrics.avgResponse
          }
        />

        <MetricCard
          title="Avaliação média"
          value={
            loading
              ? "..."
              : metrics.rating === "—"
                ? "—"
                : `${metrics.rating} ⭐`
          }
        />
      </div>

      <div className={styles["report-table"]}>
        <div className={`${styles["report-row"]} ${styles.header}`}>
          <div>
            Canal
          </div>

          <div>
            Conversas
          </div>

          <div>
            Tempo médio
          </div>

          <div>
            Avaliação
          </div>
        </div>

        {loading && (
          <div className={styles["report-empty"]}>
            Carregando relatórios...
          </div>
        )}

        {!loading &&
          channels.map((channel) => (
            <div
              key={channel.name}
              className={styles["report-row"]}
            >
              <div className={styles["channel-name"]}>
                {channel.name}
              </div>

              <div>
                {channel.chats}
              </div>

              <div>
                {channel.response}
              </div>

              <div>
                {channel.rating}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}
