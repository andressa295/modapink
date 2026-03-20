"use client"

import "../../styles/chat.css"

type Chat = {
  id: number
  name: string
  message: string
  sector: "Vendas" | "SAC" | "Financeiro"
  status: "online" | "pendente" | "resolvido"
  attendant: string
  time: string
}

type Props = {
  chats?: Chat[] // 🔥 agora opcional (evita crash)
  selected?: number | null
  onSelect?: (id: number) => void
}

export default function ChatList({
  chats = [], // 🔥 fallback seguro
  selected = null,
  onSelect,
}: Props) {

  return (
    <div className="chat-list">

      <div className="chat-items">

        {/* 🔥 estado vazio (UX importante) */}
        {chats.length === 0 && (
          <div className="chat-empty">
            Nenhuma conversa encontrada
          </div>
        )}

        {/* 🔥 lista segura */}
        {chats.map(chat => (
          <div
            key={chat.id}
            className={`chat-item ${selected === chat.id ? "selected" : ""}`}
            onClick={() => onSelect?.(chat.id)}
          >

            {/* HEADER */}
            <div className="chat-item-header">
              <span className="chat-item-name">
                {chat.name}
              </span>

              <span className="chat-item-time">
                {chat.time}
              </span>
            </div>

            {/* ÚLTIMA MENSAGEM */}
            <div className="chat-item-message">
              {chat.message}
            </div>

            {/* FOOTER */}
            <div className="chat-item-footer">

              <span className={`badge ${chat.sector.toLowerCase()}`}>
                {chat.sector}
              </span>

              <span className={`status ${chat.status}`}>
                {chat.status}
              </span>

              <span className="attendant">
                {chat.attendant}
              </span>

            </div>

          </div>
        ))}

      </div>

    </div>
  )
}