import { ReactNode } from "react"
import "../styles/chat.module.css"

type MetricCardProps = {
  title: string
  value: string | number
  icon?: ReactNode
  trend?: string
}

// 🔥 FORMATADOR INTELIGENTE
function formatValue(value: string | number) {
  if (typeof value === "string") return value

  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + "M"
  if (value >= 1_000) return (value / 1_000).toFixed(1) + "k"

  return value.toString()
}

// 🔥 COR DO TREND
function getTrendColor(trend?: string) {
  if (!trend) return "#6b7280"

  if (trend.includes("+")) return "#16a34a" // verde
  if (trend.includes("-")) return "#dc2626" // vermelho

  return "#6b7280"
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

          <div className="metric-title">
            {title}
          </div>

          <div className="metric-value">
            {formatValue(value)}
          </div>

          {/* 🔥 TREND */}
          {trend && (
            <div
              className="metric-trend"
              style={{ color: getTrendColor(trend) }}
            >
              {trend}
            </div>
          )}

        </div>

        {icon && (
          <div className="metric-icon">
            {icon}
          </div>
        )}

      </div>

    </div>
  )
}