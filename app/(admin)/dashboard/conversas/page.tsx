"use client"

import { useEffect, useRef, useState } from "react"
import "../styles/chat.css"
import { createBrowserClient } from "@supabase/ssr"

const API = process.env.NEXT_PUBLIC_API_URL!
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Conversation = {
  id: string
  phone: string
  customer_name?: string
  avatar_url?: string
  last_message?: string
  updated_at?: string
  session_id: string 
}

type Message = {
  id: string
  content: string
  sender: "user" | "agent" | "bot"
}

export default function Conversas() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)

  // 🔥 SISTEMA DE ABAS (ID das sessões que você criou no painel de números)
  const [activeTab, setActiveTab] = useState("principal")
  const vendedoras = [
    { id: "principal", nome: "🤖 Bot Principal" },
    { id: "vendedora-1", nome: "Vendedora 1" },
    { id: "vendedora-2", nome: "Vendedora 2" },
    { id: "vendedora-3", nome: "Vendedora 3" },
  ]

  const messagesRef = useRef<HTMLDivElement | null>(null)

  // 🔥 Função para rolar o chat para o fim automaticamente
  const scrollToBottom = () => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }

  // Roda o scroll sempre que a lista de mensagens mudar
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // ======================
  // CARREGA CONVERSAS DA VENDEDORA SELECIONADA
  // ======================
  async function loadConversations() {
    try {
      const res = await fetch(`${API}/conversations?session_id=${activeTab}`, { 
        cache: "no-store",
        headers: { "Pragma": "no-cache" }
      })
      const data = await res.json()
      const list: Conversation[] = Array.isArray(data) ? data : data?.data || []

      setConversations(list)

      // Se mudar de aba e o chat aberto for de outra vendedora, fecha ele
      if (selected && selected.session_id !== activeTab) {
        setSelected(null)
        setMessages([])
      }
    } catch (err) {
      console.error("Erro ao carregar conversas:", err)
    }
  }

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
  // REALTIME: LISTA DE CONVERSAS (Sidebar)
  // ======================
  useEffect(() => {
    loadConversations()

    // Ouve qualquer mudança na tabela de conversas para atualizar o preview da última mensagem
    const channel = supabase
      .channel(`sidebar-realtime-${activeTab}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'conversations',
          filter: `session_id=eq.${activeTab}` 
        },
        () => {
          loadConversations()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeTab])

  // ======================
  // REALTIME: CHAT ABERTO (Mensagens em tempo real)
  // ======================
  useEffect(() => {
    if (!selected) return
    loadMessages(selected.id)

    // Escuta novas mensagens inseridas no banco para este chat específico
    const channel = supabase
      .channel(`chat-realtime-${selected.id}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages', 
          filter: `conversation_id=eq.${selected.id}` 
        },
        (payload) => {
          const novo = payload.new as any
          // Adiciona a nova mensagem ao estado sem precisar de F5
          setMessages((prev) => {
            // Evita duplicados caso a API e o Realtime rodem juntos
            if (prev.find(m => m.id === novo.id)) return prev
            return [...prev, { 
              id: novo.id, 
              content: novo.content, 
              sender: novo.sender 
            }]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selected?.id])

  // ======================
  // ENVIO DE MENSAGEM
  // ======================
  async function sendMessage() {
    if (!input.trim() || !selected || sending) return
    
    const text = input
    setInput("") // Limpa o campo na hora para dar sensação de velocidade
    setSending(true)

    try {
      const response = await fetch(`${API}/send-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: selected.phone,
          message: text,
          sessionId: activeTab // Envia pela vendedora da aba ativa
        })
      })

      if (!response.ok) {
        throw new Error("Falha ao enviar")
      }
    } catch (err) {
      console.error("Erro ao enviar:", err)
      setInput(text) // Devolve o texto ao input se der erro
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="chat-app">
      
      {/* SIDEBAR - LISTA DE CHATS */}
      <div className="sidebar">
        
        {/* SELETOR DE VENDEDORAS (ABAS) */}
        <div className="vendedoras-tabs">
          {vendedoras.map((v) => (
            <button
              key={v.id}
              className={activeTab === v.id ? "active" : ""}
              onClick={() => setActiveTab(v.id)}
            >
              {v.nome}
            </button>
          ))}
        </div>

        <div className="conversations-list">
          {conversations.length === 0 ? (
            <div className="no-chats">Nenhuma conversa nesta vendedora</div>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                className={`chat-item ${selected?.id === c.id ? "active" : ""}`}
                onClick={() => setSelected(c)}
              >
                <img 
                  src={c.avatar_url || "/placeholder.png"} 
                  className="avatar" 
                  alt="Avatar" 
                  onError={(e) => (e.currentTarget.src = "/placeholder.png")}
                />
                <div className="chat-info">
                  <div className="top">
                    {/* Exibe o Nome ou Telefone de forma limpa */}
                    <strong>{c.customer_name || c.phone}</strong>
                    <span className="time">
                      {c.updated_at && new Date(c.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="preview">{c.last_message || "Sem mensagens"}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* CHAT CONTAINER - MENSAGENS */}
      <div className="chat">
        {selected ? (
          <>
            <div className="header">
              <img 
                src={selected.avatar_url || "/placeholder.png"} 
                className="avatar-header" 
                alt="Avatar" 
                onError={(e) => (e.currentTarget.src = "/placeholder.png")}
              />
              <div>
                <strong>{selected.customer_name || selected.phone}</strong>
                <span>{selected.phone}</span>
              </div>
            </div>

            <div className="messages" ref={messagesRef}>
              {messages.map((m) => (
                <div key={m.id} className={`bubble ${m.sender === "user" ? "client" : "me"}`}>
                  {m.content}
                </div>
              ))}
            </div>

            <div className="input">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Digite sua mensagem..."
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                disabled={sending}
              />
              <button 
                onClick={sendMessage} 
                disabled={sending || !input.trim()}
              >
                {sending ? "..." : "Enviar"}
              </button>
            </div>
          </>
        ) : (
          <div className="no-chat">
            <div className="empty-state">
              <h3>Selecione uma conversa</h3>
              <p>Escolha um cliente ao lado para monitorar as mensagens em tempo real.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}