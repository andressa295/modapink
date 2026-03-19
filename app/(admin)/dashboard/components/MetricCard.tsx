import { ReactNode } from "react"
import "../styles/chat.css"

type MetricCardProps = {
  title: string
  value: string
  icon: ReactNode
}

export default function MetricCard({
  title,
  value,
  icon
}: MetricCardProps) {
  return (

    <div className="metric-card">

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>

        <div>
          <div className="metric-title">{title}</div>
          <div className="metric-value">{value}</div>
        </div>

        <div className="metric-icon">
          {icon}
        </div>

      </div>

    </div>

  )
}