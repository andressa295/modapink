type Props = {
  title: string
  value: string
}

export default function MetricCard({ title, value }: Props) {

  return (

    <div className="metric-card">

      <div className="metric-title">
        {title}
      </div>

      <div className="metric-value">
        {value}
      </div>

    </div>

  )

}