import { ReactNode } from "react"
import "../styles/chat.css"

type MetricCardProps = {
  title: string
  value: string | number
  icon: ReactNode
  trend?: string
}

export default function MetricCard({
  title,
  value,
  icon,
  trend
}: MetricCardProps) {
  return (

    <div className="metric-card">

      <div className="metric-card-top">

        <div className="metric-card-info">
          <div className="metric-title">{title}</div>
          <div className="metric-value">{value}</div>

          {/* 🔥 TREND (opcional) */}
          {trend && (
            <div className="metric-trend">
              {trend}
            </div>
          )}
        </div>

        <div className="metric-icon">
          {icon}
        </div>

      </div>

    </div>

  )
}