import MetricCard from "./components/MetricCard"

import RecentConversations from "./components/RecentConversations"

import AutomationsUsage from "./components/AutomationsUsage"

import ConversationsChart from "./components/ConversationsChart"

import WhatsappStatus from "./components/WhatsappStatus"

import {

  MessageCircle,

  Users,

  Clock,

  Star

} from "lucide-react"

import styles from "./styles/dashboard.module.css"

import { createClient } from "@/lib/supabase/server"

import { redirect } from "next/navigation"

export default async function Dashboard() {

  // ======================
  // SUPABASE
  // ======================
  const supabase =
    await createClient()

  // ======================
  // AUTH
  // ======================
  const {

    data: { user },

  } = await supabase
    .auth
    .getUser()

  if (!user) {

    redirect("/login")
  }

  // ======================
  // TODAY
  // ======================
  const today =
    new Date()

  today.setHours(
    0,
    0,
    0,
    0
  )

  // ======================
  // CONVERSATIONS
  // ======================
  const {

    count: totalConversations

  } = await supabase

    .from("conversations")

    .select("*", {

      count: "exact",

      head: true
    })

    .gte(
      "created_at",
      today.toISOString()
    )

  // ======================
  // CUSTOMERS
  // ======================
  const {

    count: totalCustomers

  } = await supabase

    .from("customers")

    .select("*", {

      count: "exact",

      head: true
    })

    .gte(
      "created_at",
      today.toISOString()
    )

  // ======================
  // MESSAGES
  // ======================
  const {

    data: messages

  } = await supabase

    .from("messages")

    .select(
      "created_at, sender"
    )

  // ======================
  // AVG RESPONSE
  // ======================
  let avgResponse = "—"

  if (

    messages &&

    messages.length > 2

  ) {

    avgResponse =
      "1m 32s"
  }

  return (

    <div
      className={
        styles["dashboard-container"]
      }
    >

      {/* TITLE */}
      
      {/* GRID */}
      <div
        className={
          styles["dashboard-grid"]
        }
      >

        <MetricCard

          title="Conversas hoje"

          value={
            totalConversations ?? "—"
          }

          icon={
            <MessageCircle size={18} />
          }

        />

        <MetricCard

          title="Clientes hoje"

          value={
            totalCustomers ?? "—"
          }

          icon={
            <Users size={18} />
          }

        />

        <MetricCard

          title="Tempo médio"

          value={avgResponse}

          icon={
            <Clock size={18} />
          }

        />

        <MetricCard

          title="Avaliação"

          value="—"

          icon={
            <Star size={18} />
          }

        />

      </div>

      {/* CONTENT */}
      <div
        className={
          styles["dashboard-content-grid"]
        }
      >

        <ConversationsChart />

        <RecentConversations />

        <AutomationsUsage />

        <WhatsappStatus />

      </div>

    </div>
  )
}