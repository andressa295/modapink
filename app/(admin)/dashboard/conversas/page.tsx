"use client"

import { useEffect, useRef, useState } from "react"

import styles from "../styles/chat.module.css"

import { createBrowserClient } from "@supabase/ssr"

const API =
  process.env.NEXT_PUBLIC_API_URL!

const supabase =
  createBrowserClient(
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

  session_key: string
}

type Message = {
  id: string

  text?: string

  content?: string

  sender:
    | "user"
    | "agent"
    | "bot"

  media_url?: string
  mediaUrl?: string

  media_type?: string
  mediaType?: string

  mimetype?: string
  mime_type?: string

  filename?: string
  file_name?: string

  caption?: string

  created_at?: string
}

// ======================
// HELPERS
// ======================

function detectMediaType(
  url: string,
  mime: string
) {
  const value =
    `${url} ${mime}`.toLowerCase()

  if (
    value.includes("image") ||
    value.match(/\.(jpg|jpeg|png|webp|gif)$/)
  ) {
    return "image"
  }

  if (
    value.includes("audio") ||
    value.match(/\.(mp3|ogg|wav|m4a|aac|opus)$/)
  ) {
    return "audio"
  }

  if (
    value.includes("video") ||
    value.match(/\.(mp4|webm|mov)$/)
  ) {
    return "video"
  }

  if (url) {
    return "document"
  }

  return "text"
}

function normalizeMessage(
  m: any
): Message {
  const mediaUrl =
    m.media_url ||
    m.mediaUrl ||
    m.file_url ||
    m.url ||
    m.media?.url ||
    ""

  const mime =
    m.mimetype ||
    m.mime_type ||
    m.media?.mimetype ||
    ""

  return {
    ...m,

    text:
      m.text ||
      m.content ||
      m.caption ||
      "",

    media_url:
      mediaUrl,

    media_type:
      m.media_type ||
      m.mediaType ||
      m.type ||
      m.media?.type ||
      detectMediaType(
        mediaUrl,
        mime
      ),

    mimetype:
      mime,

    filename:
      m.filename ||
      m.file_name ||
      m.media?.filename ||
      "arquivo"
  }
}

