"use client"

import { useEffect, useState } from "react"

import styles from "./ConversationsChart.module.css"

import { createClient } from "@/lib/supabase/client"

type ChartData = {

  day: string

  value: number
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
        new Date()

      // ======================
      // LAST 7 DAYS
      // ======================
      const last7Days:
        ChartData[] = []

      for (
        let i = 6;
        i >= 0;
        i--
      ) {

        const d =
          new Date()

        d.setDate(
          today.getDate() - i
        )

        last7Days.push({

          day:
            days[d.getDay()],

          value: 0
        })
      }

      // ======================
      // FILTER DATE
      // ======================
      const fromDate =
        new Date()

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

          "Erro ao buscar dados:",

          error
        )

        return
      }

      if (!conversations) {
        return
      }

      // ======================
      // GROUP
      // ======================
      conversations.forEach(
        (conv: any) => {

          const date =
            new Date(
              conv.created_at
            )

          const day =
            days[
              date.getDay()
            ]

          const item =
            last7Days.find(
              d => d.day === day
            )

          if (item) {
            item.value++
          }
        }
      )

      setData(
        last7Days
      )
    }

    loadData()

  }, [])

  const max = Math.max(

    ...data.map(
      d => d.value
    ),

    1
  )

  return (

    <div
      className={
        styles["dashboard-card"]
      }
    >

      <h3>
        Conversas últimos 7 dias
      </h3>

      <div
        className={
          styles.chart
        }
      >

        {data.map((item) => (

          <div

            key={item.day}

            className={
              styles.bar
            }

          >

            <div

              className={
                styles["bar-fill"]
              }

              style={{

                height: `${

                  (item.value / max) * 100

                }%`
              }}

            />

            <span>
              {item.day}
            </span>

          </div>

        ))}

      </div>

    </div>
  )
}