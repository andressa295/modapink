import "./ConversationsChart.css"

export default function ConversationsChart() {

  const data = [
    { day: "Seg", value: 82 },
    { day: "Ter", value: 104 },
    { day: "Qua", value: 120 },
    { day: "Qui", value: 98 },
    { day: "Sex", value: 145 },
    { day: "Sab", value: 210 },
    { day: "Dom", value: 176 }
  ]

  const max = Math.max(...data.map(d => d.value))

  return (

    <div className="dashboard-card">

      <h3>Conversas últimos 7 dias</h3>

      <div className="chart">

        {data.map((item) => (

          <div key={item.day} className="bar">

            <div
              className="bar-fill"
              style={{
                height: `${(item.value / max) * 100}%`
              }}
            />

            <span>{item.day}</span>

          </div>

        ))}

      </div>

    </div>

  )

}