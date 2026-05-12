import styles from "../../styles/automacoes.module.css"

import AutomationCard from "../../components/automations/automation/AutomationCard"

export default function Automacoes() {

  const automations = [

    {

      name:
        "Menu inicial",

      description:
        "Mensagem automática quando o cliente envia a primeira mensagem",

      active: true
    },

    {

      name:
        "Fora do horário",

      description:
        "Resposta automática quando a loja estiver fechada",

      active: false
    },

    {

      name:
        "Avaliação de atendimento",

      description:
        "Solicita avaliação após o atendimento",

      active: true
    }
  ]

  return (

    <div
      className={
        styles["automations-page"]
      }
    >

      {/* HEADER */}
      <div
        className={
          styles["automations-header"]
        }
      >

        <div
          className={
            styles["automations-title"]
          }
        >

          Automações

        </div>

        <button
          className={
            styles["automation-action"]
          }
        >

          Nova automação

        </button>

      </div>

      {/* GRID */}
      <div
        className={
          styles["automations-grid"]
        }
      >

        {automations.map(
          (a, index) => (

            <AutomationCard

              key={index}

              name={a.name}

              description={
                a.description
              }

              active={a.active}

            />
          )
        )}

      </div>

    </div>
  )
}