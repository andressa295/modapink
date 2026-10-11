import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowUpRight, MessageCircle } from "lucide-react"
import DashboardMetrics from "./components/DashboardMetrics"
import ConversationsChart from "./components/ConversationsChart"
import SalesFunnel from "./components/SalesFunnel"
import RecentConversations from "./components/RecentConversations"
import WhatsappStatus from "./components/WhatsappStatus"
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
          <span className={styles.eyebrow}>VISÃO GERAL</span>
          <h1>Mais clareza para vender melhor.</h1>
          <p>Vendas pelo WhatsApp e atendimento, em uma visão da sua operação.</p>
        </div>
        <Link href="/dashboard/conversas" className={styles.primaryAction}>
          <MessageCircle size={16} aria-hidden="true" />
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
            <span className={styles.shortcutTitle}>CONTINUE POR AQUI</span>
            <Link href="/dashboard/pedidos">
              <span><strong>Pedidos da loja</strong><small>Acompanhe pagamentos e envios</small></span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/dashboard/disparos">
              <span><strong>Campanhas e disparos</strong><small>Veja o andamento das campanhas</small></span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </nav>
        </aside>
      </div>

      <RecentConversations />
    </div>
  )
}
