import "../../styles/chat.css"

type Client = {
  name: string
  phone: string
  order?: string
  status?: string
  shipping?: string
  payment_method?: string
  shipping_method?: string
}

type Props = {
  client?: Client | null
}

function getStatus(status?: string) {
  switch (status) {
    case "paid":
    case "authorized":
      return { label: "Pago", className: "status-paid" }
    case "pending":
      return { label: "Pendente", className: "status-pending" }
    case "cancelled":
      return { label: "Cancelado", className: "status-cancelled" }
    default:
      return { label: "Em análise", className: "status-pending" }
  }
}

export default function ChatInfo({ client }: Props) {

  if (!client) {
    return (
      <div className="chat-info">
        <div className="chat-info-empty">
          Nenhum cliente selecionado
        </div>
      </div>
    )
  }

  const status = getStatus(client.status)

  return (
    <div className="chat-info">

      {/* HEADER */}
      <div className="chat-info-header">

        <div className="chat-info-avatar">
          {client.name?.charAt(0)?.toUpperCase() || "?"}
        </div>

        <div>
          <div className="chat-info-name">
            {client.name || "Cliente"}
          </div>

          <div className="chat-info-phone">
            {client.phone || "Sem telefone"}
          </div>
        </div>

      </div>

      {/* PEDIDO */}
      <div className="chat-info-section">

        <div className="chat-info-title">Pedido</div>

        <div className="chat-info-item">
          <span>Nº:</span>
          <strong>#{client.order || "-"}</strong>
        </div>

        <div className="chat-info-item">
          <span>Status:</span>
          <span className={`order-status ${status.className}`}>
            {status.label}
          </span>
        </div>

        <div className="chat-info-item">
          <span>Envio:</span>
          <strong>{client.shipping || "Não informado"}</strong>
        </div>

      </div>

      {/* DETALHES */}
      <div className="chat-info-section">

        <div className="chat-info-title">Detalhes</div>

        <div className="chat-info-item">
          <span>Pagamento:</span>
          <strong>{client.payment_method || "Não informado"}</strong>
        </div>

        <div className="chat-info-item">
          <span>Entrega:</span>
          <strong>{client.shipping_method || "Não informado"}</strong>
        </div>

      </div>

    </div>
  )
}