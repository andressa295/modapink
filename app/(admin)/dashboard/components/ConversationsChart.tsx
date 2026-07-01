"use client"

import { useEffect, useMemo, useState } from "react"

import {
  BarChart3,
  CalendarDays,
  MessageCircle,
  TrendingUp
} from "lucide-react"

import styles from "./ConversationsChart.module.css"

import { createClient } from "@/lib/supabase/client"

type ChartData = {
  label: string
  date: string
  value: number
}

type ConversationRow = {
  created_at: string | null
}

function startOfDay(date: Date) {
  const d = new Date(date)

  d.setHours(0, 0, 0, 0)

  return d
}

function pad(value: number) {
  return String(value).padStart(2, "0")
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export default function ConversationsChart() {
  const [data, setData] = useState<ChartData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function loadData() {
      try {
        setLoading(true)

        const days = [
          "Dom",
          "Seg",
          "Ter",
          "Qua",
          "Qui",
          "Sex",
          "Sab"
        ]

        const today = startOfDay(new Date())

        const last7Days: ChartData[] = []

        for (let i = 6; i >= 0; i--) {
          const d = new Date(today)

          d.setDate(today.getDate() - i)

          last7Days.push({
            label: days[d.getDay()],
            date: formatDateKey(d),
            value: 0
          })
        }

        const fromDate = new Date(today)

        fromDate.setDate(today.getDate() - 6)

        const {
          data: conversations,
          error
        } = await supabase
          .from("conversations")
          .select("created_at")
          .gte("created_at", fromDate.toISOString())

        if (error) {
          console.error("Erro ao buscar conversas:", error)
          setData(last7Days)
          return
        }

        const safeConversations =
          (conversations || []) as ConversationRow[]

        safeConversations.forEach((conversation) => {
          if (!conversation.created_at) {
            return
          }

          const date = new Date(conversation.created_at)

          const key = formatDateKey(date)

          const item = last7Days.find((day) => day.date === key)

          if (item) {
            item.value += 1
          }
        })

        setData(last7Days)
      } finally {
        setLoading(false)
      }
    }

    loadData()

    const interval = window.setInterval(loadData, 30000)

    return () => window.clearInterval(interval)
  }, [])

  const max = Math.max(...data.map((item) => item.value), 1)

  const total = useMemo(() => {
    return data.reduce((sum, item) => sum + item.value, 0)
  }, [data])

  const bestDay = useMemo(() => {
    if (data.length === 0) {
      return null
    }

    return data.reduce((best, item) => {
      return item.value > best.value ? item : best
    }, data[0])
  }, [data])

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
              Movimento
            </span>

            <h3>
              Conversas dos últimos 7 dias
            </h3>
          </div>
        </div>

        <span className={styles["period-badge"]}>
          <CalendarDays size={13} />
          7 dias
        </span>
      </header>

      <div className={styles["summary-grid"]}>
        <div className={styles["summary-item"]}>
          <span>
            <MessageCircle size={14} />
            Total
          </span>

          <strong>{loading ? "—" : total}</strong>
        </div>

        <div className={styles["summary-item"]}>
          <span>
            <TrendingUp size={14} />
            Melhor dia
          </span>

          <strong>
            {loading || !bestDay ? "—" : bestDay.label}
          </strong>
        </div>
      </div>

      <div className={styles.chart}>
        {data.map((item) => {
          const height =
            item.value > 0
              ? `${Math.max((item.value / max) * 100, 10)}%`
              : "8px"

          return (
            <div
              key={item.date}
              className={styles.bar}
              aria-label={`${item.label}: ${item.value} conversa(s)`}
            >
              <span className={styles["bar-value"]}>
                {item.value}
              </span>

              <div className={styles["bar-track"]}>
                <div
                  className={styles["bar-fill"]}
                  style={{ height }}
                  title={`${item.value} conversa(s)`}
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