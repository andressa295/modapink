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
      <section className={styles["dashboard-hero"]}>
        <div className={styles["dashboard-hero-content"]}>
          <span className={styles["dashboard-kicker"]}>
            <Sparkles size={14} />
            Painel Moda Pink
          </span>

          <h1 className={styles["dashboard-title"]}>
            Dashboard de atendimento
          </h1>

          <p className={styles["dashboard-subtitle"]}>
            Uma visão elegante do atendimento, desempenho das conversas e status do WhatsApp.
          </p>
        </div>
      </section>

      <section className={styles["dashboard-grid"]}>
        <DashboardMetrics />
      </section>

      <section className={styles["showcase-grid"]}>
        <div className={styles["showcase-chart"]}>
          <ConversationsChart />
        </div>

        <div className={styles["showcase-status"]}>
          <WhatsappStatus />
        </div>
      </section>

      <section className={styles["bottom-grid"]}>
        <RecentConversations />
      </section>
    </main>
  )
}