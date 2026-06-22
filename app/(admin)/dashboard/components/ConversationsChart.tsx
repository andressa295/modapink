"use client"

import { useEffect, useState } from "react"

import styles from "./ConversationsChart.module.css"

import { createClient } from "@/lib/supabase/client"

type ChartData = {
  label: string
  date: string
  value: number
}

function startOfDay(date: Date) {
  const d = new Date(date)

  d.setHours(
    0,
    0,
    0,
    0
  )

  return d
}

function formatDateKey(date: Date) {
  return date
    .toISOString()
    .slice(0, 10)
}

export default function ConversationsChart() {

  const [
    data,
    setData
  ] = useState<ChartData[]>([])

  useEffect(() => {

    const supabase =
      createClient()

    async function loadData() {

      const days = [
        "Dom",
        "Seg",
        "Ter",
        "Qua",
        "Qui",
        "Sex",
        "Sab"
      ]

      const today =
        startOfDay(new Date())

      const last7Days: ChartData[] = []

      for (
        let i = 6;
        i >= 0;
        i--
      ) {
        const d =
          new Date(today)

        d.setDate(
          today.getDate() - i
        )

        last7Days.push({
          label:
            days[d.getDay()],
          date:
            formatDateKey(d),
          value:
            0
        })
      }

      const fromDate =
        new Date(today)

      fromDate.setDate(
        today.getDate() - 6
      )

      const {
        data: conversations,
        error
      } = await supabase
        .from("conversations")
        .select("created_at")
        .gte(
          "created_at",
          fromDate.toISOString()
        )

      if (error) {
        console.error(
          "Erro ao buscar conversas:",
          error
        )

        return
      }

      conversations?.forEach((conv: any) => {
        const date =
          new Date(conv.created_at)

        const key =
          formatDateKey(date)

        const item =
          last7Days.find(
            day => day.date === key
          )

        if (item) {
          item.value += 1
        }
      })

      setData(
        last7Days
      )
    }

    loadData()

  }, [])

  const max =
    Math.max(
      ...data.map(item => item.value),
      1
    )

  return (
    <div className={styles["dashboard-card"]}>
      <h3>
        Conversas últimos 7 dias
      </h3>

      <div className={styles.chart}>
        {data.map((item) => (
          <div
            key={item.date}
            className={styles.bar}
          >
            <div
              className={styles["bar-fill"]}
              style={{
                height: `${(item.value / max) * 100}%`
              }}
              title={`${item.value} conversa(s)`}
            />

            <span>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}