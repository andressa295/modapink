"use client"

import { useEffect, useState } from "react"
import "./RecentConversations.css"
import { supabase } from "@/lib/supabase/client"

type Conversation = {
  id: string
  name: string
  message: string
  time: string
}

export default function RecentConversations() {

  const [conversations, setConversations] = useState<Conversation[]>([])

  useEffect(() => {
    async function loadConversations() {

      // 🔥 busca últimas mensagens
      const { data: messages } = await supabase
        .from("messages")
        .select(`
          id,
          content,
          created_at,
          conversations (
            customers (
              name
            )
          )
        `)
        .order("created_at", { ascending: false })
        .limit(5)

      if (!messages) return

      const formatted = messages.map((msg: any) => {

        const date = new Date(msg.created_at)

        const diff = Math.floor((Date.now() - date.getTime()) / 60000)

        let time = "agora"

        if (diff > 1) time = `${diff} min atrás`
        if (diff > 60) time = `${Math.floor(diff / 60)}h atrás`

        return {
          id: msg.id,
          name: msg.conversations?.customers?.name || "Cliente",
          message: msg.content,
          time
        }
      })

      setConversations(formatted)
    }

    loadConversations()
  }, [])

  return (

    <div className="dashboard-card">

      <h3>Conversas recentes</h3>

      <div className="conversation-list">

        {conversations.length === 0 && (
          <p style={{ color: "#6b7280", fontSize: "13px" }}>
            Nenhuma conversa ainda
          </p>
        )}

        {conversations.map((conv) => (

          <div key={conv.id} className="conversation-item">

            <div>

              <strong>{conv.name}</strong>

              <p>{conv.message}</p>

            </div>

            <span>{conv.time}</span>

          </div>

        ))}

      </div>

    </div>

  )
}