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

import "./styles/dashboard.css"

export default function Dashboard() {

  return (

    <div className="dashboard-container">

      <h1 className="dashboard-title">
        Dashboard
      </h1>

      {/* MÉTRICAS */}

      <div className="dashboard-grid">

        <MetricCard
          title="Conversas hoje"
          value="148"
          icon={<MessageCircle size={18} />}
        />

        <MetricCard
          title="Clientes atendidos"
          value="96"
          icon={<Users size={18} />}
        />

        <MetricCard
          title="Tempo médio resposta"
          value="2m 14s"
          icon={<Clock size={18} />}
        />

        <MetricCard
          title="Avaliação média"
          value="4.8 ⭐"
          icon={<Star size={18} />}
        />

      </div>


      {/* GRID INFERIOR */}

      <div className="dashboard-content-grid">

        <ConversationsChart />

        <RecentConversations />

        <AutomationsUsage />

        <WhatsappStatus />

      </div>

    </div>

  )
}