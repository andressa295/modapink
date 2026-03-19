import "../styles/users.css"

export default function Usuarios() {

const users = [
{
name:"Rafaela",
email:"rafaela@email.com",
role:"Admin",
status:"active"
},
{
name:"Bruna",
email:"bruna@email.com",
role:"Atendente",
status:"active"
},
{
name:"Rodrigo",
email:"rodrigo@email.com",
role:"SAC",
status:"active"
}
]

return (

<div>

<div className="users-header">

<div className="users-title">
Usuários
</div>

<button className="users-button">
+ Novo usuário
</button>

</div>

<div className="users-table">

<div className="users-row header">
<div>Nome</div>
<div>Email</div>
<div>Cargo</div>
<div>Status</div>
<div></div>
</div>

{users.map((u,index)=>(
<div key={index} className="users-row">

<div>{u.name}</div>

<div>{u.email}</div>

<div>{u.role}</div>

<div>
<span className={`user-status ${u.status==="active"?"status-active":"status-off"}`}>
{u.status==="active"?"Ativo":"Inativo"}
</span>
</div>

<div>
Editar
</div>

</div>
))}

</div>

</div>

)
}