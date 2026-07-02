"use client"

import {
  useEffect,
  useMemo,
  useState
} from "react"

import {
  BarChart3,
  CalendarDays,
  MessageCircle,
  ReceiptText,
  ShoppingBag,
  ShoppingCart,
  TrendingUp
} from "lucide-react"

import styles from "./ConversationsChart.module.css"

import {
  createClient
} from "@/lib/supabase/client"

type PeriodId =
  | "7d"
  | "30d"
  | "month"
  | "lastMonth"

type MetricId =
  | "conversations"
  | "checkouts"
  | "carts"
  | "sales"

type ChartData = {
  label: string
  date: string
  value: number
}

type ConversationRow = {
  id?: string | null
  created_at: string | null
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

const TIME_ZONE =
  "America/Sao_Paulo"

const periodOptions: Array<{
  id: PeriodId
  label: string
}> = [
  {
    id: "7d",
    label: "7 dias"
  },
  {
    id: "30d",
    label: "30 dias"
  },
  {
    id: "month",
    label: "Este mês"
  },
  {
    id: "lastMonth",
    label: "Mês passado"
  }
]

const metricOptions: Array<{
  id: MetricId
  label: string
  shortLabel: string
}> = [
  {
    id: "conversations",
    label: "Conversas",
    shortLabel: "Conversas"
  },
  {
    id: "checkouts",
    label: "Checkouts enviados",
    shortLabel: "Checkouts"
  },
  {
    id: "carts",
    label: "Carrinhos enviados",
    shortLabel: "Carrinhos"
  },
  {
    id: "sales",
    label: "Vendas confirmadas",
    shortLabel: "Vendas"
  }
]

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
    text.includes("esqueceu seu carrinho")
  )
}

function isSaleConfirmedSignal(
  message: MessageRow
) {
  const text =
    normalizeText(
      getMessageText(message)
    )

  return Boolean(
    text.includes("pagamento aprovado") ||
    text.includes("pedido aprovado") ||
    text.includes("pedido pago") ||
    text.includes("pagamento confirmado") ||
    text.includes("venda confirmada") ||
    text.includes("compra aprovada") ||
    text.includes("order paid") ||
    text.includes("payment approved") ||
    text.includes("paid")
  )
}

function getSaoPauloParts(
  date: Date
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }
    ).formatToParts(date)

  const year =
    Number(
      parts.find(
        part => part.type === "year"
      )?.value
    )

  const month =
    Number(
      parts.find(
        part => part.type === "month"
      )?.value
    )

  const day =
    Number(
      parts.find(
        part => part.type === "day"
      )?.value
    )

  return {
    year,
    month,
    day
  }
}

function createLocalDate(
  year: number,
  month: number,
  day: number
) {
  return new Date(
    year,
    month - 1,
    day,
    0,
    0,
    0,
    0
  )
}

