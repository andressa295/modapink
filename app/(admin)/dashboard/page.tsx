
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowUpRight } from "lucide-react"
import DashboardMetrics from "./components/DashboardMetrics"
import ConversationsChart from "./components/ConversationsChart"
import SalesFunnel from "./components/SalesFunnel"
import RecentConversations from "./components/RecentConversations"
import WhatsappStatus from "./components/WhatsappStatus"
import CampaignOverview from "./components/CampaignOverview"
import styles from "./styles/dashboard.module.css"
import { createClient } from "@/lib/supabase/server"

export default async function Dashboard() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect("/login")

  return (
    <div className={styles.dashboard}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>PAINEL DA LOJA</span>
          <h1>Visão geral</h1>
          <p>Vendas, conversas e atendimento pelo WhatsApp.</p>
        </div>
        <Link href="/dashboard/conversas" className={styles.primaryAction}>
          <WhatsAppIcon size={16} aria-hidden="true" />
          Abrir atendimento
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </header>

      <SalesFunnel />
      <DashboardMetrics />

      <div className={styles.mainGrid}>
        <ConversationsChart />
        <aside className={styles.operation} aria-label="Conexão e atalhos">
          <WhatsappStatus />
          <nav className={styles.shortcuts} aria-label="Atalhos da operação">
            <span className={styles.shortcutTitle}>ACESSO RÁPIDO</span>
            <Link href="/dashboard/conversas?tab=human">
              <WhatsAppIcon size={17} className={styles.shortcutIcon} aria-hidden="true" />
              <span><strong>Atendimento manual</strong><small>Abra as conversas com o bot pausado</small></span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/dashboard/conversas?tab=sac">
              <WhatsAppIcon size={17} className={styles.shortcutIcon} aria-hidden="true" />
              <span><strong>SAC e avaliações</strong><small>Atenda e finalize os chamados</small></span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </nav>
        </aside>
      </div>

      <CampaignOverview />
      <RecentConversations />
    </div>
  )
}
