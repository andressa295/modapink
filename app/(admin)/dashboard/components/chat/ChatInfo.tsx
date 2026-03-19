"use client"

import "../../styles/chat.css"

type ChatInfoProps = {
  client?: {
    name: string
    phone: string
    order?: string
    status?: string
    shipping?: string
    attendant?: string
    rating?: number
    lastContact?: string
  }
}

export default function ChatInfo({ client }: ChatInfoProps) {

  // fallback (mock)
  const data = client ?? {
    name: "Juliana",
    phone: "(11) 99999-8888",
    order: "#4821",
    status: "Enviado",
    shipping: "Correios",
    attendant: "Ana",
    rating: 4.8,
    lastContact: "Hoje às 14:32"
  }

  return (
    <div className="chat-info">

      {/* HEADER */}
      <div className="chat-info-header">
        <div className="chat-info-avatar">
          {data.name.charAt(0)}
        </div>

        <div>
          <div className="chat-info-name">
            {data.name}
          </div>

          <div className="chat-info-phone">
            {data.phone}
          </div>
        </div>
      </div>

      {/* SEÇÃO PEDIDO */}
      <div className="chat-info-section">
        <div className="chat-info-title">Pedido</div>

        <div className="chat-info-item">
          Nº: {data.order}
        </div>

        <div className="chat-info-item">
          Status: {data.status}
        </div>

        <div className="chat-info-item">
          Transportadora: {data.shipping}
        </div>
      </div>

      {/* SEÇÃO ATENDIMENTO */}
      <div className="chat-info-section">
        <div className="chat-info-title">Atendimento</div>

        <div className="chat-info-item">
          Atendente: {data.attendant}
        </div>

        <div className="chat-info-item">
          Avaliação: ⭐ {data.rating}
        </div>

        <div className="chat-info-item">
          Último contato: {data.lastContact}
        </div>
      </div>

    </div>
  )
}