function formatPreview(
  c: Conversation
) {
  const preview =
    c.last_message ||
    "Sem mensagens"

  const value =
    preview.toLowerCase()

  if (
    value.includes("[image]") ||
    value.includes("image") ||
    value.includes("imagem")
  ) {
    return "📷 Imagem"
  }

  if (
    value.includes("[audio]") ||
    value.includes("audio") ||
    value.includes("áudio")
  ) {
    return "🎙️ Áudio"
  }

  if (
    value.includes("[video]") ||
    value.includes("video") ||
    value.includes("vídeo")
  ) {
    return "🎥 Vídeo"
  }

  if (
    value.includes("[document]") ||
    value.includes("document") ||
    value.includes("arquivo")
  ) {
    return "📎 Arquivo"
  }

  return preview
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
      nome: "🤖 Bot Principal"
    },
    {
      id: "vendedora-1",
      nome: "Vendedora 1"
    },
    {
      id: "vendedora-2",
      nome: "Vendedora 2"
    },
    {
      id: "vendedora-3",
      nome: "Vendedora 3"
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
            cache: "no-store",
            headers: {
              Pragma: "no-cache"
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
          `${API}/messages?conversation_id=${id}`,
          {
            cache: "no-store",
            headers: {
              Pragma: "no-cache"
            }
          }
        )

      const data =
        await res.json()

      if (
        Array.isArray(data)
      ) {
        const formatted =
          data.map((m) =>
            normalizeMessage(m)
          )

        setMessages(formatted)
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
            schema: "public",
            table: "conversations",
            filter: `session_key=eq.${activeTab}`
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
  // REALTIME STATUS
  // ======================

  useEffect(() => {
    const statusChannel =
      supabase
        .channel(
          `status-${activeTab}`
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "whatsapp_sessions",
            filter: `session_key=eq.${activeTab}`
          },
          (payload) => {
            const novoStatus =
              (payload.new as any).status

            if (
              novoStatus === "disconnected"
            ) {
              console.log(
                "🚨 WhatsApp desconectado! Limpando a tela..."
              )

              setSelected(null)
              setMessages([])
              setConversations([])
            }
          }
        )
        .subscribe()

    return () => {
      supabase.removeChannel(
        statusChannel
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
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${selected.id}`
          },
          (payload) => {
            const novo =
              normalizeMessage(payload.new)

            setMessages((prev) => {
              const exists =
                prev.find(
                  (m) =>
                    m.id === novo.id
                )

              if (exists) {
                return prev
              }

              return [
                ...prev,
                novo
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

    const textToSend =
      input.trim()

    setInput("")
    setSending(true)

    try {
      const response =
        await fetch(
          `${API}/send-message`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body:
              JSON.stringify({
                phone:
                  selected.phone,

                message:
                  textToSend,

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

      setInput(textToSend)
    } finally {
      setSending(false)
    }
  }

  // ======================
  // RENDER CONTENT
  // ======================

  function renderMessageContent(
    m: Message
  ) {
    const mediaUrl =
      m.media_url ||
      m.mediaUrl ||
      ""

    const mediaType =
      m.media_type ||
      m.mediaType ||
      "text"

    const text =
      m.text ||
      m.content ||
      ""

    if (
      mediaUrl &&
      mediaType === "image"
    ) {
      return (
        <div
          className={
            styles["message-media-wrap"]
          }
        >
          <img
            src={mediaUrl}
            alt={text || "Imagem"}
            className={
              styles["message-image"]
            }
          />

          {text && (
            <p
              className={
                styles["message-caption"]
              }
            >
              {text}
            </p>
          )}
        </div>
      )
    }

    if (
      mediaUrl &&
      mediaType === "audio"
    ) {
      return (
        <div
          className={
            styles["message-audio-wrap"]
          }
        >
          <div
            className={
              styles["audio-avatar"]
            }
          >
            🎙️
          </div>

          <audio
            controls
            src={mediaUrl}
            className={
              styles["message-audio"]
            }
          />

          {text && (
            <p
              className={
                styles["message-caption"]
              }
            >
              {text}
            </p>
          )}
        </div>
      )
    }

    if (
      mediaUrl &&
      mediaType === "video"
    ) {
      return (
        <div
          className={
            styles["message-media-wrap"]
          }
        >
          <video
            controls
            src={mediaUrl}
            className={
              styles["message-video"]
            }
          />

          {text && (
            <p
              className={
                styles["message-caption"]
              }
            >
              {text}
            </p>
          )}
        </div>
      )
    }

    if (
      mediaUrl &&
      mediaType === "document"
    ) {
      return (
        <a
          href={mediaUrl}
          target="_blank"
          rel="noreferrer"
          className={
            styles["message-document"]
          }
        >
          <span
            className={
              styles["document-icon"]
            }
          >
            📎
          </span>

          <span
            className={
              styles["document-name"]
            }
          >
            {m.filename ||
              m.file_name ||
              "Abrir arquivo"}
          </span>
        </a>
      )
    }

    return (
      <span
        className={
          styles["message-text"]
        }
      >
        {text}
      </span>
    )
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
              onClick={() => {
                if (
                  activeTab !== v.id
                ) {
                  setActiveTab(v.id)
                  setSelected(null)
                  setMessages([])
                }
              }}
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
                      {c.customer_name ||
                        c.phone}
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
                            hour: "2-digit",
                            minute: "2-digit"
                          }
                        )}
                    </span>
                  </div>

                  <p
                    className={
                      styles["chat-preview"]
                    }
                  >
                    {formatPreview(c)}
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
                  {selected.customer_name ||
                    selected.phone}
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
                  {renderMessageContent(m)}
                </div>
              ))}
            </div>

            {/* INPUT */}
            <div
              className={
                styles["chat-input"]
              }
            >
              <textarea
                value={input}
                onChange={(e) =>
                  setInput(
                    e.target.value
                  )
                }
                placeholder="Digite uma mensagem"
                className={
                  styles["chat-input-field"]
                }
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey
                  ) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                disabled={sending}
                rows={1}
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