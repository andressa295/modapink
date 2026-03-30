"use client"

import { useEffect, useRef, useState } from "react"
import "../styles/chat.css"

const API = "https://modapink.phand.com.br/bot"

type Session = {
  id: string
  ready: boolean
}

type Message = {
  id: number
  body: string
  fromMe: boolean
}

type Conversation = {
  contact: string
  channel: "VENDAS" | "SAC" | "FINANCEIRO"
  messages: Message[]
}

export default function Conversas() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<string | null>(null)

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null)

  const [input, setInput] = useState("")
  const [filter, setFilter] = useState("ALL")

  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  // ========================
  // AUTO SCROLL (CORRIGIDO)
  // ========================
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [selectedConv?.messages])

  // ========================
  // LOAD SESSIONS
  // ========================
  async function loadSessions() {
    const res = await fetch(`${API}/sessions`, { cache: "no-store" })
    const data = await res.json()

    setSessions(data)

    if (!selectedSession && data.length) {
      setSelectedSession(data[0].id)
    }
  }

  // ========================
  // LOAD CONVERSAS (FIX)
  // ========================
  async function loadConversations() {
    if (!selectedSession) return

    const res = await fetch(`${API}/conversations/${selectedSession}`, {
      cache: "no-store"
    })

    const data = await res.json()

    setConversations(data)

    // 🔥 SINCRONIZA CONVERSA SELECIONADA
    if (selectedConv) {
      const updated = data.find(
        (c: Conversation) => c.contact === selectedConv.contact
      )

      if (updated) {
        setSelectedConv(updated)
      }
    } else if (data.length) {
      setSelectedConv(data[0])
    }
  }

  // ========================
  // POLLING
  // ========================
  useEffect(() => {
    loadSessions()
    loadConversations()

    const interval = setInterval(() => {
      loadSessions()
      loadConversations()
    }, 2000)

    return () => clearInterval(interval)
  }, [selectedSession])

  // ========================
  // ENVIAR
  // ========================
  async function sendMessage() {
    if (!input.trim() || !selectedConv || !selectedSession) return

    const text = input
    setInput("")

    await fetch(`${API}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sessionId: selectedSession,
        contact: selectedConv.contact,
        message: text
      })
    })

    // ❌ NÃO atualiza local manualmente
    // ✔ deixa o polling atualizar corretamente
  }

  // ========================
  // MUDAR CANAL
  // ========================
  async function changeChannel(channel: string) {
    if (!selectedConv || !selectedSession) return

    await fetch(
      `${API}/conversations/${selectedSession}/${selectedConv.contact}/channel`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel })
      }
    )
  }

  const filtered = conversations.filter(c =>
    filter === "ALL" ? true : c.channel === filter
  )

  return (
    <div className="chat-app">

      {/* SIDEBAR */}
      <div className="sidebar">

        <div className="filters">
          {["ALL", "VENDAS", "SAC", "FINANCEIRO"].map(f => (
            <button
              key={f}
              className={filter === f ? "active" : ""}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        {filtered.map(c => (
          <div
            key={c.contact}
            className={`chat-item ${
              selectedConv?.contact === c.contact ? "active" : ""
            }`}
            onClick={() => setSelectedConv(c)}
          >
            <div className="chat-top">
              <strong>{c.contact}</strong>
              <span className={`tag ${c.channel.toLowerCase()}`}>
                {c.channel}
              </span>
            </div>

            <p>{c.messages.at(-1)?.body}</p>
          </div>
        ))}

      </div>

      {/* CHAT */}
      <div className="chat">

        <div className="header">
          <div className="header-left">
            <strong>
              {selectedConv?.contact || "Selecione uma conversa"}
            </strong>

            {selectedConv && (
              <span className={`channel ${selectedConv.channel.toLowerCase()}`}>
                {selectedConv.channel}
              </span>
            )}
          </div>

          <div className="actions">
            {["VENDAS", "SAC", "FINANCEIRO"].map(c => (
              <button key={c} className="chip" onClick={() => changeChannel(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="messages">
          {selectedConv?.messages.map(m => (
            <div
              key={m.id}
              className={`bubble ${m.fromMe ? "me" : "client"}`}
            >
              {m.body}
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>

        <div className="input">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Digite uma mensagem..."
            onKeyDown={e => {
              if (e.key === "Enter") sendMessage()
            }}
          />

          <button onClick={sendMessage}>
            Enviar
          </button>
        </div>

      </div>

    </div>
  )
}