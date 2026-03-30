// src/types/index.ts

// =======================
// CANAIS DE ATENDIMENTO
// =======================
export type Channel = "VENDAS" | "SAC" | "FINANCEIRO"

// =======================
// MENSAGEM
// =======================
export type Message = {
  id: number
  body: string
  from: string
  timestamp: number
  fromMe: boolean
}

// =======================
// AVALIAÇÃO
// =======================
export type Rating = {
  score: number // 1 a 5
  feedback?: string
  createdAt: number
}

// =======================
// CONVERSA
// =======================
export type Conversation = {
  contact: string
  channel: Channel
  lastMessageAt: number
  messages: Message[]

  // 🔥 ATENDIMENTO
  assignedTo?: string
  status?: "open" | "closed"

  // ⭐ AVALIAÇÃO
  rating?: Rating

  // 🧠 CONTEXTO DO CLIENTE (NUVEMSHOP)
  customerId?: string
  customerName?: string
  lastOrderId?: string
  lastOrderStatus?: string

  // ⏱ MÉTRICAS
  firstResponseAt?: number
  lastAgentMessageAt?: number
}

// =======================
// SESSÃO WHATSAPP
// =======================
export type Session = {
  id: string
  name: string
  client: any
  conversations: Record<string, Conversation>
  qr: string | null
  ready: boolean

  // 🔥 CONTROLE
  createdAt?: number
}