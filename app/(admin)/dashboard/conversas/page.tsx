"use client"

import { useEffect, useMemo, useRef, useState } from "react"

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

type TabId =
  | "all"
  | "principal"
  | "vendedora_1"
  | "sac"

type Conversation = {
  id: string
  phone: string
  customer_name?: string | null
  avatar_url?: string | null
  last_message?: string | null
  updated_at?: string | null
  last_message_at?: string | null
  session_key?: string | null
  session_id?: string | null
  mode?: string | null
  state?: string | null
  status?: string | null
  memory?: Record<string, any> | null
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
  is_temp?: boolean
  mode?: string | null
  state?: string | null
  intent?: string | null
  flow?: string | null
  step?: string | null
}

type ChatTab = {
  id: TabId
  nome: string
  short: string
}

// ======================
// ABAS
// ======================

const chatTabs: ChatTab[] = [
  {
    id: "all",
    nome: "Todos",
    short: "Todos"
  },
  {
    id: "principal",
    nome: "Número principal",
    short: "Principal"
  },
  {
    id: "vendedora_1",
    nome: "Vendedora 1",
    short: "Vendedora"
  },
  {
    id: "sac",
    nome: "SAC",
    short: "SAC"
  }
]

// ======================
// HELPERS
// ======================

function normalizeSessionId(
  value?: string | null
): TabId | string {
  const clean =
    String(value || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9_-]/g, "")

  if (!clean) {
    return "principal"
  }

  if (
    clean === "vendedora-1" ||
    clean === "vendedora1"
  ) {
    return "vendedora_1"
  }

  if (
    clean.startsWith("sac")
  ) {
    return "sac"
  }

  return clean
}

function getSessionLabel(
  value?: string | null
) {
  const id =
    normalizeSessionId(value)

  return (
    chatTabs.find(
      tab => tab.id === id
    )?.nome || id
  )
}

function getConversationSession(
  conversation: Conversation
) {
  return normalizeSessionId(
    conversation.session_key ||
      conversation.session_id ||
      "principal"
  )
}

function normalizeText(
  value?: string | null
) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function parseMemory(
  value: any
): Record<string, any> {
  if (!value) {
    return {}
  }

  if (
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value
  }

  if (
    typeof value === "string"
  ) {
    try {
      const parsed =
        JSON.parse(value)

      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        return parsed
      }
    } catch {
      return {}
    }
  }

  return {}
}

function isHumanInterventionConversation(
  conversation?: Conversation | null
) {
  if (!conversation) {
    return false
  }

  const memory =
    parseMemory(conversation.memory)

  const mode =
    String(conversation.mode || "")
      .toUpperCase()

  const state =
    String(conversation.state || "")
      .toUpperCase()

  const lastMessage =
    normalizeText(
      conversation.last_message || ""
    )

  return Boolean(
    mode === "HUMAN" ||
      state === "HUMAN" ||
      memory.bot_paused === true ||
      memory.human_requested === true ||
      memory.human_support_requested === true ||
      memory.human_intervention === true ||
      lastMessage.includes("intervencao humana solicitada") ||
      lastMessage.includes("intervenção humana solicitada") ||
      lastMessage.includes("bot foi pausado")
  )
}

function isHumanInterventionMessage(
  message?: Message | null
) {
  if (!message) {
    return false
  }

  const text =
    normalizeText(
      message.text ||
        message.content ||
        ""
    )

  return Boolean(
    message.intent === "HUMAN_SUPPORT" ||
      message.mode === "HUMAN" ||
      message.state === "HUMAN" ||
      text.includes("intervencao humana solicitada") ||
      text.includes("intervenção humana solicitada") ||
      text.includes("bot foi pausado") ||
      text.includes("atendimento humano solicitado")
  )
}

