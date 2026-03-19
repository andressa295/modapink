import "../styles/numeros.css"

export default function Numeros() {

  const numbers = [
    {
      setor: "Vendas",
      phone: "(11) 9999-0000",
      status: "online",
      users: ["Rafaela", "Bruna"]
    },
    {
      setor: "SAC",
      phone: "(11) 9999-1111",
      status: "online",
      users: ["Rodrigo"]
    },
    {
      setor: "Logística",
      phone: "(11) 9999-2222",
      status: "offline",
      users: []
    }
  ]

  return (

    <div className="numbers-page">

      <div className="numbers-header">

        <div className="numbers-title">
          Números de WhatsApp
        </div>

        <button className="connect-button">
          + Conectar WhatsApp
        </button>

      </div>

      <div className="numbers-grid">

        {numbers.map((n, index) => (

          <div key={index} className="number-card">

            <div className="number-title">
              {n.setor}
            </div>

            <div className="number-phone">
              {n.phone}
            </div>

            <div
              className={`number-status ${
                n.status === "online"
                  ? "status-online"
                  : "status-offline"
              }`}
            >
              {n.status === "online"
                ? "🟢 Conectado"
                : "🔴 Desconectado"}
            </div>

            <div className="number-users">

              Responsáveis:

              {n.users.length > 0
                ? ` ${n.users.join(", ")}`
                : " Nenhum"}

            </div>

            <div className="number-actions">

              <button>
                Gerenciar
              </button>

            </div>

          </div>

        ))}

      </div>

    </div>
  )
}