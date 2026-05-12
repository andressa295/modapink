"use client"

import { useEffect, useRef, useState } from "react"

import styles from "../styles/chat.module.css"

import { createBrowserClient } from "@supabase/ssr"

const API =
  process.env.NEXT_PUBLIC_API_URL!

const supabase =
  createBrowserClient(

    process.env
      .NEXT_PUBLIC_SUPABASE_URL!,

    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY!
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

  session_key: string
}

type Message = {

  id: string

  content: string

  sender:
    | "user"
    | "agent"
    | "bot"
}

// ======================
// COMPONENT
// ======================
export default function Conversas() {

  const [

    conversations,

    setConversations

  ] = useState<Conversation[]>([])

  const [

    selected,

    setSelected

  ] = useState<Conversation | null>(null)

  const [

    messages,

    setMessages

  ] = useState<Message[]>([])

  const [

    input,

    setInput

  ] = useState("")

  const [

    sending,

    setSending

  ] = useState(false)

  // ======================
  // ABAS
  // ======================
  const [

    activeTab,

    setActiveTab

  ] = useState("principal")

  const vendedoras = [

    {
      id: "principal",

      nome:
        "🤖 Bot Principal"
    },

    {
      id: "vendedora-1",

      nome:
        "Vendedora 1"
    },

    {
      id: "vendedora-2",

      nome:
        "Vendedora 2"
    },

    {
      id: "vendedora-3",

      nome:
        "Vendedora 3"
    }
  ]

  const messagesRef =
    useRef<HTMLDivElement | null>(null)

  // ======================
  // AUTO SCROLL
  // ======================
  function scrollToBottom() {

    if (!messagesRef.current)
      return

    messagesRef.current.scrollTop =
      messagesRef.current.scrollHeight
  }

  useEffect(() => {

    scrollToBottom()

  }, [messages])

  // ======================
  // LOAD CONVERSAS
  // ======================
  async function loadConversations() {

    try {

      const res =
        await fetch(

          `${API}/conversations?session_key=${activeTab}`,

          {
            cache:
              "no-store",

            headers: {
              Pragma:
                "no-cache"
            }
          }
        )

      const data =
        await res.json()

      const list:
        Conversation[] =

        Array.isArray(data)

          ? data

          : data?.data || []

      setConversations(list)

      // ======================
      // FECHA CHAT
      // ======================
      if (

        selected &&

        selected.session_key !==
          activeTab

      ) {

        setSelected(null)

        setMessages([])
      }

    } catch (err) {

      console.error(
        "❌ erro conversas:",
        err
      )
    }
  }

  // ======================
  // LOAD MSGS
  // ======================
  async function loadMessages(
    id: string
  ) {

    try {

      const res =
        await fetch(

          `${API}/messages?conversation_id=${id}`
        )

      const data =
        await res.json()

      if (
        Array.isArray(data)
      ) {

        setMessages(data)
      }

    } catch (err) {

      console.error(
        "❌ erro mensagens:",
        err
      )
    }
  }

  // ======================
  // REALTIME SIDEBAR
  // ======================
  useEffect(() => {

    loadConversations()

    const channel =
      supabase

        .channel(
          `sidebar-${activeTab}`
        )

        .on(
          "postgres_changes",

          {
            event: "*",

            schema:
              "public",

            table:
              "conversations",

            filter:
              `session_key=eq.${activeTab}`
          },

          () => {

            loadConversations()
          }
        )

        .subscribe()

    return () => {

      supabase.removeChannel(
        channel
      )
    }

  }, [activeTab])

  // ======================
  // REALTIME MESSAGES
  // ======================
  useEffect(() => {

    if (!selected)
      return

    loadMessages(selected.id)

    const channel =
      supabase

        .channel(
          `chat-${selected.id}`
        )

        .on(
          "postgres_changes",

          {
            event:
              "INSERT",

            schema:
              "public",

            table:
              "messages",

            filter:
              `conversation_id=eq.${selected.id}`
          },

          (payload) => {

            const novo =
              payload.new as any

            setMessages((prev) => {

              const exists =
                prev.find(
                  m =>
                    m.id === novo.id
                )

              if (exists) {
                return prev
              }

              return [

                ...prev,

                {
                  id:
                    novo.id,

                  content:
                    novo.content,

                  sender:
                    novo.sender
                }
              ]
            })
          }
        )

        .subscribe()

    return () => {

      supabase.removeChannel(
        channel
      )
    }

  }, [selected?.id])

  // ======================
  // SEND MESSAGE
  // ======================
  async function sendMessage() {

    if (

      !input.trim() ||

      !selected ||

      sending

    ) return

    const text = input

    setInput("")

    setSending(true)

    try {

      const response =
        await fetch(

          `${API}/send-message`,

          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({

                phone:
                  selected.phone,

                message:
                  text,

                session_key:
                  activeTab
              })
          }
        )

      if (!response.ok) {

        throw new Error(
          "Falha ao enviar"
        )
      }

    } catch (err) {

      console.error(
        "❌ erro envio:",
        err
      )

      setInput(text)

    } finally {

      setSending(false)
    }
  }

  return (

    <div
      className={
        styles["chat-app"]
      }
    >

      {/* SIDEBAR */}
      <div
        className={
          styles["chat-sidebar"]
        }
      >

        {/* ABAS */}
        <div
          className={
            styles["vendedoras-tabs"]
          }
        >

          {vendedoras.map((v) => (

            <button

              key={v.id}

              className={`

                ${styles["tab-button"]}

                ${
                  activeTab === v.id

                    ? styles["tab-active"]

                    : ""
                }

              `}

              onClick={() =>
                setActiveTab(v.id)
              }
            >

              {v.nome}

            </button>

          ))}

        </div>

        {/* LIST */}
        <div
          className={
            styles["chat-list"]
          }
        >

          {conversations.length === 0 ? (

            <div
              className={
                styles["chat-empty"]
              }
            >

              Nenhuma conversa

            </div>

          ) : (

            conversations.map((c) => (

              <div

                key={c.id}

                className={`

                  ${styles["chat-item"]}

                  ${
                    selected?.id === c.id

                      ? styles["chat-item-active"]

                      : ""
                  }

                `}

                onClick={() =>
                  setSelected(c)
                }
              >

                <img

                  src={
                    c.avatar_url ||
                    "/placeholder.png"
                  }

                  className={
                    styles["chat-avatar"]
                  }

                  alt="Avatar"

                  onError={(e) => {

                    e.currentTarget.src =
                      "/placeholder.png"
                  }}
                />

                <div
                  className={
                    styles["chat-info"]
                  }
                >

                  <div
                    className={
                      styles["chat-top"]
                    }
                  >

                    <strong
                      className={
                        styles["chat-name"]
                      }
                    >

                      {
                        c.customer_name ||
                        c.phone
                      }

                    </strong>

                    <span
                      className={
                        styles["chat-time"]
                      }
                    >

                      {c.updated_at &&

                        new Date(
                          c.updated_at
                        ).toLocaleTimeString(
                          [],
                          {
                            hour:
                              "2-digit",

                            minute:
                              "2-digit"
                          }
                        )}

                    </span>

                  </div>

                  <p
                    className={
                      styles["chat-preview"]
                    }
                  >

                    {
                      c.last_message ||
                      "Sem mensagens"
                    }

                  </p>

                </div>

              </div>

            ))
          )}

        </div>

      </div>

      {/* CHAT */}
      <div
        className={
          styles.chat
        }
      >

        {selected ? (

          <>

            {/* HEADER */}
            <div
              className={
                styles["chat-header"]
              }
            >

              <img

                src={
                  selected.avatar_url ||
                  "/placeholder.png"
                }

                className={
                  styles["chat-header-avatar"]
                }

                alt="Avatar"

                onError={(e) => {

                  e.currentTarget.src =
                    "/placeholder.png"
                }}
              />

              <div
                className={
                  styles["chat-header-info"]
                }
              >

                <strong
                  className={
                    styles["chat-header-name"]
                  }
                >

                  {
                    selected.customer_name ||
                    selected.phone
                  }

                </strong>

                <span
                  className={
                    styles["chat-header-status"]
                  }
                >

                  {selected.phone}

                </span>

              </div>

            </div>

            {/* MESSAGES */}
            <div

              ref={messagesRef}

              className={
                styles["chat-messages"]
              }

            >

              {messages.map((m) => (

                <div

                  key={m.id}

                  className={`

                    ${styles["chat-bubble"]}

                    ${
                      m.sender === "user"

                        ? styles["chat-bubble-client"]

                        : styles["chat-bubble-me"]
                    }

                  `}
                >

                  {m.content}

                </div>

              ))}

            </div>

            {/* INPUT */}
            <div
              className={
                styles["chat-input"]
              }
            >

              <input

                value={input}

                onChange={(e) =>

                  setInput(
                    e.target.value
                  )
                }

                placeholder="Digite..."

                className={
                  styles["chat-input-field"]
                }

                onKeyDown={(e) => {

                  if (

                    e.key === "Enter" &&

                    !e.shiftKey

                  ) {

                    sendMessage()
                  }
                }}

                disabled={sending}
              />

              <button

                onClick={sendMessage}

                disabled={

                  sending ||

                  !input.trim()
                }

                className={
                  styles["chat-send-button"]
                }
              >

                {sending
                  ? "..."
                  : "Enviar"}

              </button>

            </div>

          </>

        ) : (

          <div
            className={
              styles["chat-empty"]
            }
          >

            <div>

              <h3>
                Selecione uma conversa
              </h3>

              <p>
                Escolha um chat ao lado.
              </p>

            </div>

          </div>

        )}

      </div>

    </div>
  )
}