function formatPhone(
  phone?: string | null
) {
  if (!phone) {
    return "Sem número"
  }

  const raw =
    String(phone)
      .trim()

  if (
    raw.includes("@lid")
  ) {
    return "Contato WhatsApp"
  }

  const value =
    raw
      .replace("@c.us", "")
      .replace("@lid", "")
      .replace(/\D/g, "")

  if (
    value.startsWith("55") &&
    value.length >= 12
  ) {
    const ddd =
      value.slice(2, 4)

    const part1 =
      value.length === 13
        ? value.slice(4, 9)
        : value.slice(4, 8)

    const part2 =
      value.length === 13
        ? value.slice(9)
        : value.slice(8)

    return `+55 (${ddd}) ${part1}-${part2}`
  }

  if (
    value.length >= 10 &&
    value.length <= 11
  ) {
    const ddd =
      value.slice(0, 2)

    const part1 =
      value.length === 11
        ? value.slice(2, 7)
        : value.slice(2, 6)

    const part2 =
      value.length === 11
        ? value.slice(7)
        : value.slice(6)

    return `(${ddd}) ${part1}-${part2}`
  }

  return raw
    .replace("@c.us", "")
    .replace("@lid", "")
}

function isSystemContactValue(
  value?: string | null
) {
  const clean =
    String(value || "")
      .trim()
      .toLowerCase()

  if (!clean) {
    return true
  }

  return (
    clean.includes("@lid") ||
    clean.includes("@c.us") ||
    clean.includes("@g.us") ||
    clean.includes("status@broadcast") ||
    clean === "cliente" ||
    clean === "sem nome"
  )
}

function getDisplayName(
  conversation?: Conversation | null
) {
  if (!conversation) {
    return ""
  }

  const name =
    String(conversation.customer_name || "")
      .trim()

  if (
    name &&
    !isSystemContactValue(name)
  ) {
    return name
  }

  const phone =
    String(conversation.phone || "")
      .trim()

  if (
    phone.includes("@lid")
  ) {
    return "Cliente WhatsApp"
  }

  const formattedPhone =
    formatPhone(phone)

  if (
    formattedPhone &&
    !isSystemContactValue(formattedPhone)
  ) {
    return formattedPhone
  }

  return "Cliente WhatsApp"
}

function formatTime(
  value?: string | null
) {
  if (!value) {
    return ""
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(date.getTime())
  ) {
    return ""
  }

  const now =
    new Date()

  const isToday =
    date.toDateString() === now.toDateString()

  const yesterday =
    new Date()

  yesterday.setDate(
    now.getDate() - 1
  )

  const isYesterday =
    date.toDateString() === yesterday.toDateString()

  if (isToday) {
    return date.toLocaleTimeString(
      "pt-BR",
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    )
  }

  if (isYesterday) {
    return "ontem"
  }

  return date.toLocaleDateString(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit"
    }
  )
}

function formatMessageTime(
  value?: string | null
) {
  if (!value) {
    return ""
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(date.getTime())
  ) {
    return ""
  }

  return date.toLocaleTimeString(
    "pt-BR",
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  )
}

function truncate(
  value: string,
  max = 72
) {
  if (
    value.length <= max
  ) {
    return value
  }

  return `${value.slice(0, max).trim()}...`
}

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

function normalizeConversation(
  c: any
): Conversation {
  const session =
    normalizeSessionId(
      c.session_key ||
        c.session_id ||
        "principal"
    )

  return {
    ...c,
    phone:
      c.phone || "",
    customer_name:
      isSystemContactValue(
        c.customer_name ||
          c.name ||
          ""
      )
        ? null
        : c.customer_name ||
          c.name ||
          null,
    avatar_url:
      c.avatar_url ||
      c.avatar ||
      c.profile_pic ||
      null,
    last_message:
      c.last_message ||
      c.lastMessage ||
      "",
    updated_at:
      c.last_message_at ||
      c.updated_at ||
      c.created_at ||
      null,
    last_message_at:
      c.last_message_at ||
      c.updated_at ||
      c.created_at ||
      null,
    session_key:
      String(session),
    session_id:
      String(session),
    mode:
      c.mode || null,
    state:
      c.state || null,
    status:
      c.status || null,
    memory:
      parseMemory(c.memory)
  }
}

