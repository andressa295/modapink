// app/(admin)/dashboard/components/DashboardMetrics.tsx

"use client"

import { useEffect, useState } from "react"

import {
  MessageCircle,
  Users,
  Clock,
  Star
} from "lucide-react"

import MetricCard from "./MetricCard"

import { createClient } from "@/lib/supabase/client"

type Metrics = {
  conversationsToday: number
  clientsToday: number
  averageTime: string
  rating: string
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

export default function DashboardMetrics() {
  const [
    metrics,
    setMetrics
  ] = useState<Metrics>({
    conversationsToday: 0,
    clientsToday: 0,
    averageTime: "—",
    rating: "—"
  })

  useEffect(() => {
    const supabase =
      createClient()

    async function loadMetrics() {
      const today =
        startOfToday()

      const {
        data: conversations,
        error
      } = await supabase
        .from("conversations")
        .select(`
          id,
          phone,
          created_at,
          first_response_at
        `)
        .gte(
          "created_at",
          today.toISOString()
        )

      if (error) {
        console.error(
          "Erro ao carregar métricas:",
          error
        )

        return
      }

      const list =
        conversations || []

      const conversationsToday =
        list.length

      const clientsToday =
        new Set(
          list
            .map((item: any) => item.phone)
            .filter(Boolean)
        ).size

      const responseTimes =
        list
          .filter(
            (item: any) =>
              item.created_at &&
              item.first_response_at
          )
          .map((item: any) => {
            const created =
              new Date(item.created_at).getTime()

            const responded =
              new Date(item.first_response_at).getTime()

            return (
              responded - created
            ) / 1000 / 60
          })
          .filter(
            (value: number) =>
              value >= 0 &&
              Number.isFinite(value)
          )

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

      setMetrics({
        conversationsToday,
        clientsToday,
        averageTime:
          formatAverageMinutes(
            averageMinutes
          ),
        rating:
          "—"
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
        icon={<Clock size={18} />}
      />

      <MetricCard
        title="Avaliação"
        value={metrics.rating}
        icon={<Star size={18} />}
      />
    </>
  )
}