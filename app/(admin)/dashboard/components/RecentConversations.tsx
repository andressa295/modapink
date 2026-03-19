import "./RecentConversations.css"

export default function RecentConversations() {

  const conversations = [
    {
      name: "João Silva",
      message: "Quero saber o preço",
      time: "2 min atrás"
    },
    {
      name: "Maria",
      message: "Qual prazo de entrega?",
      time: "5 min atrás"
    },
    {
      name: "Carlos",
      message: "Quero falar com atendente",
      time: "8 min atrás"
    }
  ]

  return (

    <div className="dashboard-card">

      <h3>Conversas recentes</h3>

      <div className="conversation-list">

        {conversations.map((conv, index) => (

          <div key={index} className="conversation-item">

            <div>

              <strong>{conv.name}</strong>

              <p>{conv.message}</p>

            </div>

            <span>{conv.time}</span>

          </div>

        ))}

      </div>

    </div>

  )

}