import "../styles/relatorios.css"
import MetricCard from "../components/reports/MetricCard"

export default function Relatorios() {

  const agents = [
    { name:"Rafaela", chats:45, response:"1m20s", rating:"4.8" },
    { name:"Bruna", chats:32, response:"2m10s", rating:"4.6" },
    { name:"Rodrigo", chats:18, response:"3m02s", rating:"4.4" }
  ]

  return (

    <div className="reports-page">

      <div className="reports-header">

        <div className="reports-title">
          Relatórios
        </div>

        <select className="reports-filter">
          <option>Hoje</option>
          <option>Últimos 7 dias</option>
          <option>Últimos 30 dias</option>
        </select>

      </div>


      <div className="metrics-grid">

        <MetricCard
          title="Conversas hoje"
          value="148"
        />

        <MetricCard
          title="Clientes atendidos"
          value="96"
        />

        <MetricCard
          title="Tempo médio resposta"
          value="2m 14s"
        />

        <MetricCard
          title="Avaliação média"
          value="4.8 ⭐"
        />

      </div>


      <div className="report-table">

        <div className="report-row header">
          <div>Atendente</div>
          <div>Conversas</div>
          <div>Tempo médio</div>
          <div>Avaliação</div>
        </div>

        {agents.map((a,index)=>(
          <div key={index} className="report-row">

            <div>{a.name}</div>

            <div>{a.chats}</div>

            <div>{a.response}</div>

            <div>{a.rating}</div>

          </div>
        ))}

      </div>

    </div>

  )

}