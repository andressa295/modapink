"use client"

import { useState } from "react"
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

export default function ChatList() {

  const [activeFilter, setActiveFilter] = useState("Todos")
  const [selectedChat, setSelectedChat] = useState<number | null>(null)

  const chats: Chat[] = [
    {
      id: 1,
      name: "Maria",
      message: "Tem esse vestido no M?",
      sector: "Vendas",
      status: "online",
      attendant: "Ana",
      time: "14:32"
    },
    {
      id: 2,
      name: "Juliana",
      message: "Meu pedido não chegou",
      sector: "SAC",
      status: "pendente",
      attendant: "Carlos",
      time: "13:10"
    },
    {
      id: 3,
      name: "Carla",
      message: "Quero comprar no atacado",
      sector: "Financeiro",
      status: "resolvido",
      attendant: "Bruna",
      time: "12:05"
    }
  ]

  const filters = ["Todos", "Vendas", "SAC", "Financeiro"]

  const filteredChats =
    activeFilter === "Todos"
      ? chats
      : chats.filter(chat => chat.sector === activeFilter)

  return (
    <div className="chat-list">

      {/* FILTROS */}
      <div className="chat-filters">

        {filters.map(filter => (
          <button
            key={filter}
            className={`chat-filter ${activeFilter === filter ? "active" : ""}`}
            onClick={() => setActiveFilter(filter)}
          >
            {filter}
          </button>
        ))}

      </div>

      {/* LISTA */}
      <div className="chat-items">

        {filteredChats.map(chat => (
          <div
            key={chat.id}
            className={`chat-item ${selectedChat === chat.id ? "selected" : ""}`}
            onClick={() => setSelectedChat(chat.id)}
          >

            <div className="chat-item-header">

              <span className="chat-item-name">
                {chat.name}
              </span>

              <span className="chat-item-time">
                {chat.time}
              </span>

            </div>

            <div className="chat-item-message">
              {chat.message}
            </div>

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