function formatDateKey(
  date: Date
) {
  const {
    year,
    month,
    day
  } = getSaoPauloParts(date)

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function formatLabel(
  date: Date,
  compact: boolean
) {
  if (compact) {
    return date.toLocaleDateString(
      "pt-BR",
      {
        timeZone: TIME_ZONE,
        day: "2-digit",
        month: "2-digit"
      }
    )
  }

  return date.toLocaleDateString(
    "pt-BR",
    {
      timeZone: TIME_ZONE,
      weekday: "short"
    }
  ).replace(".", "")
}

function getDateRange(
  period: PeriodId
) {
  const now =
    new Date()

  const todayParts =
    getSaoPauloParts(now)

  const today =
    createLocalDate(
      todayParts.year,
      todayParts.month,
      todayParts.day
    )

  let start =
    new Date(today)

  let end =
    new Date(today)

  if (period === "7d") {
    start.setDate(
      today.getDate() - 6
    )
  }

  if (period === "30d") {
    start.setDate(
      today.getDate() - 29
    )
  }

  if (period === "month") {
    start =
      createLocalDate(
        todayParts.year,
        todayParts.month,
        1
      )
  }

  if (period === "lastMonth") {
    const firstDayCurrentMonth =
      createLocalDate(
        todayParts.year,
        todayParts.month,
        1
      )

    const lastDayPreviousMonth =
      new Date(firstDayCurrentMonth)

    lastDayPreviousMonth.setDate(0)

    const lastMonthParts =
      getSaoPauloParts(
        lastDayPreviousMonth
      )

    start =
      createLocalDate(
        lastMonthParts.year,
        lastMonthParts.month,
        1
      )

    end =
      createLocalDate(
        lastMonthParts.year,
        lastMonthParts.month,
        lastMonthParts.day
      )
  }

  const endExclusive =
    new Date(end)

  endExclusive.setDate(
    endExclusive.getDate() + 1
  )

  return {
    start,
    end,
    endExclusive
  }
}

function createEmptyChartData(
  period: PeriodId
) {
  const {
    start,
    end
  } = getDateRange(period)

  const days: ChartData[] = []

  const totalDays =
    Math.round(
      (
        end.getTime() -
        start.getTime()
      ) / 86400000
    ) + 1

  const compact =
    totalDays > 10

  const current =
    new Date(start)

  while (
    current.getTime() <= end.getTime()
  ) {
    days.push({
      label:
        formatLabel(
          current,
          compact
        ),
      date:
        formatDateKey(
          current
        ),
      value:
        0
    })

    current.setDate(
      current.getDate() + 1
    )
  }

  return days
}

async function loadMessagesWithText(
  supabase: ReturnType<typeof createClient>,
  startISO: string,
  endISO: string
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
        startISO
      )
      .lt(
        "created_at",
        endISO
      )
      .limit(5000)

    if (!error) {
      return (data || []) as MessageRow[]
    }
  }

  return []
}

function incrementDay(
  chartData: ChartData[],
  dateValue?: string | null
) {
  if (!dateValue) {
    return
  }

  const date =
    new Date(dateValue)

  if (
    Number.isNaN(date.getTime())
  ) {
    return
  }

  const key =
    formatDateKey(date)

  const item =
    chartData.find(
      day => day.date === key
    )

  if (item) {
    item.value += 1
  }
}

function incrementUniqueConversationByDay(
  chartData: ChartData[],
  messages: MessageRow[],
  predicate: (message: MessageRow) => boolean
) {
  const used =
    new Set<string>()

  messages.forEach(
    message => {
      if (
        !message.created_at ||
        !predicate(message)
      ) {
        return
      }

      const date =
        new Date(
          message.created_at
        )

      if (
        Number.isNaN(date.getTime())
      ) {
        return
      }

      const dateKey =
        formatDateKey(date)

      const conversationKey =
        message.conversation_id ||
        message.id ||
        crypto.randomUUID()

      const uniqueKey =
        `${dateKey}:${conversationKey}`

      if (
        used.has(uniqueKey)
      ) {
        return
      }

      used.add(uniqueKey)

      const item =
        chartData.find(
          day => day.date === dateKey
        )

      if (item) {
        item.value += 1
      }
    }
  )
}

