"use client"

import { useState } from "react"
import MessageBubble from "./MessageBubble"
import ChatInfo from "./ChatInfo"
import { extractOrderNumber } from "@/utils/extractOrder"
import { fetchOrder } from "@/services/fetchOrder"
import "../../styles/chat.css"

// 🔥 TIPO CORRETO
type Message = {
  id: number
  text: string
  type: "client" | "agent"
}

export default function ChatWindow() {

  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: "Meu pedido não chegou, é o 4821", type: "client" },
  ])

  const [input, setInput] = useState("")
  const [clientData, setClientData] = useState<any>(null)

  async function handleIncomingMessage(text: string) {
    const orderId = extractOrderNumber(text)

    if (!orderId) return

    const order = await fetchOrder(orderId)

    if (!order) return

    setClientData({
      name: order.customerName,
      phone: order.phone,
      order: `#${order.id}`,
      status: order.status,
      shipping: order.shipping,
    })
  }

  async function sendMessage() {
    if (!input.trim()) return

    const newMsg: Message = {
      id: Date.now(),
      text: input,
      type: "agent",
    }

    setMessages(prev => [...prev, newMsg])
    setInput("")
  }

  // 🔥 simula recebimento de mensagem do cliente
  async function receiveClientMessage(text: string) {
    const newMsg: Message = {
      id: Date.now(),
      text,
      type: "client",
    }

    setMessages(prev => [...prev, newMsg])

    await handleIncomingMessage(text)
  }

  return (
    <div className="chat-window">

      {/* HEADER */}
      <div className="chat-header">
        <div>
          <div className="chat-client-name">
            {clientData?.name || "Cliente"}
          </div>

          <div className="chat-client-phone">
            {clientData?.phone || ""}
          </div>
        </div>

        <div className="chat-status">🟢 Online</div>
      </div>

      {/* MENSAGENS */}
      <div className="chat-messages">
        {messages.map(msg => (
          <MessageBubble key={msg.id} {...msg} />
        ))}
      </div>

      {/* INPUT */}
      <div className="chat-input">

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Digite uma mensagem..."
        />

        <button onClick={sendMessage}>
          Enviar
        </button>

        {/* 🔥 botão de teste */}
        <button
          onClick={() =>
            receiveClientMessage("Meu pedido é #4821")
          }
        >
          Simular cliente
        </button>

      </div>

      {/* INFO LATERAL */}
      <ChatInfo client={clientData} />

    </div>
  )
}