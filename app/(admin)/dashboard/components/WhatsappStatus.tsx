import "./WhatsappStatus.css"

export default function WhatsappStatus() {

  return (

    <div className="dashboard-card">

      <h3>Status do WhatsApp</h3>

      <div className="whatsapp-status">

        <div className="status-indicator online" />

        <span>Online</span>

      </div>

      <p className="whatsapp-number">
        +55 11 99999-9999
      </p>

      <small>
        Última atividade: 2 minutos atrás
      </small>

    </div>

  )

}