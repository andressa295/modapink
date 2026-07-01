// app/(admin)/dashboard/page.tsx

import { redirect } from "next/navigation"

import { Sparkles } from "lucide-react"

import DashboardMetrics from "./components/DashboardMetrics"
import ConversationsChart from "./components/ConversationsChart"
import RecentConversations from "./components/RecentConversations"
import WhatsappStatus from "./components/WhatsappStatus"

import styles from "./styles/dashboard.module.css"

import { createClient } from "@/lib/supabase/server"

export default async function Dashboard() {
  const supabase = await createClient()

  const {
    data: { user },
    error
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/login")
  }

  return (
    <main className={styles["dashboard-container"]}>
      
          

      <section className={styles["dashboard-grid"]}>
        <DashboardMetrics />
      </section>

      <section className={styles["dashboard-content-grid"]}>
        <div className={styles["dashboard-main-column"]}>
          <ConversationsChart />
          <RecentConversations />
        </div>

        <div className={styles["dashboard-side-column"]}>
          <WhatsappStatus />
        </div>
      </section>
    </main>
  )
}