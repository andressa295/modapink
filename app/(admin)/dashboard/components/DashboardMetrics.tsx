// app/(admin)/dashboard/components/DashboardMetrics.tsx

"use client"

import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon"

import {
  Fragment,
  useEffect,
  useRef,
  useState
} from "react"

import {
  Clock3,
  Star
} from "lucide-react"

import {
  createClient
} from "@/lib/supabase/client"

import styles from "../styles/dashboard.module.css"
import { getDateRange, type MessageRow } from "@/lib/dashboard-activity"

import ConfirmedSalesMetric from "./ConfirmedSalesMetric"

type Metrics = {
  conversationsToday: number
  clientsToday: number
  averageTime: string
  averageTimeTrend: string
  rating: string
  ratingTrend: string
}

type ConversationMetricRow = {
  id: string
  phone: string | null
  created_at: string | null
  first_response_at: string | null
}

function startOfToday() {
  return new Date(getDateRange("7d").endExclusive.getTime() - 86400000)
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
    return "< 1 min"
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

  return value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
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
  const requestInFlightRef =
    useRef(false)

  const [
    loading,
    setLoading
  ] = useState(true)

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

  const [error, setError] = useState(false)
  const [hasData, setHasData] = useState(false)
  const [reviewsAvailable, setReviewsAvailable] = useState(false)

  useEffect(() => {
    const supabase =
      createClient()

    let active = true

    async function loadMetrics(
      showInitialLoading = false
    ) {
      if (requestInFlightRef.current) {
        return
      }

      requestInFlightRef.current = true

      try {
        if (showInitialLoading) {
          setLoading(true)
        }

        const today =
          startOfToday()

        const todayISO =
          today.toISOString()

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
            last_agent_message_at,
            state,
            mode,
            status,
            last_message
          `)
          .gte(
            "created_at",
            todayISO
          )

        if (conversationsError) {
          throw conversationsError
        }

        const list = (conversations || []) as ConversationMetricRow[]

        const conversationIds =
          list
            .map((item: ConversationMetricRow) => item.id)
            .filter(Boolean)

        const conversationsToday =
          list.length

        const clientsToday =
          new Set(
            list
              .map((item: ConversationMetricRow) => item.phone)
              .filter(Boolean)
          ).size

        let responseTimes: number[] =
          []

        if (
          conversationIds.length
        ) {
          const {
            data: responseMessages,
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

          const responseMessagesList = (responseMessages || []) as MessageRow[]

          responseTimes =
            conversationIds
              .map((conversationId: string) => {
                const related =
                  responseMessagesList.filter(
                    (message: MessageRow) =>
                      message.conversation_id === conversationId
                  )

                const firstUserAt =
                  getFirstDate(
                    related
                      .filter(
                        (message: MessageRow) =>
                          message.sender === "user"
                      )
                      .map(
                        (message: MessageRow) =>
                          message.created_at
                      )
                  )

                if (!firstUserAt) {
                  return null
                }

                const firstAgentAfterUser =
                  getFirstDate(
                    related
                      .filter((message: MessageRow) => {
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
                        (message: MessageRow) =>
                          message.created_at
                      )
                  )

                if (!firstAgentAfterUser) {
                  return null
                }

                return (
                  firstAgentAfterUser -
                  firstUserAt
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

        if (!responseTimes.length) {
          responseTimes =
            list
              .map((item: ConversationMetricRow) => {
                const created =
                  item.created_at
                    ? new Date(item.created_at).getTime()
                    : null

                const responded =
                  item.first_response_at
                    ? new Date(item.first_response_at).getTime()
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

        if (!active) {
          return
        }

        setError(false)
        setHasData(true)
        setReviewsAvailable(!reviewsError)
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
      } catch (error) {
        console.warn("Não foi possível atualizar o resumo da dashboard:", error)
        if (active) setError(true)
      } finally {
        requestInFlightRef.current = false

        if (active) {
          setLoading(false)
        }
      }
    }

    loadMetrics(true)

    const interval =
      window.setInterval(
        () => { if (document.visibilityState === "visible") loadMetrics(false) },
        60000
      )

    return () => {
      active = false
      requestInFlightRef.current = false

      window.clearInterval(
        interval
      )
    }
  }, [])

  const unavailable = loading || !hasData
  const cards = [
    {
      title: "Novas conversas",
      value: unavailable ? "—" : metrics.conversationsToday,
      description: unavailable ? "Resumo do dia" : `${metrics.clientsToday} novos clientes hoje`,
      icon: WhatsAppIcon,
      className: styles.metricPink,
    },
    {
      title: "Primeira resposta",
      value: unavailable ? "—" : metrics.averageTime,
      description: metrics.averageTimeTrend ? `Média de ${metrics.averageTimeTrend}` : "Conversas novas de hoje",
      icon: Clock3,
      className: styles.metricBlue,
    },
    {
      title: "Avaliação do SAC",
      value: unavailable ? "—" : metrics.rating,
      description: !reviewsAvailable && !loading ? "Avaliações indisponíveis" : metrics.ratingTrend ? `${metrics.ratingTrend} · geral` : "Aguardando avaliações",
      icon: Star,
      className: styles.metricAmber,
    },
  ]

  return (
    <section aria-label="Atendimento hoje e avaliação geral" className={styles.metricsSection} aria-busy={loading}>
      {error && <p className={styles.dataNotice} role="status">{hasData ? "Não foi possível atualizar o resumo. Exibindo a última consulta." : "Não foi possível carregar o resumo de atendimento."}</p>}
      <div className={styles.metricsGrid}>
        {cards.map(({ title, value, description, icon: Icon, className }, index) => (
          <Fragment key={title}>
          <article className={styles.summaryCard} key={title}>
            <div className={styles.summaryTop}>
              <span>{title}</span>
              <span className={`${styles.summaryIcon} ${className}`}><Icon size={16} aria-hidden="true" /></span>
            </div>
            <strong className={styles.summaryValue}>{value}{title === "Avaliação do SAC" && value !== "—" && <small>/ 5</small>}</strong>
            <p>{description}</p>
          </article>
          {index === 0 && <ConfirmedSalesMetric />}
          </Fragment>
        ))}
      </div>
    </section>
  )
}
