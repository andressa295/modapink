// app/(admin)/dashboard/components/DashboardMetrics.tsx

"use client"

import {
  useEffect,
  useState
} from "react"

import {
  MessageCircle,
  Users,
  Clock,
  Star
} from "lucide-react"

import MetricCard from "./MetricCard"

import {
  createClient
} from "@/lib/supabase/client"

type Metrics = {
  conversationsToday: number
  clientsToday: number
  averageTime: string
  averageTimeTrend: string
  rating: string
  ratingTrend: string
}

function startOfToday() {
  const date =
    new Date()

  date.setHours(
    0,
    0,
    0,
    0
  )

  return date
}

function formatAverageMinutes(
  minutes: number | null
) {
  if (
    minutes === null ||
    !Number.isFinite(minutes)
  ) {
    return "—"
  }

  if (minutes < 1) {
    return "agora"
  }

  if (minutes < 60) {
    return `${Math.round(minutes)}min`
  }

  const hours =
    Math.floor(minutes / 60)

  const rest =
    Math.round(minutes % 60)

  if (rest === 0) {
    return `${hours}h`
  }

  return `${hours}h ${rest}min`
}

function formatRating(
  value: number | null
) {
  if (
    value === null ||
    !Number.isFinite(value)
  ) {
    return "—"
  }

  return value.toFixed(1)
}

function getFirstDate(
  values: Array<string | null | undefined>
) {
  const dates =
    values
      .filter(Boolean)
      .map(value =>
        new Date(String(value)).getTime()
      )
      .filter(value =>
        Number.isFinite(value)
      )

  if (!dates.length) {
    return null
  }

  return Math.min(...dates)
}

