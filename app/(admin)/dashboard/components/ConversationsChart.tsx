"use client"

import { useEffect, useState } from "react"
import "./ConversationsChart.css"
import { supabase } from "@/lib/supabase/client"

type ChartData = {
  day: string
  value: number
}

export default function ConversationsChart() {

  const [data, setData] = useState<ChartData[]>([])

  useEffect(() => {
    async function loadData() {

      const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"]
      const today = new Date()

      // 🔥 pega últimos 7 dias
      const last7Days: ChartData[] = []

      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(today.getDate() - i)

        last7Days.push({
          day: days[d.getDay()],
          value: 0
        })
      }

      // 🔥 busca no banco
      const { data: conversations } = await supabase
        .from("conversations")
        .select("created_at")

      if (!conversations) return

      // 🔥 agrupa por dia
      conversations.forEach((conv) => {
        const date = new Date(conv.created_at)
        const day = days[date.getDay()]

        const item = last7Days.find(d => d.day === day)
        if (item) item.value++
      })

      setData(last7Days)
    }

    loadData()
  }, [])

  const max = Math.max(...data.map(d => d.value), 1)

  return (

    <div className="dashboard-card">

      <h3>Conversas últimos 7 dias</h3>

      <div className="chart">

        {data.map((item) => (

          <div key={item.day} className="bar">

            <div
              className="bar-fill"
              style={{
                height: `${(item.value / max) * 100}%`
              }}
            />

            <span>{item.day}</span>

          </div>

        ))}

      </div>

    </div>

  )
}