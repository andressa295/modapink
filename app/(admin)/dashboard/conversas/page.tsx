"use client"

import { useEffect, useRef, useState } from "react"
import "../styles/chat.css"

const API = process.env.NEXT_PUBLIC_API_URL!

type Conversation = {
  id: string
  customer_name: string
  customer_phone: string
  store_id: string
}

type Message = {
  id: string
  content: string
  sender: "user" | "agent" | "bot"
  created_at: string
}

export default function Conversas() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")

  const [loadingConversations, setLoadingConversations] = useState(true)
  const [initialLoadingMessages, setInitialLoadingMessages] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  // ========================
  // LOAD CONVERSAS
  // ========================
  async function loadConversations() {
    try {
      const res = await fetch(`${API}/conversations`, { cache: "no-store" })

      if (!res.ok) throw new Error("Erro ao buscar conversas")

      const data = await res.json()

      setConversations(data)

      if (!selected && data.length > 0) {
        setSelected(data[0])
      }

    } catch (err) {
      console.error("❌ conversas:", err)
    } finally {
      setLoadingConversations(false)
    }
  }

  // ========================
  // LOAD MESSAGES
  // ========================
  async function loadMessages(silent = false) {
    if (!selected) return

    try {
      if (!silent && messages.length === 0) {
        setInitialLoadingMessages(true)
      }

      const res = await fetch(
        `${API}/messages?conversation_id=${selected.id}`,
        { cache: "no-store" }
      )

      if (!res.ok) throw new Error("Erro ao buscar mensagens")

      const data: Message[] = await res.json()

      const lastLocal = messages[messages.length - 1]?.id
      const lastRemote = data[data.length - 1]?.id

      if (lastLocal !== lastRemote) {
        setMessages(data)
      }

    } catch (err) {
      console.error("❌ mensagens:", err)
    } finally {
      setInitialLoadingMessages(false)
    }
  }

  // ========================
  // INIT
  // ========================
  useEffect(() => {
    loadConversations()
  }, [])

  // ========================
  // TROCA DE CONVERSA
  // ========================
  useEffect(() => {
    if (!selected) return

    setMessages([])
    setInitialLoadingMessages(true)

    loadMessages()
  }, [selected?.id])

  // ========================
  // POLLING
  // ========================
  useEffect(() => {
    if (!selected) return

    const interval = setInterval(() => {
      loadMessages(true)
    }, 2000)

    return () => clearInterval(interval)
  }, [selected?.id])

  // ========================
  // AUTO SCROLL
  // ========================
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // ========================
  // SEND MESSAGE
  // ========================
  async function sendMessage() {
    if (!input.trim() || !selected) return

    if (!selected.store_id) {
      console.error("❌ store_id inválido")
      return
    }

    const text = input
    setInput("")

    const tempId = "temp-" + Date.now()

    // UI otimista
    setMessages(prev => [
      ...prev,
      {
        id: tempId,
        content: text,
        sender: "agent",
        created_at: new Date().toISOString()
      }
    ])

    try {
      const res = await fetch(`${API}/send-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          phone: selected.customer_phone,
          message: text,
          store_id: selected.store_id
        })
      })

      let data: any = null

      try {
        data = await res.json()
      } catch {
        console.error("❌ resposta inválida da API")
      }

      // 🔥 CORREÇÃO PRINCIPAL
      if (!res.ok) {
        const errorMsg =
          data?.error ||
          data?.message ||
          JSON.stringify(data) ||
          "Erro desconhecido"

        console.error("❌ ERRO REAL:", errorMsg)

        // remove mensagem fake
        setMessages(prev => prev.filter(m => m.id !== tempId))

        // 💥 feedback visual opcional
        alert(errorMsg)

        return
      }

      // atualiza lista real
      setTimeout(() => {
        loadMessages(true)
      }, 300)

    } catch (err: any) {
      console.error("❌ envio:", err?.message || err)

      setMessages(prev => prev.filter(m => m.id !== tempId))

      alert("Erro de conexão com servidor")
    }
  }

  return (
    <div className="chat-app">

      {/* SIDEBAR */}
      <div className="sidebar">

        {loadingConversations && (
          <div className="empty">Carregando...</div>
        )}

        {!loadingConversations && conversations.length === 0 && (
          <div className="empty">Nenhuma conversa ainda</div>
        )}

        {conversations.map(c => (
          <div
            key={c.id}
            className={`chat-item ${selected?.id === c.id ? "active" : ""}`}
            onClick={() => setSelected(c)}
          >
            <strong>{c.customer_name || "Cliente"}</strong>
            <span className="chat-sub">{c.customer_phone}</span>
          </div>
        ))}
      </div>

      {/* CHAT */}
      <div className="chat">

        {/* HEADER */}
        <div className="header">
          {selected ? (
            <div>
              <strong>{selected.customer_name || "Cliente"}</strong>
              <span>{selected.customer_phone}</span>
            </div>
          ) : (
            <span>Selecione uma conversa</span>
          )}
        </div>

        {/* MESSAGES */}
        <div className="messages">

          {initialLoadingMessages && (
            <div className="empty">Carregando mensagens...</div>
          )}

          {!initialLoadingMessages && messages.length === 0 && (
            <div className="empty">Nenhuma mensagem</div>
          )}

          {messages.map(m => (
            <div
              key={m.id}
              className={`bubble ${m.sender === "user" ? "client" : "me"}`}
            >
              {m.content}
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>

        {/* INPUT */}
        <div className="input">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Digite uma mensagem..."
            onKeyDown={e => {
              if (e.key === "Enter") sendMessage()
            }}
            disabled={!selected}
          />

          <button
            onClick={sendMessage}
            disabled={!selected || !input.trim()}
          >
            Enviar
          </button>
        </div>

      </div>
    </div>
  )
}