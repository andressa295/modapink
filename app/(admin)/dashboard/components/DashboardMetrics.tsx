// app/(admin)/dashboard/components/DashboardMetrics.tsx

"use client"

import {
  useEffect,
  useState
} from "react"

import {
  Clock3,
  MessageCircle,
  ReceiptText,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  Users
} from "lucide-react"

import {
  createClient
} from "@/lib/supabase/client"

import styles from "../styles/dashboard.module.css"

type Metrics = {
  conversationsToday: number
  clientsToday: number
  averageTime: string
  averageTimeTrend: string
  rating: string
  ratingTrend: string
  checkoutsCreated: number
  cartRecoveriesSent: number
  salesStarted: number
}

type MessageRow = {
  id?: string | null
  conversation_id?: string | null
  sender?: string | null
  created_at?: string | null
  text?: string | null
  content?: string | null
  body?: string | null
  message?: string | null
  caption?: string | null
  intent?: string | null
  flow?: string | null
  step?: string | null
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

function normalizeText(
  value?: string | null
) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function getMessageText(
  message: MessageRow
) {
  return [
    message.text,
    message.content,
    message.body,
    message.message,
    message.caption,
    message.intent,
    message.flow,
    message.step
  ]
    .filter(Boolean)
    .join(" ")
}

function isOutgoingMessage(
  message: MessageRow
) {
  const sender =
    normalizeText(
      message.sender
    )

  return (
    sender === "agent" ||
    sender === "bot" ||
    sender === "system" ||
    sender === "automacao" ||
    sender === "automacoes"
  )
}

function isCheckoutSignal(
  message: MessageRow
) {
  const text =
    normalizeText(
      getMessageText(message)
    )

  return Boolean(
    text.includes("checkout") ||
    text.includes("link de compra") ||
    text.includes("link do pedido") ||
    text.includes("finalizar compra") ||
    text.includes("finalize sua compra") ||
    text.includes("pedido criado") ||
    text.includes("pedido gerado") ||
    text.includes("pagamento do pedido") ||
    text.includes("draft_order") ||
    text.includes("draft order") ||
    text.includes("/checkout") ||
    text.includes("comprar agora")
  )
}

function isCartRecoverySignal(
  message: MessageRow
) {
  const text =
    normalizeText(
      getMessageText(message)
    )

  return Boolean(
    text.includes("carrinho abandonado") ||
    text.includes("recuperacao de carrinho") ||
    text.includes("recuperar carrinho") ||
    text.includes("carrinho enviado") ||
    text.includes("abandoned cart") ||
    text.includes("seu carrinho") ||
    text.includes("carrinho esperando") ||
    text.includes("ficou no carrinho") ||
    text.includes("finalize sua compra") ||
    text.includes("esqueceu seu carrinho")
  )
}

function isSalesIntentSignal(
  message: MessageRow
) {
  const text =
    normalizeText(
      getMessageText(message)
    )

  return Boolean(
    isCheckoutSignal(message) ||
    text.includes("quero comprar") ||
    text.includes("vou comprar") ||
    text.includes("finalizar pedido") ||
    text.includes("fechar pedido") ||
    text.includes("fazer pedido") ||
    text.includes("pedido de compra") ||
    text.includes("gerar pedido") ||
    text.includes("gerar checkout") ||
    text.includes("mandar o link") ||
    text.includes("manda o link") ||
    text.includes("pix para pagamento") ||
    text.includes("pagamento aprovado")
  )
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

async function loadMessagesWithText(
  supabase: ReturnType<typeof createClient>,
  todayISO: string
) {
  const selects = [
    `
      id,
      conversation_id,
      sender,
      created_at,
      text,
      content,
      body,
      message,
      caption,
      intent,
      flow,
      step
    `,
    `
      id,
      conversation_id,
      sender,
      created_at,
      text,
      content,
      caption,
      intent,
      flow,
      step
    `,
    `
      id,
      conversation_id,
      sender,
      created_at,
      content,
      intent,
      flow,
      step
    `,
    `
      id,
      conversation_id,
      sender,
      created_at,
      text,
      content
    `,
    `
      id,
      conversation_id,
      sender,
      created_at
    `
  ]

  for (const select of selects) {
    const {
      data,
      error
    } = await supabase
      .from("messages")
      .select(select)
      .gte(
        "created_at",
        todayISO
      )
      .limit(1200)

    if (!error) {
      return (data || []) as MessageRow[]
    }
  }

  return []
}

export default function DashboardMetrics() {
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
    ratingTrend: "",
    checkoutsCreated: 0,
    cartRecoveriesSent: 0,
    salesStarted: 0
  })

  useEffect(() => {
    const supabase =
      createClient()

    async function loadMetrics() {
      try {
        setLoading(true)

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

          const responseMessagesList =
            responseMessages || []

          responseTimes =
            conversationIds
              .map((conversationId: string) => {
                const related =
                  responseMessagesList.filter(
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

        const messagesToday =
          await loadMessagesWithText(
            supabase,
            todayISO
          )

        const outgoingMessages =
          messagesToday.filter(
            isOutgoingMessage
          )

        const checkoutsCreated =
          outgoingMessages.filter(
            isCheckoutSignal
          ).length

        const cartRecoveriesSent =
          outgoingMessages.filter(
            isCartRecoverySignal
          ).length

        const salesConversationIds =
          new Set<string>()

        messagesToday.forEach(
          message => {
            if (
              message.conversation_id &&
              isSalesIntentSignal(message)
            ) {
              salesConversationIds.add(
                message.conversation_id
              )
            }
          }
        )

        list.forEach((conversation: any) => {
          const statusText =
            normalizeText(
              [
                conversation.state,
                conversation.mode,
                conversation.status,
                conversation.last_message
              ]
                .filter(Boolean)
                .join(" ")
            )

          if (
            conversation.id &&
            (
              statusText.includes("buying") ||
              statusText.includes("cart") ||
              statusText.includes("checkout") ||
              statusText.includes("pedido") ||
              statusText.includes("compra")
            )
          ) {
            salesConversationIds.add(
              conversation.id
            )
          }
        })

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
              : "",

          checkoutsCreated,
          cartRecoveriesSent,
          salesStarted:
            salesConversationIds.size
        })
      } finally {
        setLoading(false)
      }
    }

    loadMetrics()

    const interval =
      window.setInterval(
        loadMetrics,
        30000
      )

    return () =>
      window.clearInterval(
        interval
      )
  }, [])

  return (
    <section className={styles["metrics-showcase"]}>
      <div className={styles["metrics-main"]}>
        <div className={styles["metrics-main-header"]}>
          <span className={styles["metrics-icon"]}>
            <MessageCircle size={18} />
          </span>

          <span className={styles["metrics-kicker"]}>
            Atendimento hoje
          </span>
        </div>

        <strong className={styles["metrics-number"]}>
          {loading
            ? "—"
            : metrics.conversationsToday}
        </strong>

        <p className={styles["metrics-description"]}>
          {metrics.clientsToday > 0
            ? `${metrics.clientsToday} cliente(s) únicos em atendimento hoje.`
            : "Aguardando o movimento de atendimento de hoje."}
        </p>
      </div>

      <div className={styles["metrics-details"]}>
        <div className={styles["metric-line"]}>
          <span className={styles["metric-line-icon"]}>
            <Users size={15} />
          </span>

          <div className={styles["metric-line-content"]}>
            <small>Clientes únicos</small>

            <strong>
              {loading
                ? "—"
                : metrics.clientsToday}
            </strong>
          </div>
        </div>

        <div className={styles["metric-line"]}>
          <span className={styles["metric-line-icon"]}>
            <Clock3 size={15} />
          </span>

          <div className={styles["metric-line-content"]}>
            <small>
              Tempo médio
            </small>

            <strong>
              {loading
                ? "—"
                : metrics.averageTime}
            </strong>
          </div>
        </div>

        <div className={styles["metric-line"]}>
          <span className={styles["metric-line-icon"]}>
            <Star size={15} />
          </span>

          <div className={styles["metric-line-content"]}>
            <small>
              Avaliação
            </small>

            <strong>
              {loading
                ? "—"
                : metrics.rating}
            </strong>
          </div>
        </div>
      </div>

      <div className={styles["sales-panel"]}>
        <div className={styles["sales-panel-header"]}>
          <div>
            <span className={styles["sales-panel-icon"]}>
              <ShoppingBag size={17} />
            </span>
          </div>

          <div>
            <span className={styles["sales-panel-kicker"]}>
              Vendas pelo WhatsApp
            </span>

            <h3>
              Automação comercial
            </h3>
          </div>

          <Sparkles
            size={17}
            className={styles["sales-panel-sparkle"]}
          />
        </div>

        <div className={styles["sales-metrics-grid"]}>
          <div className={styles["sales-metric-chip"]}>
            <span>
              <ReceiptText size={14} />
              Checkouts
            </span>

            <strong>
              {loading
                ? "—"
                : metrics.checkoutsCreated}
            </strong>
          </div>

          <div className={styles["sales-metric-chip"]}>
            <span>
              <ShoppingCart size={14} />
              Carrinhos
            </span>

            <strong>
              {loading
                ? "—"
                : metrics.cartRecoveriesSent}
            </strong>
          </div>

          <div className={styles["sales-metric-chip"]}>
            <span>
              <ShoppingBag size={14} />
              Vendas iniciadas
            </span>

            <strong>
              {loading
                ? "—"
                : metrics.salesStarted}
            </strong>
          </div>
        </div>
      </div>
    </section>
  )
}