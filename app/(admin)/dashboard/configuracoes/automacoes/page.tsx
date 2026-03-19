import "../../styles/automacoes.css"
import AutomationCard from "../../components/automations/automation/AutomationCard"

export default function Automacoes(){

const automations=[
{
name:"Menu inicial",
description:"Mensagem automática quando o cliente envia a primeira mensagem",
active:true
},
{
name:"Fora do horário",
description:"Resposta automática quando a loja estiver fechada",
active:false
},
{
name:"Avaliação de atendimento",
description:"Solicita avaliação após o atendimento",
active:true
}
]

return(

<div className="automations-page">

<div className="automations-header">

<div className="automations-title">
Automações
</div>

<button className="btn-primary">
Nova automação
</button>

</div>


<div className="automations-grid">

{automations.map((a,index)=>(
<AutomationCard
key={index}
name={a.name}
description={a.description}
active={a.active}
/>
))}

</div>

</div>

)

}