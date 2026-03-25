"use client"

import "../../styles/chat.css"

type Chat = {
  id: number
  name: string
  message: string
  sector: "Vendas" | "SAC" | "Financeiro"
  status: "online" | "pendente" | "resolvido"
  attendant?: string
  time?: string
}

type Props = {
  chats?: Chat[]
  selected?: number | null
  onSelect?: (id: number) => void
}

function getStatus(status: Chat["status"]) {
  switch (status) {
    case "online":
      return { label: "Ativo", className: "status-online" }
    case "pendente":
      return { label: "Pendente", className: "status-pending" }
    case "resolvido":
      return { label: "Resolvido", className: "status-done" }
    default:
      return { label: "Desconhecido", className: "" }
  }
}

export default function ChatList({
  chats = [],
  selected = null,
  onSelect,
}: Props) {

  return (
    <div className="chat-list">

      <div className="chat-items">

        {/* EMPTY */}
        {chats.length === 0 && (
          <div className="chat-empty">
            Nenhuma conversa encontrada
          </div>
        )}

        {/* LIST */}
        {chats.map((chat) => {
          const status = getStatus(chat.status)

          return (
            <div
              key={chat.id}
              className={`chat-item ${
                selected === chat.id ? "selected" : ""
              }`}
              onClick={() => onSelect?.(chat.id)}
            >

              {/* HEADER */}
              <div className="chat-item-header">

                <span className="chat-item-name">
                  {chat.name || "Cliente"}
                </span>

                <span className="chat-item-time">
                  {chat.time || "--:--"}
                </span>

              </div>

              {/* MESSAGE */}
              <div className="chat-item-message">
                {chat.message || "Sem mensagem"}
              </div>

              {/* FOOTER */}
              <div className="chat-item-footer">

                <span className={`badge ${chat.sector?.toLowerCase()}`}>
                  {chat.sector || "Geral"}
                </span>

                <span className={`status ${status.className}`}>
                  {status.label}
                </span>

                <span className="attendant">
                  {chat.attendant || "Sem atendente"}
                </span>

              </div>

            </div>
          )
        })}

      </div>

    </div>
  )
}