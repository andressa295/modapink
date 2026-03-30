"use client"

import { useEffect, useRef, useState } from "react"
import MessageBubble from "./MessageBubble"
import ChatInfo from "./ChatInfo"
import { extractOrderNumber } from "@/utils/extractOrder"
import { fetchOrder } from "@/services/fetchOrder"
import { useSession } from "../../context/SessionContext"
import "../../styles/chat.css"

type Message = {
  id: number
  text: string
  type: "client" | "agent"
}

// 🔥 URL DO BOT (PADRÃO GLOBAL)
const API_BOT = "https://modapink.phand.com.br/bot"

export default function ChatWindow() {
  const { activeSession } = useSession()

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [clientData, setClientData] = useState<any>(null)

  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  // ========================
  // 🔽 AUTO SCROLL
  // ========================
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // ========================
  // 🧠 PROCESSA MENSAGEM
  // ========================
  async function handleIncomingMessage(text: string) {
    const orderId = extractOrderNumber(text)

    if (!orderId) return

    const order = await fetchOrder(orderId)

    if (!order) return

    const data = {
      name: order.customerName,
      phone: order.phone,
      order: order.id,
      status: order.status,
      shipping: order.shipping,
      payment_method: order.payment_method,
      shipping_method: order.shipping_method,
    }

    setClientData(data)

    // 🔥 resposta automática
    const autoReply: Message = {
      id: Date.now() + 1,
      type: "agent",
      text: `Pedido #${order.id} encontrado ✅
Status: ${order.status}
Envio: ${order.shipping}`,
    }

    setMessages(prev => [...prev, autoReply])
  }

  // ========================
  // 📤 ENVIO AGENTE → WHATSAPP
  // ========================
  async function sendMessage() {
    if (!input.trim()) return

    const text = input

    const newMsg: Message = {
      id: Date.now(),
      text,
      type: "agent",
    }

    // UI instantânea
    setMessages(prev => [...prev, newMsg])
    setInput("")

    // 🔥 ENVIO REAL PRO BOT
    if (activeSession) {
      try {
        const res = await fetch(`${API_BOT}/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            session: activeSession,
            message: text
          })
        })

        if (!res.ok) {
          console.error("Erro ao enviar mensagem:", await res.text())
        }

      } catch (err) {
        console.error("Erro ao enviar mensagem:", err)
      }
    }
  }

  // ========================
  // 📥 RECEBER CLIENTE (mock / futuro realtime)
  // ========================
  async function receiveClientMessage(text: string) {
    const newMsg: Message = {
      id: Date.now(),
      text,
      type: "client",
    }

    setMessages(prev => [...prev, newMsg])

    await handleIncomingMessage(text)
  }

  // ========================
  // 🧪 MOCK INICIAL (remover depois)
  // ========================
  useEffect(() => {
    setMessages([
      {
        id: 1,
        text: "Olá, preciso de ajuda com meu pedido",
        type: "client"
      }
    ])
  }, [])

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

        <div className="chat-status">
          {activeSession ? "🟢 Online" : "⚪ Offline"}
        </div>

      </div>

      {/* MESSAGES */}
      <div className="chat-messages">

        {messages.map(msg => (
          <MessageBubble key={msg.id} {...msg} />
        ))}

        <div ref={messagesEndRef} />

      </div>

      {/* INPUT */}
      <div className="chat-input">

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Digite uma mensagem..."
          onKeyDown={(e) => {
            if (e.key === "Enter") sendMessage()
          }}
        />

        <button onClick={sendMessage}>
          Enviar
        </button>

        {/* 🔥 SIMULADOR */}
        <button
          onClick={() =>
            receiveClientMessage("Meu pedido é #4821")
          }
        >
          Simular cliente
        </button>

      </div>

      {/* INFO */}
      <ChatInfo client={clientData} />

    </div>
  )
}