function normalizeConversations(
  data: any[],
  activeTab: TabId
) {
  const list =
    data
      .map(normalizeConversation)
      .filter(conversation => {
        if (activeTab === "all") {
          return true
        }

        return (
          getConversationSession(conversation) === activeTab
        )
      })

  const unique =
    new Map<string, Conversation>()

  list.forEach(conversation => {
    const key =
      `${getConversationSession(conversation)}:${conversation.phone || conversation.id}`

    const existing =
      unique.get(key)

    if (!existing) {
      unique.set(key, conversation)
      return
    }

    const currentDate =
      new Date(
        conversation.last_message_at ||
          conversation.updated_at ||
          0
      ).getTime()

    const existingDate =
      new Date(
        existing.last_message_at ||
          existing.updated_at ||
          0
      ).getTime()

    if (
      currentDate >= existingDate
    ) {
      unique.set(key, conversation)
    }
  })

  return Array
    .from(unique.values())
    .sort((a, b) => {
      const dateA =
        new Date(
          a.last_message_at ||
            a.updated_at ||
            0
        ).getTime()

      const dateB =
        new Date(
          b.last_message_at ||
            b.updated_at ||
            0
        ).getTime()

      return dateB - dateA
    })
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
    isHumanInterventionConversation(c) &&
    (
      value.includes("intervenção humana") ||
      value.includes("intervencao humana") ||
      value.includes("bot foi pausado")
    )
  ) {
    return "🚨 Intervenção humana solicitada"
  }

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

  return truncate(preview)
}

function getConversationUrl(
  activeTab: TabId
) {
  if (activeTab === "all") {
    return `${API}/conversations`
  }

  return `${API}/conversations?session_key=${encodeURIComponent(activeTab)}`
}

// ======================
// AVATAR
// ======================

