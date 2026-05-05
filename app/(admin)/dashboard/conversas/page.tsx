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
    try {
      const res = await fetch(`${API}/conversations`, { cache: "no-store" })
      const data = await res.json()

      const list: Conversation[] = Array.isArray(data)
        ? data
        : data?.data || []

      // Ordena para garantir que a última mensagem atualizada fique no topo
      list.sort(
        (a, b) =>
          new Date(b.updated_at || "").getTime() -
          new Date(a.updated_at || "").getTime()
      )

      setConversations(list)

      // Seleciona a primeira automaticamente ao carregar, se não tiver nenhuma selecionada
      setConversations((currentList) => {
        if (currentList.length > 0 && !selected) {
          setSelected(currentList[0]);
        }
        return currentList;
      });

    } catch (err) {
      console.error("Erro ao carregar conversas:", err)
    }
  }

  // ======================
  // LOAD MESSAGES
  // ======================
  async function loadMessages(id: string) {
    try {
      const res = await fetch(`${API}/messages?conversation_id=${id}`)
      const data = await res.json()

      if (Array.isArray(data)) {
        setMessages(data)
      }
    } catch (err) {
      console.error("Erro ao carregar mensagens:", err)
    }
  }

  // ======================
  // INIT E REALTIME DA LISTA GERAL
  // ======================
  useEffect(() => {
    // 1. Carrega a lista a primeira vez que a tela abre
    loadConversations()

    // 2. 🔥 O PULO DO GATO: O "Espião" da tabela de conversas
    // Isso garante que se mudar foto, nome, ou o last_message, a lista atualiza na hora!
    const channelConversations = supabase
      .channel('lista-de-conversas')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        (payload) => {
  // 🔥 Dizemos ao TypeScript para aceitar os dados que vieram do banco
  const novoDado = payload.new as any; 
  
  console.log("🔄 Conversa atualizada/criada no banco!", novoDado);
  
  loadConversations();
  
  setSelected((prevSelected) => {
    // 🔥 Agora usamos "novoDado.id"
    if (prevSelected && prevSelected.id === novoDado.id) {
      return { ...prevSelected, ...novoDado } as Conversation;
    }
    return prevSelected;
  });
}
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channelConversations)
    }
  }, []) // Roda só uma vez ao montar a tela

  // ======================
  // REALTIME DO CHAT ABERTO (MENSAGENS)
  // ======================
  useEffect(() => {
    if (!selected) return

    // Carrega o histórico da conversa que foi clicada
    loadMessages(selected.id)

    // 3. O "Espião" das mensagens da conversa específica
    const channelMessages = supabase
      .channel(`mensagens-${selected.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selected.id}`
        },
        (payload) => {
          console.log("📩 Nova mensagem chegou!", payload.new);
          const newMessage: Message = {
            id: payload.new.id,
            content: payload.new.content,
            sender: payload.new.sender
          }

          setMessages((prev) => [...prev, newMessage])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channelMessages)
    }
  }, [selected?.id]) // Recria o espião toda vez que clicar em outro contato

  // ======================
  // SCROLL AUTOMÁTICO
  // ======================
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
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
              alt="Avatar"
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
                alt="Avatar"
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