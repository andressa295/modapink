import { ReactNode } from "react"

import styles from "../styles/dashboard.module.css"

type MetricCardProps = {

  title: string

  value: string | number

  icon?: ReactNode

  trend?: string
}

// ======================
// FORMAT VALUE
// ======================
function formatValue(
  value: string | number
) {

  if (
    typeof value === "string"
  ) {

    return value
  }

  if (value >= 1_000_000) {

    return (

      (value / 1_000_000)

        .toFixed(1) + "M"
    )
  }

  if (value >= 1_000) {

    return (

      (value / 1_000)

        .toFixed(1) + "k"
    )
  }

  return value.toString()
}

// ======================
// TREND COLOR
// ======================
function getTrendColor(
  trend?: string
) {

  if (!trend) {

    return "#6b7280"
  }

  if (
    trend.includes("+")
  ) {

    return "#16a34a"
  }

  if (
    trend.includes("-")
  ) {

    return "#dc2626"
  }

  return "#6b7280"
}

export default function MetricCard({

  title,

  value,

  icon,

  trend

}: MetricCardProps) {

  return (

    <div
      className={
        styles["metric-card"]
      }
    >

      <div
        className={
          styles["metric-card-top"]
        }
      >

        <div
          className={
            styles["metric-card-info"]
          }
        >

          <div
            className={
              styles["metric-title"]
            }
          >

            {title}

          </div>

          <div
            className={
              styles["metric-value"]
            }
          >

            {formatValue(value)}

          </div>

          {/* TREND */}
          {trend && (

            <div

              className={
                styles["metric-trend"]
              }

              style={{
                color:
                  getTrendColor(
                    trend
                  )
              }}

            >

              {trend}

            </div>
          )}

        </div>

        {icon && (

          <div
            className={
              styles["metric-icon"]
            }
          >

            {icon}

          </div>
        )}

      </div>

    </div>
  )
}