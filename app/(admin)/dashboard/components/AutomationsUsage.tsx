import "./AutomationsUsage.css"

export default function AutomationsUsage() {

  const automations = [
    { name: "Menu principal", uses: 84 },
    { name: "Resposta FRETE", uses: 42 },
    { name: "Resposta PRAZO", uses: 31 },
    { name: "Encaminhar suporte", uses: 12 }
  ]

  return (

    <div className="dashboard-card">

      <h3>Automações mais usadas</h3>

      <div className="automation-list">

        {automations.map((item, index) => (

          <div key={index} className="automation-item">

            <span>{item.name}</span>

            <strong>{item.uses}</strong>

          </div>

        ))}

      </div>

    </div>

  )

}