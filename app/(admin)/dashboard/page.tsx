// app/(admin)/dashboard/page.tsx

import RecentConversations from "./components/RecentConversations"


import ConversationsChart from "./components/ConversationsChart"

import WhatsappStatus from "./components/WhatsappStatus"

import DashboardMetrics from "./components/DashboardMetrics"

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
    error
  } = await supabase
    .auth
    .getUser()

  if (
    error ||
    !user
  ) {
    redirect("/login")
  }

  return (
    <div
      className={
        styles["dashboard-container"]
      }
    >

      {/* METRICS */}
      <div
        className={
          styles["dashboard-grid"]
        }
      >

        <DashboardMetrics />

      </div>

      {/* CONTENT */}
      <div
        className={
          styles["dashboard-content-grid"]
        }
      >

        <ConversationsChart />

        <RecentConversations />


        <WhatsappStatus />

      </div>

    </div>
  )
}