export default function ConversationsChart() {
  const [
    period,
    setPeriod
  ] = useState<PeriodId>("7d")

  const [
    metric,
    setMetric
  ] = useState<MetricId>("conversations")

  const [
    data,
    setData
  ] = useState<ChartData[]>([])

  const [
    loading,
    setLoading
  ] = useState(true)

  useEffect(() => {
    const supabase =
      createClient()

    async function loadData() {
      try {
        setLoading(true)

        const {
          start,
          endExclusive
        } = getDateRange(period)

        const emptyData =
          createEmptyChartData(period)

        const startISO =
          start.toISOString()

        const endISO =
          endExclusive.toISOString()

        if (metric === "conversations") {
          const {
            data: conversations,
            error
          } = await supabase
            .from("conversations")
            .select("id, created_at")
            .gte(
              "created_at",
              startISO
            )
            .lt(
              "created_at",
              endISO
            )

          if (error) {
            console.error(
              "Erro ao buscar conversas:",
              error
            )

            setData(emptyData)
            return
          }

          const safeConversations =
            (conversations || []) as ConversationRow[]

          safeConversations.forEach(
            conversation => {
              incrementDay(
                emptyData,
                conversation.created_at
              )
            }
          )

          setData(emptyData)
          return
        }

        const messages =
          await loadMessagesWithText(
            supabase,
            startISO,
            endISO
          )

        if (metric === "checkouts") {
          messages
            .filter(isOutgoingMessage)
            .filter(isCheckoutSignal)
            .forEach(
              message => {
                incrementDay(
                  emptyData,
                  message.created_at
                )
              }
            )
        }

        if (metric === "carts") {
          messages
            .filter(isOutgoingMessage)
            .filter(isCartRecoverySignal)
            .forEach(
              message => {
                incrementDay(
                  emptyData,
                  message.created_at
                )
              }
            )
        }

        if (metric === "sales") {
          incrementUniqueConversationByDay(
            emptyData,
            messages,
            isSaleConfirmedSignal
          )
        }

        setData(emptyData)
      } finally {
        setLoading(false)
      }
    }

    loadData()

    const interval =
      window.setInterval(
        loadData,
        30000
      )

    return () =>
      window.clearInterval(interval)
  }, [period, metric])

  const max =
    Math.max(
      ...data.map(
        item => item.value
      ),
      1
    )

  const total =
    useMemo(() => {
      return data.reduce(
        (
          sum,
          item
        ) => sum + item.value,
        0
      )
    }, [data])

  const bestDay =
    useMemo(() => {
      if (
        data.length === 0
      ) {
        return null
      }

      return data.reduce(
        (
          best,
          item
        ) => {
          return item.value > best.value
            ? item
            : best
        },
        data[0]
      )
    }, [data])

  const selectedMetric =
    metricOptions.find(
      option => option.id === metric
    ) || metricOptions[0]

  const selectedPeriod =
    periodOptions.find(
      option => option.id === period
    ) || periodOptions[0]

  const MetricIcon =
    metric === "conversations"
      ? MessageCircle
      : metric === "checkouts"
        ? ReceiptText
        : metric === "carts"
          ? ShoppingCart
          : ShoppingBag

  return (
    <article className={styles["dashboard-card"]}>
      <div className={styles["card-glow"]} />

      <header className={styles["card-header"]}>
        <div className={styles["card-title-group"]}>
          <span className={styles["card-icon"]}>
            <BarChart3 size={17} />
          </span>

          <div>
            <span className={styles["card-kicker"]}>
              Evolução
            </span>

            <h3>
              {selectedMetric.label}
            </h3>
          </div>
        </div>

        <span className={styles["period-badge"]}>
          <CalendarDays size={13} />
          {selectedPeriod.label}
        </span>
      </header>

      <div className={styles["chart-controls"]}>
        <div className={styles["metric-tabs"]}>
          {metricOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`
                ${styles["metric-tab"]}
                ${
                  metric === option.id
                    ? styles["metric-tab-active"]
                    : ""
                }
              `}
              onClick={() =>
                setMetric(option.id)
              }
            >
              {option.shortLabel}
            </button>
          ))}
        </div>

        <div className={styles["period-tabs"]}>
          {periodOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`
                ${styles["period-tab"]}
                ${
                  period === option.id
                    ? styles["period-tab-active"]
                    : ""
                }
              `}
              onClick={() =>
                setPeriod(option.id)
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles["summary-grid"]}>
        <div className={styles["summary-item"]}>
          <span>
            <MetricIcon size={14} />
            Total
          </span>

          <strong>
            {loading
              ? "—"
              : total}
          </strong>
        </div>

        <div className={styles["summary-item"]}>
          <span>
            <TrendingUp size={14} />
            Melhor dia
          </span>

          <strong>
            {loading || !bestDay
              ? "—"
              : bestDay.label}
          </strong>
        </div>
      </div>

      <div className={styles.chart}>
        {data.map((item) => {
          const height =
            item.value > 0
              ? `${Math.max(
                  (
                    item.value /
                    max
                  ) * 100,
                  10
                )}%`
              : "8px"

          return (
            <div
              key={item.date}
              className={styles.bar}
              aria-label={`${item.label}: ${item.value}`}
            >
              <span className={styles["bar-value"]}>
                {item.value}
              </span>

              <div className={styles["bar-track"]}>
                <div
                  className={styles["bar-fill"]}
                  style={{
                    height
                  }}
                  title={`${item.value}`}
                />
              </div>

              <span className={styles["bar-label"]}>
                {item.label}
              </span>
            </div>
          )
        })}
      </div>
    </article>
  )
}