function Avatar({
  src,
  name,
  size = "md"
}: {
  src?: string | null
  name?: string | null
  size?: "sm" | "md" | "lg"
}) {
  const [failed, setFailed] =
    useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  if (
    src &&
    !failed
  ) {
    return (
      <img
        src={src}
        className={`
          ${styles.avatar}
          ${styles[`avatar-${size}`]}
        `}
        alt={name || "Avatar"}
        onError={() =>
          setFailed(true)
        }
      />
    )
  }

  return (
    <div
      className={`
        ${styles.avatar}
        ${styles["avatar-fallback"]}
        ${styles[`avatar-${size}`]}
      `}
      title={name || "Usuário"}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M12 12c2.76 0 5-2.46 5-5.5S14.76 1 12 1 7 3.46 7 6.5 9.24 12 12 12Zm0 2c-4.42 0-8 2.24-8 5v1.5c0 .83.67 1.5 1.5 1.5h13c.83 0 1.5-.67 1.5-1.5V19c0-2.76-3.58-5-8-5Z" />
      </svg>
    </div>
  )
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

  const [
    resolvingHuman,
    setResolvingHuman
  ] = useState(false)

  const [
    loadingConversations,
    setLoadingConversations
  ] = useState(false)

  const [
    activeTab,
    setActiveTab
  ] = useState<TabId>("all")

  const messagesRef =
    useRef<HTMLDivElement | null>(null)

  const selectedRef =
    useRef<Conversation | null>(null)

  const activeTabRef =
    useRef<TabId>("all")

  const loadingMessagesRef =
    useRef(false)

  const lastMessagesRequestRef =
    useRef(0)

  useEffect(() => {
    selectedRef.current =
      selected
  }, [selected])

  useEffect(() => {
    activeTabRef.current =
      activeTab
  }, [activeTab])

  useEffect(() => {
    if (!selected?.id) {
      return
    }

    selectedRef.current =
      selected

    loadMessages(
      selected.id,
      {
        silent:
          true
      }
    )
  }, [
    selected?.id,
    selected?.last_message,
    selected?.last_message_at,
    selected?.updated_at
  ])

  // ======================
  // AUTO SCROLL
  // ======================

  function scrollToBottom() {
    if (!messagesRef.current) {
      return
    }

    messagesRef.current.scrollTop =
      messagesRef.current.scrollHeight
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // ======================
  // LOAD CONVERSAS
  // Também sincroniza o chat aberto quando a última mensagem muda.
  // ======================

  async function loadConversations(
    options: {
      silent?: boolean
    } = {}
  ) {
    try {
      if (!options.silent) {
        setLoadingConversations(true)
      }

      const currentTab =
        activeTabRef.current

      const res =
        await fetch(
          `${getConversationUrl(currentTab)}${getConversationUrl(currentTab).includes("?") ? "&" : "?"}_=${Date.now()}`,
          {
            cache: "no-store",
            headers: {
              Pragma: "no-cache",
              "Cache-Control": "no-cache"
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

      const normalized =
        normalizeConversations(
          list,
          currentTab
        )

      setConversations(normalized)

      const currentSelected =
        selectedRef.current

      if (currentSelected) {
        const currentSession =
          getConversationSession(
            currentSelected
          )

        const refreshedSelected =
          normalized.find(
            item => item.id === currentSelected.id
          ) ||
          normalized.find(
            item =>
              item.phone === currentSelected.phone &&
              getConversationSession(item) === currentSession
          )

        if (refreshedSelected) {
          const changed =
            refreshedSelected.last_message_at !== currentSelected.last_message_at ||
            refreshedSelected.updated_at !== currentSelected.updated_at ||
            refreshedSelected.last_message !== currentSelected.last_message ||
            refreshedSelected.mode !== currentSelected.mode ||
            refreshedSelected.state !== currentSelected.state

          selectedRef.current =
            refreshedSelected

          setSelected(refreshedSelected)

          if (changed) {
            loadMessages(
              refreshedSelected.id,
              {
                silent:
                  true
              }
            )
          }

        } else {
          selectedRef.current =
            null

          setSelected(null)
          setMessages([])
        }
      }

    } catch (err) {
      console.error(
        "❌ erro conversas:",
        err
      )
    } finally {
      if (!options.silent) {
        setLoadingConversations(false)
      }
    }
  }

  // ======================
  // LOAD MSGS
  // Fonte do miolo do chat.
  // Busca sempre /messages e atualiza sem depender do realtime.
  // ======================

  async function loadMessages(
    id: string,
    options: {
      silent?: boolean
    } = {}
  ) {
    if (!id) {
      return
    }

    if (loadingMessagesRef.current) {
      return
    }

    const requestId =
      Date.now()

    lastMessagesRequestRef.current =
      requestId

    loadingMessagesRef.current =
      true

    try {
      const res =
        await fetch(
          `${API}/messages?conversation_id=${encodeURIComponent(id)}&_=${requestId}`,
          {
            cache: "no-store",
            headers: {
              Pragma: "no-cache",
              "Cache-Control": "no-cache"
            }
          }
        )

      if (!res.ok) {
        throw new Error(
          `Falha ao carregar mensagens: ${res.status}`
        )
      }

      const data =
        await res.json()

      const list =
        Array.isArray(data)
          ? data
          : data?.data || []

      const formatted =
        list
          .map((m: any) =>
            normalizeMessage(m)
          )
          .filter((m: Message) =>
            Boolean(
              m.id &&
                (
                  m.text ||
                  m.content ||
                  m.media_url ||
                  m.mediaUrl ||
                  m.media_type ||
                  m.mediaType
                )
            )
          )
          .sort((a: Message, b: Message) =>
            new Date(a.created_at || 0).getTime() -
            new Date(b.created_at || 0).getTime()
          )

      if (
        lastMessagesRequestRef.current !== requestId
      ) {
        return
      }

      const currentSelected =
        selectedRef.current

      if (
        !currentSelected ||
        currentSelected.id !== id
      ) {
        return
      }

      setMessages(prev => {
        const tempMessages =
          prev.filter(
            item => item.is_temp
          )

        if (!tempMessages.length) {
          return formatted
        }

        const existingIds =
          new Set(
            formatted.map(
              item => item.id
            )
          )

        const pendingTemps =
          tempMessages.filter(
            item => !existingIds.has(item.id)
          )

        return [
          ...formatted,
          ...pendingTemps
        ]
      })

    } catch (err) {
      if (!options.silent) {
        console.error(
          "❌ erro mensagens:",
          err
        )
      }
    } finally {
      loadingMessagesRef.current =
        false
    }
  }

  // ======================
  // REALTIME + POLLING SIDEBAR
  // ======================

  useEffect(() => {
    activeTabRef.current =
      activeTab

    loadConversations()

    const polling =
      setInterval(() => {
        loadConversations({
          silent:
            true
        })
      }, 3000)

    const filterConfig: any = {
      event: "*",
      schema: "public",
      table: "conversations"
    }

    if (
      activeTab !== "all"
    ) {
      filterConfig.filter =
        `session_key=eq.${activeTab}`
    }

    const conversationsChannel =
      supabase
        .channel(
          `sidebar-conversations-${activeTab}`
        )
        .on(
          "postgres_changes",
          filterConfig,
          () => {
            loadConversations({
              silent:
                true
            })
          }
        )
        .subscribe()

    const messagesChannel =
      supabase
        .channel(
          `sidebar-messages-${activeTab}`
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "messages"
          },
          () => {
            loadConversations({
              silent:
                true
            })
          }
        )
        .subscribe()

    return () => {
      clearInterval(polling)
      supabase.removeChannel(conversationsChannel)
      supabase.removeChannel(messagesChannel)
    }
  }, [activeTab])

  // ======================
  // REALTIME STATUS
  // ======================

  useEffect(() => {
    if (
      activeTab === "all"
    ) {
      return
    }

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
  // REALTIME + POLLING MESSAGES
  // ======================

  useEffect(() => {
    if (!selected) {
      return
    }

    selectedRef.current =
      selected

    loadMessages(selected.id)

    const polling =
      setInterval(() => {
        const currentSelected =
          selectedRef.current

        if (
          currentSelected?.id
        ) {
          loadMessages(
            currentSelected.id,
            {
              silent:
                true
            }
          )

          loadConversations({
            silent:
              true
          })
        }
      }, 1000)

    const channel =
      supabase
        .channel(
          `chat-messages-${selected.id}`
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${selected.id}`
          },
          () => {
            const currentSelected =
              selectedRef.current

            if (
              currentSelected?.id
            ) {
              loadMessages(
                currentSelected.id,
                {
                  silent:
                    true
                }
              )

              loadConversations({
                silent:
                  true
              })
            }
          }
        )
        .subscribe()

    return () => {
      clearInterval(polling)
      supabase.removeChannel(
        channel
      )
    }
  }, [selected?.id])

  // ======================
  // FORCE REFRESH WHEN WINDOW FOCUS
  // ======================

  useEffect(() => {
    function refreshCurrentChat() {
      const currentSelected =
        selectedRef.current

      if (currentSelected?.id) {
        loadMessages(
          currentSelected.id,
          {
            silent:
              true
          }
        )
      }

      loadConversations({
        silent:
          true
      })
    }

    function handleVisibilityChange() {
      if (!document.hidden) {
        refreshCurrentChat()
      }
    }

    window.addEventListener(
      "focus",
      refreshCurrentChat
    )

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    )

    return () => {
      window.removeEventListener(
        "focus",
        refreshCurrentChat
      )

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      )
    }
  }, [])

  // ======================
  // RESOLVE HUMAN INTERVENTION
  // ======================

  async function resolveHumanIntervention() {
    const currentSelected =
      selectedRef.current

    if (
      !currentSelected ||
      resolvingHuman
    ) {
      return
    }

    const ok =
      window.confirm(
        "Resolver essa intervenção e voltar o bot para essa conversa?"
      )

    if (!ok) {
      return
    }

    setResolvingHuman(true)

    try {
      const response =
        await fetch(
          `${API}/conversations/${currentSelected.id}/resolve-human`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              "Cache-Control":
                "no-cache"
            },
            body:
              JSON.stringify({
                resolved_by:
                  "dashboard"
              })
          }
        )

      const result =
        await response.json()
          .catch(() => null)

      if (
        !response.ok ||
        !result?.ok
      ) {
        throw new Error(
          result?.error ||
          "Falha ao resolver intervenção humana"
        )
      }

      if (result?.conversation?.id) {
        const updated =
          normalizeConversation(
            result.conversation
          )

        selectedRef.current =
          updated

        setSelected(updated)

        setConversations(prev =>
          prev.map(item =>
            item.id === updated.id
              ? updated
              : item
          )
        )
      }

      await loadMessages(
        currentSelected.id,
        {
          silent:
            true
        }
      )

      await loadConversations({
        silent:
          true
      })

      window.setTimeout(() => {
        loadMessages(
          currentSelected.id,
          {
            silent:
              true
          }
        )

        loadConversations({
          silent:
            true
        })
      }, 900)

    } catch (err) {
      console.error(
        "❌ erro resolver intervenção humana:",
        err
      )

      window.alert(
        "Não consegui resolver a intervenção. Tenta novamente."
      )

    } finally {
      setResolvingHuman(false)
    }
  }

  // ======================
  // SEND MESSAGE
  // ======================

  async function sendMessage() {
    if (
      !input.trim() ||
      !selected ||
      sending
    ) {
      return
    }

    const textToSend =
      input.trim()

    const selectedSession =
      String(
        getConversationSession(selected)
      )

    const tempMessage: Message = {
      id:
        `temp-${Date.now()}`,
      text:
        textToSend,
      sender:
        "agent",
      created_at:
        new Date().toISOString(),
      is_temp:
        true
    }

    setInput("")
    setSending(true)
    setMessages(prev => [
      ...prev,
      tempMessage
    ])

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

                text:
                  textToSend,

                session_key:
                  selectedSession,

                sessionId:
                  selectedSession,

                session_id:
                  selectedSession
              })
          }
        )

      if (!response.ok) {
        throw new Error(
          "Falha ao enviar"
        )
      }

      await loadMessages(
        selected.id,
        {
          silent:
            true
        }
      )

      await loadConversations({
        silent:
          true
      })

    } catch (err) {
      console.error(
        "❌ erro envio:",
        err
      )

      setInput(textToSend)

      setMessages(prev =>
        prev.filter(
          message =>
            message.id !== tempMessage.id
        )
      )
    } finally {
      setSending(false)
    }
  }

  // ======================
  // RENDER TEXT
  // ======================

  function renderText(
    value?: string
  ) {
    const lines =
      String(value || "")
        .split("\n")

    return lines.map(
      (line, index) => (
        <span key={`${line}-${index}`}>
          {line}
          {index < lines.length - 1 && <br />}
        </span>
      )
    )
  }

  // ======================
  // RENDER CONTENT
  // ======================

  function renderMessageContent(
    m: Message
  ) {
    if (isHumanInterventionMessage(m)) {
      const text =
        m.text ||
        m.content ||
        "Intervenção humana solicitada"

      return (
        <div
          className={
            styles["human-message-content"]
          }
        >
          {renderText(text)}
        </div>
      )
    }

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
              {renderText(text)}
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
              {renderText(text)}
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
              {renderText(text)}
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
        {renderText(text)}
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
        <div
          className={
            styles["sidebar-header"]
          }
        >
          <div>
            <h2>
              Conversas
            </h2>

            <p>
              Atendimento por número
            </p>
          </div>
        </div>

        {/* ABAS */}
        <div
          className={
            styles["vendedoras-tabs"]
          }
        >
          {chatTabs.map((tab) => (
            <button
              key={tab.id}
              className={`
                ${styles["tab-button"]}
                ${
                  activeTab === tab.id
                    ? styles["tab-active"]
                    : ""
                }
              `}
              onClick={() => {
                if (
                  activeTab !== tab.id
                ) {
                  setActiveTab(tab.id)
                  setSelected(null)
                  setMessages([])
                }
              }}
              type="button"
            >
              <span>
                {tab.short}
              </span>

              <small>
                {activeTab === tab.id
                  ? conversations.length
                  : ""}
              </small>
            </button>
          ))}
        </div>

        {/* LIST */}
        <div
          className={
            styles["chat-list"]
          }
        >
          {loadingConversations ? (
            <div
              className={
                styles["chat-empty"]
              }
            >
              Carregando conversas...
            </div>
          ) : conversations.length === 0 ? (
            <div
              className={
                styles["chat-empty"]
              }
            >
              Nenhuma conversa
            </div>
          ) : (
            conversations.map((c) => {
              const session =
                getConversationSession(c)

              const needsHuman =
                isHumanInterventionConversation(c)

              return (
                <button
                  key={c.id}
                  type="button"
                  className={`
                    ${styles["chat-item"]}
                    ${
                      selected?.id === c.id
                        ? styles["chat-item-active"]
                        : ""
                    }
                    ${
                      needsHuman
                        ? styles["chat-item-human"]
                        : ""
                    }
                  `}
                  onClick={() =>
                    setSelected(c)
                  }
                >
                  <Avatar
                    src={c.avatar_url}
                    name={getDisplayName(c)}
                    size="md"
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
                        {getDisplayName(c)}
                      </strong>

                      <span
                        className={
                          styles["chat-time"]
                        }
                      >
                        {formatTime(
                          c.last_message_at ||
                            c.updated_at
                        )}
                      </span>
                    </div>

                    <div
                      className={
                        styles["chat-preview-row"]
                      }
                    >
                      <p
                        className={
                          styles["chat-preview"]
                        }
                      >
                        {formatPreview(c)}
                      </p>

                      {needsHuman && (
                        <span
                          className={
                            styles["human-pill"]
                          }
                          title="Intervenção humana solicitada"
                        >
                          Humano
                        </span>
                      )}

                      {activeTab === "all" && (
                        <span
                          className={
                            styles["session-pill"]
                          }
                        >
                          {getSessionLabel(
                            String(session)
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
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
              <Avatar
                src={selected.avatar_url}
                name={getDisplayName(selected)}
                size="lg"
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
                  {getDisplayName(selected)}
                </strong>

                <span
                  className={
                    styles["chat-header-status"]
                  }
                >
                  {formatPhone(selected.phone)}
                  {" · "}
                  {getSessionLabel(
                    String(
                      getConversationSession(selected)
                    )
                  )}

                  {isHumanInterventionConversation(selected) && (
                    <>
                      {" · "}
                      <strong
                        className={
                          styles["human-header-pill"]
                        }
                      >
                        Intervenção humana
                      </strong>
                    </>
                  )}
                </span>
              </div>
            </div>

            {isHumanInterventionConversation(selected) && (
              <div
                className={
                  styles["human-alert-bar"]
                }
              >
                <div
                  className={
                    styles["human-alert-content"]
                  }
                >
                  <strong
                    className={
                      styles["human-alert-title"]
                    }
                  >
                    🚨 Intervenção humana solicitada
                  </strong>

                  <span
                    className={
                      styles["human-alert-text"]
                    }
                  >
                    Bot pausado. A equipe precisa assumir essa conversa.
                  </span>
                </div>

                <button
                  type="button"
                  className={
                    styles["resolve-human-button"]
                  }
                  onClick={resolveHumanIntervention}
                  disabled={resolvingHuman}
                >
                  {resolvingHuman
                    ? "Resolvendo..."
                    : "Resolver"}
                </button>
              </div>
            )}

            {/* MESSAGES */}
            <div
              ref={messagesRef}
              className={
                styles["chat-messages"]
              }
            >
              {messages.length === 0 && (
                <div
                  className={
                    styles["chat-empty"]
                  }
                >
                  Nenhuma mensagem carregada ainda.
                </div>
              )}

              {messages.map((m) => {
                const isClient =
                  m.sender === "user"

                const isSystem =
                  isHumanInterventionMessage(m)

                return (
                  <div
                    key={m.id}
                    className={`
                      ${styles["message-row"]}
                      ${
                        isSystem
                          ? styles["message-row-system"]
                          : isClient
                            ? styles["message-row-client"]
                            : styles["message-row-me"]
                      }
                    `}
                  >
                    <div
                      className={`
                        ${styles["chat-bubble"]}
                        ${
                          isSystem
                            ? styles["chat-bubble-system"]
                            : isClient
                              ? styles["chat-bubble-client"]
                              : styles["chat-bubble-me"]
                        }
                      `}
                    >
                      {renderMessageContent(m)}

                      <span
                        className={
                          styles["message-time"]
                        }
                      >
                        {m.is_temp
                          ? "enviando..."
                          : formatMessageTime(
                              m.created_at
                            )}
                      </span>
                    </div>
                  </div>
                )
              })}
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
                placeholder={
                  isHumanInterventionConversation(selected)
                    ? "Responder como atendente"
                    : "Digite uma mensagem"
                }
                className={`
                  ${styles["chat-input-field"]}
                  ${
                    isHumanInterventionConversation(selected)
                      ? styles["chat-input-field-human"]
                      : ""
                  }
                `}
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
                type="button"
              >
                {sending
                  ? "..."
                  : "➤"}
              </button>
            </div>
          </>
        ) : (
          <div
            className={
              styles["chat-empty-main"]
            }
          >
            <div
              className={
                styles["empty-icon"]
              }
            >
              💬
            </div>

            <h3>
              Selecione uma conversa
            </h3>

            <p>
              Escolha um chat ao lado para visualizar as mensagens.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
