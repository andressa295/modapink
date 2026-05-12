"use client"

import { useEffect, useState } from "react"
import "../styles/relatorios.module.css"
import MetricCard from "../components/reports/MetricCard"
import { createClient } from "@/lib/supabase/client"

export default function Relatorios() {

  const [range, setRange] = useState("today")

  const [metrics, setMetrics] = useState({
    conversations: 0,
    customers: 0,
    avgResponse: "0s",
    rating: "0"
  })

  const [agents, setAgents] = useState<any[]>([])

  useEffect(() => {
    const supabase = createClient()

    async function loadData() {

      let fromDate = new Date()

      if (range === "today") {
        fromDate.setHours(0, 0, 0, 0)
      }

      if (range === "7d") {
        fromDate.setDate(fromDate.getDate() - 7)
      }

      if (range === "30d") {
        fromDate.setDate(fromDate.getDate() - 30)
      }

      // =========================
      // 📊 CONVERSAS
      // =========================
      const { data: conversations } = await supabase
        .from("conversations")
        .select("*")
        .gte("created_at", fromDate.toISOString())

      // =========================
      // 👥 CLIENTES (únicos)
      // =========================
      const uniqueCustomers = new Set(
        conversations?.map((c: any) => c.customer_id)
      )

      // =========================
      // 💬 MESSAGES
      // =========================
      const { data: messages } = await supabase
        .from("messages")
        .select("*")
        .gte("created_at", fromDate.toISOString())

      // =========================
      // ⏱ TEMPO MÉDIO (simples)
      // =========================
      let responseTimes: number[] = []

      if (messages) {
        for (let i = 1; i < messages.length; i++) {
          const prev = messages[i - 1]
          const curr = messages[i]

          if (prev.sender === "user" && curr.sender === "agent") {
            const diff =
              new Date(curr.created_at).getTime() -
              new Date(prev.created_at).getTime()

            responseTimes.push(diff)
          }
        }
      }

      const avgMs =
        responseTimes.reduce((a, b) => a + b, 0) /
        (responseTimes.length || 1)

      const avgMin = Math.floor(avgMs / 60000)
      const avgSec = Math.floor((avgMs % 60000) / 1000)

      // =========================
      // ⭐ RATING (mock leve até implementar)
      // =========================
      const avgRating = "4.8"

      // =========================
      // 👨‍💼 AGENTES
      // =========================
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, role")
        .eq("role", "agent")

      const agentStats = profiles?.map((p: any) => {

        const chats =
          conversations?.filter((c: any) => c.assigned_to === p.id).length || 0

        return {
          name: p.name,
          chats,
          response: `${avgMin}m ${avgSec}s`,
          rating: avgRating
        }
      })

      setMetrics({
        conversations: conversations?.length || 0,
        customers: uniqueCustomers.size,
        avgResponse: `${avgMin}m ${avgSec}s`,
        rating: avgRating
      })

      setAgents(agentStats || [])
    }

    loadData()
  }, [range])

  return (

    <div className="reports-page">

      <div className="reports-header">

        <div className="reports-title">
          Relatórios
        </div>

        <select
          className="reports-filter"
          value={range}
          onChange={(e) => setRange(e.target.value)}
        >
          <option value="today">Hoje</option>
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
        </select>

      </div>

      {/* METRICS */}
      <div className="metrics-grid">

        <MetricCard
          title="Conversas"
          value={metrics.conversations}
        />

        <MetricCard
          title="Clientes atendidos"
          value={metrics.customers}
        />

        <MetricCard
          title="Tempo médio resposta"
          value={metrics.avgResponse}
        />

        <MetricCard
          title="Avaliação média"
          value={`${metrics.rating} ⭐`}
        />

      </div>

      {/* TABLE */}
      <div className="report-table">

        <div className="report-row header">
          <div>Atendente</div>
          <div>Conversas</div>
          <div>Tempo médio</div>
          <div>Avaliação</div>
        </div>

        {agents.map((a, index) => (
          <div key={index} className="report-row">

            <div>{a.name}</div>
            <div>{a.chats}</div>
            <div>{a.response}</div>
            <div>{a.rating}</div>

          </div>
        ))}

      </div>

    </div>

  )
}