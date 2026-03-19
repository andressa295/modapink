type Props = {
name:string
description:string
active:boolean
}

export default function AutomationCard({
name,
description,
active
}:Props){

return(

<div className="automation-card">

<div className="automation-name">
{name}
</div>

<div className="automation-desc">
{description}
</div>

<div className={`automation-status ${active?"status-active":"status-off"}`}>
{active?"Ativo":"Desativado"}
</div>

</div>

)

}