"use client"

import { useEffect, useRef, useState } from "react"
import "../styles/chat.css"

const API = process.env.NEXT_PUBLIC_API_URL!

export default function Conversas() {
  const [conversations, setConversations] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState("")
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)

  const messagesRef = useRef<HTMLDivElement | null>(null)
  const shouldScrollRef = useRef(true)

  // ======================
  // LOAD CONVERSAS
  // ======================
  async function loadConversations() {
    const res = await fetch(`${API}/conversations`, { cache: "no-store" })
    const data = await res.json()

    setConversations(data)

    if (!selected && data.length > 0) {
      setSelected(data[0])
    }
  }

  // ======================
  // LOAD MESSAGES
  // ======================
  async function loadMessages(conversationId?: string) {
    const id = conversationId || selected?.id
    if (!id) return

    setLoadingMessages(true)

    const res = await fetch(
      `${API}/messages?conversation_id=${id}`,
      { cache: "no-store" }
    )

    const data = await res.json()

    const lastLocal = messages[messages.length - 1]?.id
    const lastRemote = data[data.length - 1]?.id

    if (lastLocal !== lastRemote) {
      setMessages(data)
    }

    setLoadingMessages(false)
  }

  // ======================
  // INIT
  // ======================
  useEffect(() => {
    loadConversations()
  }, [])

  // ======================
  // TROCA DE CONVERSA
  // ======================
  useEffect(() => {
    if (selected) {
      setMessages([])
      loadMessages(selected.id)
    }
  }, [selected])

  // ======================
  // POLLING
  // ======================
  useEffect(() => {
    const interval = setInterval(() => {
      loadConversations()
      loadMessages()
    }, 2500)

    return () => clearInterval(interval)
  }, [selected])

  // ======================
  // SCROLL INTELIGENTE
  // ======================
  useEffect(() => {
    if (!messagesRef.current) return

    if (shouldScrollRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [messages])

  function handleScroll() {
    if (!messagesRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = messagesRef.current

    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
    shouldScrollRef.current = isNearBottom
  }

  // ======================
  // SEND
  // ======================
  async function sendMessage() {
    if (!input.trim() || !selected || sending) return

    const text = input
    setInput("")
    setSending(true)

    try {
      await fetch(`${API}/send-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          phone: selected.customer_phone,
          message: text
        })
      })

      shouldScrollRef.current = true
      await loadMessages()
    } catch (err) {
      console.error("Erro ao enviar mensagem")
    }

    setSending(false)
  }

  return (
    <div className="chat-app">

      {/* SIDEBAR */}
      <div className="sidebar">
        {conversations.length === 0 && (
          <p className="empty">Nenhuma conversa ainda</p>
        )}

        {conversations.map(c => (
          <div
            key={c.id}
            className={`chat-item ${selected?.id === c.id ? "active" : ""}`}
            onClick={() => setSelected(c)}
          >
            <strong>{c.customer_name || "Cliente"}</strong>
            <span>{c.customer_phone}</span>
          </div>
        ))}
      </div>

      {/* CHAT */}
      <div className="chat">

        {/* HEADER */}
        <div className="header">
          {selected ? (
            <>
              <strong>{selected.customer_name || "Cliente"}</strong>
              <span>{selected.customer_phone}</span>
            </>
          ) : (
            <span>Selecione uma conversa</span>
          )}
        </div>

        {/* MESSAGES */}
        <div
          className="messages"
          ref={messagesRef}
          onScroll={handleScroll}
        >
          {loadingMessages && (
            <p className="empty">Carregando...</p>
          )}

          {!loadingMessages && messages.length === 0 && (
            <p className="empty">Nenhuma mensagem</p>
          )}

          {messages.map(m => (
            <div
              key={m.id}
              className={`bubble ${m.sender === "user" ? "client" : "me"}`}
            >
              {m.content}
            </div>
          ))}
        </div>

        {/* INPUT */}
        <div className="input">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Digite uma mensagem..."
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage()
            }}
          />

          <button onClick={sendMessage} disabled={sending}>
            {sending ? "..." : "Enviar"}
          </button>
        </div>

      </div>
    </div>
  )
}