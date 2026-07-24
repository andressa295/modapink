// app/(admin)/dashboard/page.tsx

import { redirect } from "next/navigation"
import {
  Activity,
  RefreshCw,
  Sparkles
} from "lucide-react"

import DashboardMetrics from "./components/DashboardMetrics"
import ConversationsChart from "./components/ConversationsChart"
import SalesFunnel from "./components/SalesFunnel"
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
            <Sparkles size={13} />
            Central Moda Pink
          </span>

          <h1 className={styles["dashboard-title"]}>
            Visão geral do atendimento
          </h1>

          <p className={styles["dashboard-subtitle"]}>
            Conversas, vendas e conexões em uma leitura rápida,
            sem interromper o que já está na tela.
          </p>
        </div>

        <div className={styles["dashboard-hero-aside"]}>
          <div className={styles["dashboard-live-card"]}>
            <span className={styles["dashboard-live-icon"]}>
              <Activity size={15} />
            </span>

            <div>
              <strong>Monitoramento ativo</strong>
              <span>Atualização silenciosa em segundo plano</span>
            </div>
          </div>

          <span className={styles["dashboard-refresh-pill"]}>
            <RefreshCw size={12} />
            Tempo real
          </span>
        </div>
      </section>

      <section className={styles["dashboard-grid"]}>
        <DashboardMetrics />
      </section>

      <section className={styles["showcase-grid"]}>
        <div className={styles["showcase-chart"]}>
          <ConversationsChart />
          <SalesFunnel />
        </div>

        <aside className={styles["showcase-status"]}>
          <WhatsappStatus />
          <RecentConversations />
        </aside>
      </section>
    </main>
  )
}
