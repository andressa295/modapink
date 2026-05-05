"use client"

import { useEffect, useRef, useState } from "react"
import "../styles/chat.css"
import { createBrowserClient } from "@supabase/ssr"

const API = process.env.NEXT_PUBLIC_API_URL!

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Conversas() {
  const [conversations, setConversations] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)

  const messagesRef = useRef<HTMLDivElement | null>(null)
  const shouldScrollRef = useRef(true)
  const channelRef = useRef<any>(null)

  // ======================
  // LOAD CONVERSAS
  // ======================
  async function loadConversations() {
    try {
      const res = await fetch(`${API}/conversations`, { cache: "no-store" })
      const data = await res.json()

      const list = (Array.isArray(data) ? data : data?.data || [])
        .sort((a: any, b: any) =>
  new Date(b.last_message_at).getTime() -
  new Date(a.last_message_at).getTime()
)

      setConversations(list)

      if (!selected && list.length > 0) {
        setSelected(list[0])
      }

    } catch (err) {
      console.error("❌ erro conversations:", err)
    }
  }

  // ======================
  // LOAD MESSAGES
  // ======================
  async function loadMessages(id: string) {
    try {
      const res = await fetch(
        `${API}/messages?conversation_id=${id}`,
        { cache: "no-store" }
      )

      const data = await res.json()

      if (Array.isArray(data)) {
        setMessages(data)
      }

    } catch (err) {
      console.error("❌ erro messages:", err)
    }
  }

  // ======================
  // REALTIME
  // ======================
  useEffect(() => {
    if (!selected) return

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

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
          const newMsg = payload.new

          setMessages((prev) => {
            const exists = prev.some((m) => m.id === newMsg.id)
            if (exists) return prev
            return [...prev, newMsg]
          })

          loadConversations()
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }

  }, [selected])

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
      loadMessages(selected.id)
    }
  }, [selected])

  // ======================
  // FALLBACK POLLING
  // ======================
  useEffect(() => {
    if (!selected) return

    const interval = setInterval(() => {
      loadMessages(selected.id)
    }, 5000)

    return () => clearInterval(interval)

  }, [selected])

  // ======================
  // SCROLL
  // ======================
  useEffect(() => {
    if (!messagesRef.current) return

    if (shouldScrollRef.current) {
      messagesRef.current.scrollTop =
        messagesRef.current.scrollHeight
    }
  }, [messages])

  function handleScroll() {
    if (!messagesRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = messagesRef.current

    shouldScrollRef.current =
      scrollHeight - scrollTop - clientHeight < 100
  }

  // ======================
  // SEND MESSAGE
  // ======================
  async function sendMessage() {
    if (!input.trim() || !selected || sending) return

    const text = input
    setInput("")
    setSending(true)

    const tempId = Date.now()

    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        content: text,
        sender: "agent"
      }
    ])

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
      console.error("❌ erro enviar")
    }

    setSending(false)
  }

  return (
    <div className="chat-app">

      {/* SIDEBAR */}
      <div className="sidebar">
        {conversations.map((c) => (
          <div
            key={c.id}
            className={`chat-item ${
              selected?.id === c.id ? "active" : ""
            }`}
            onClick={() => setSelected(c)}
          >

            <div className="chat-info">
              <div className="top">
                <strong>{c.customer_name || "Cliente"}</strong>

                <span className="time">
                  {c.last_message_at
                    ? new Date(c.last_message_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit"
                      })
                    : ""}
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
              <strong>{selected.customer_name || "Cliente"}</strong>
              <span>{selected.phone}</span>
            </>
          )}
        </div>

        <div
          className="messages"
          ref={messagesRef}
          onScroll={handleScroll}
        >
          {messages.map((m) => (
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

          <button onClick={sendMessage}>
            {sending ? "..." : "Enviar"}
          </button>
        </div>

      </div>
    </div>
  )
}