export default function DashboardMetrics() {
  const [
    metrics,
    setMetrics
  ] = useState<Metrics>({
    conversationsToday: 0,
    clientsToday: 0,
    averageTime: "—",
    averageTimeTrend: "",
    rating: "—",
    ratingTrend: ""
  })

  useEffect(() => {
    const supabase =
      createClient()

    async function loadMetrics() {
      const today =
        startOfToday()

      const todayISO =
        today.toISOString()

      // =========================
      // CONVERSAS DE HOJE
      // =========================

      const {
        data: conversations,
        error: conversationsError
      } = await supabase
        .from("conversations")
        .select(`
          id,
          phone,
          created_at,
          first_response_at,
          last_agent_message_at
        `)
        .gte(
          "created_at",
          todayISO
        )

      if (conversationsError) {
        console.warn(
          "Não foi possível carregar métricas de conversas:",
          conversationsError
        )

        return
      }

      const list =
        conversations || []

      const conversationIds =
        list
          .map((item: any) => item.id)
          .filter(Boolean)

      const conversationsToday =
        list.length

      const clientsToday =
        new Set(
          list
            .map((item: any) => item.phone)
            .filter(Boolean)
        ).size

      // =========================
      // TEMPO MÉDIO
      // Tenta calcular pela tabela messages:
      // primeira mensagem da cliente -> primeira resposta da loja
      // Se não der, usa fallback da tabela conversations.
      // =========================

      let responseTimes: number[] =
        []

      if (
        conversationIds.length
      ) {
        const {
          data: messages,
          error: messagesError
        } = await supabase
          .from("messages")
          .select(`
            conversation_id,
            sender,
            created_at
          `)
          .in(
            "conversation_id",
            conversationIds
          )
          .in(
            "sender",
            [
              "user",
              "agent"
            ]
          )
          .gte(
            "created_at",
            todayISO
          )

        if (messagesError) {
          console.warn(
            "Não foi possível carregar mensagens para tempo médio:",
            messagesError
          )
        }

        const messagesList =
          messages || []

        responseTimes =
          conversationIds
            .map((conversationId: string) => {
              const related =
                messagesList.filter(
                  (message: any) =>
                    message.conversation_id === conversationId
                )

              const firstUserAt =
                getFirstDate(
                  related
                    .filter(
                      (message: any) =>
                        message.sender === "user"
                    )
                    .map(
                      (message: any) =>
                        message.created_at
                    )
                )

              if (!firstUserAt) {
                return null
              }

              const firstAgentAfterUser =
                getFirstDate(
                  related
                    .filter((message: any) => {
                      if (
                        message.sender !== "agent" ||
                        !message.created_at
                      ) {
                        return false
                      }

                      const agentAt =
                        new Date(
                          message.created_at
                        ).getTime()

                      return (
                        Number.isFinite(agentAt) &&
                        agentAt >= firstUserAt
                      )
                    })
                    .map(
                      (message: any) =>
                        message.created_at
                    )
                )

              if (!firstAgentAfterUser) {
                return null
              }

              const diffMinutes =
                (
                  firstAgentAfterUser -
                  firstUserAt
                ) / 1000 / 60

              return diffMinutes
            })
            .filter(
              (
                value: number | null
              ): value is number =>
                value !== null &&
                value >= 0 &&
                Number.isFinite(value)
            )
      }

      // Fallback: usa dados da própria conversa
      if (!responseTimes.length) {
        responseTimes =
          list
            .map((item: any) => {
              const created =
                item.created_at
                  ? new Date(item.created_at).getTime()
                  : null

              const responded =
                item.first_response_at
                  ? new Date(item.first_response_at).getTime()
                  : item.last_agent_message_at
                    ? new Date(item.last_agent_message_at).getTime()
                    : null

              if (
                !created ||
                !responded ||
                !Number.isFinite(created) ||
                !Number.isFinite(responded) ||
                responded < created
              ) {
                return null
              }

              return (
                responded -
                created
              ) / 1000 / 60
            })
            .filter(
              (
                value: number | null
              ): value is number =>
                value !== null &&
                value >= 0 &&
                Number.isFinite(value)
            )
      }

      const averageMinutes =
        responseTimes.length
          ? responseTimes.reduce(
              (
                sum: number,
                value: number
              ) => sum + value,
              0
            ) / responseTimes.length
          : null

      // =========================
      // AVALIAÇÃO MÉDIA
      // Puxa da view conversation_review_stats
      // =========================

      let averageRating: number | null =
        null

      let ratingsCount =
        0

      const {
        data: reviewStats,
        error: reviewsError
      } = await supabase
        .from("conversation_review_stats")
        .select(`
          average_rating,
          answered_reviews,
          pending_reviews
        `)
        .maybeSingle()

      if (reviewsError) {
        console.warn(
          "Avaliações ainda não disponíveis:",
          reviewsError
        )
      }

      if (
        reviewStats &&
        reviewStats.average_rating !== null &&
        reviewStats.average_rating !== undefined
      ) {
        averageRating =
          Number(
            reviewStats.average_rating
          )
      }

      if (
        reviewStats &&
        reviewStats.answered_reviews !== null &&
        reviewStats.answered_reviews !== undefined
      ) {
        ratingsCount =
          Number(
            reviewStats.answered_reviews
          )
      }

      setMetrics({
        conversationsToday,
        clientsToday,

        averageTime:
          formatAverageMinutes(
            averageMinutes
          ),

        averageTimeTrend:
          responseTimes.length
            ? `${responseTimes.length} atendimento(s)`
            : "",

        rating:
          formatRating(
            averageRating
          ),

        ratingTrend:
          ratingsCount
            ? `${ratingsCount} avaliação(ões)`
            : ""
      })
    }

    loadMetrics()
  }, [])

  return (
    <>
      <MetricCard
        title="Conversas hoje"
        value={metrics.conversationsToday}
        icon={<MessageCircle size={18} />}
      />

      <MetricCard
        title="Clientes hoje"
        value={metrics.clientsToday}
        icon={<Users size={18} />}
      />

      <MetricCard
        title="Tempo médio"
        value={metrics.averageTime}
        trend={metrics.averageTimeTrend}
        icon={<Clock size={18} />}
      />

      <MetricCard
        title="Avaliação"
        value={metrics.rating}
        trend={metrics.ratingTrend}
        icon={<Star size={18} />}
      />
    </>
  )
}