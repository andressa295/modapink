"use client"

import { useEffect, useRef, useState } from "react"
import "../styles/chat.css"
import { createBrowserClient } from "@supabase/ssr"

const API = process.env.NEXT_PUBLIC_API_URL!

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ======================
// TYPES
// ======================
type Conversation = {
  id: string
  phone: string
  customer_name?: string
  avatar_url?: string
  last_message?: string
  updated_at?: string
}

type Message = {
  id: string
  content: string
  sender: "user" | "agent" | "bot"
}

// ======================
// COMPONENT
// ======================
export default function Conversas() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)

  const messagesRef = useRef<HTMLDivElement | null>(null)

  // ======================
  // LOAD CONVERSAS
  // ======================
  async function loadConversations() {
    const res = await fetch(`${API}/conversations`, { cache: "no-store" })
    const data = await res.json()

    const list: Conversation[] = Array.isArray(data)
      ? data
      : data?.data || []

    list.sort(
      (a, b) =>
        new Date(b.updated_at || "").getTime() -
        new Date(a.updated_at || "").getTime()
    )

    setConversations(list)

    if (list.length > 0 && !selected) {
      setSelected(list[0])
    }
  }

  // ======================
  // LOAD MESSAGES
  // ======================
  async function loadMessages(id: string) {
    const res = await fetch(`${API}/messages?conversation_id=${id}`)
    const data = await res.json()

    if (Array.isArray(data)) {
      setMessages(data)
    }
  }

  // ======================
  // INIT
  // ======================
  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    if (selected) loadMessages(selected.id)
  }, [selected])

  // ======================
  // REALTIME
  // ======================
  useEffect(() => {
    if (!selected) return

    const channel = supabase
      .channel(`messages-${selected.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selected.id}`
        },
        (payload) => {
  const newMessage: Message = {
    id: payload.new.id,
    content: payload.new.content,
    sender: payload.new.sender
  }

  setMessages((prev) => [...prev, newMessage])

  loadConversations()
}
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selected])

  // ======================
  // SCROLL
  // ======================
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop =
        messagesRef.current.scrollHeight
    }
  }, [messages])

  // ======================
  // SEND
  // ======================
  async function sendMessage() {
    if (!input.trim() || !selected) return

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
          phone: selected.phone,
          message: text
        })
      })
    } catch (err) {
      console.error("erro envio:", err)
    }

    setSending(false)
  }

  return (
    <div className="chat-app">

      {/* SIDEBAR */}
      <div className="sidebar">

        {conversations.map((c: Conversation) => (
          <div
            key={c.id}
            className={`chat-item ${
              selected?.id === c.id ? "active" : ""
            }`}
            onClick={() => setSelected(c)}
          >

            <img
              src={c.avatar_url || "/placeholder.png"}
              className="avatar"
            />

            <div className="chat-info">

              <div className="top">
                <strong>
                  {c.customer_name || c.phone}
                </strong>

                <span className="time">
                  {c.updated_at &&
                    new Date(c.updated_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                </span>
              </div>

              <p className="preview">
                {c.last_message || "Sem mensagens"}
              </p>

            </div>
          </div>
        ))}

      </div>

      {/* CHAT */}
      <div className="chat">

        <div className="header">
          {selected && (
            <>
              <img
                src={selected.avatar_url || "/placeholder.png"}
                className="avatar-header"
              />

              <div>
                <strong>{selected.customer_name || selected.phone}</strong>
                <span>{selected.phone}</span>
              </div>
            </>
          )}
        </div>

        <div className="messages" ref={messagesRef}>
          {messages.map((m: Message) => (
            <div
              key={m.id}
              className={`bubble ${
                m.sender === "user" ? "client" : "me"
              }`}
            >
              {m.content}
            </div>
          ))}
        </div>

        <div className="input">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite uma mensagem..."
            onKeyDown={(e) =>
              e.key === "Enter" && sendMessage()
            }
          />

          <button onClick={sendMessage} disabled={sending}>
            {sending ? "..." : "Enviar"}
          </button>
        </div>

      </div>
    </div>
  )
}