import "../../styles/chat.css"

type Client = {
  name: string
  phone: string
  order?: string
  status?: string
  shipping?: string
}

type Props = {
  client?: Client | null
}

export default function ChatInfo({ client }: Props) {

  if (!client) {
    return (
      <div className="chat-info">
        <div className="chat-info-empty">
          Nenhum pedido carregado
        </div>
      </div>
    )
  }

  return (
    <div className="chat-info">

      <div className="chat-info-header">
        <div className="chat-info-avatar">
          {client.name.charAt(0)}
        </div>

        <div>
          <div className="chat-info-name">{client.name}</div>
          <div className="chat-info-phone">{client.phone}</div>
        </div>
      </div>

      <div className="chat-info-section">
        <div className="chat-info-title">Pedido</div>

        <div className="chat-info-item">Nº: {client.order}</div>
        <div className="chat-info-item">Status: {client.status}</div>
        <div className="chat-info-item">Envio: {client.shipping}</div>
      </div>

    </div>
  )
}