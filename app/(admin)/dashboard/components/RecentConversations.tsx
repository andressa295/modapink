"use client"

import { useEffect, useState } from "react"

import styles from "./RecentConversations.module.css"

import { createClient } from "@/lib/supabase/client"

type Conversation = {

  id: string

  name: string

  message: string

  time: string
}

export default function RecentConversations() {

  const [

    conversations,

    setConversations

  ] = useState<Conversation[]>([])

  const [

    loading,

    setLoading

  ] = useState(true)

  useEffect(() => {

    const supabase =
      createClient()

    async function loadConversations() {

      try {

        setLoading(true)

        // ======================
        // MESSAGES
        // ======================
        const {

          data: messages,

          error

        } = await supabase

          .from("messages")

          .select(`
            id,
            content,
            created_at,
            conversation_id
          `)

          .order(
            "created_at",
            {
              ascending: false
            }
          )

          .limit(5)

        if (error) {

          console.error(

            "Erro messages:",

            error
          )

          return
        }

        if (!messages) {

          setConversations([])

          return
        }

        // ======================
        // IDS
        // ======================
        const conversationIds =

          messages.map(
            (m: any) =>
              m.conversation_id
          )

        // ======================
        // CONVERSATIONS
        // ======================
        const {

          data: conversationsData,

          error: convError

        } = await supabase

          .from("conversations")

          .select(`
            id,
            customer_name
          `)

          .in(
            "id",
            conversationIds
          )

        if (convError) {

          console.error(

            "Erro conversations:",

            convError
          )
        }

        // ======================
        // MAP
        // ======================
        const conversationMap =
          new Map()

        conversationsData?.forEach(
          (conv: any) => {

            conversationMap.set(

              conv.id,

              conv.customer_name
            )
          }
        )

        // ======================
        // FORMAT
        // ======================
        const formatted =

          messages.map(
            (msg: any) => {

              const date =
                new Date(
                  msg.created_at
                )

              const diff =
                Math.floor(

                  (
                    Date.now() -

                    date.getTime()

                  ) / 60000
                )

              let time =
                "agora"

              if (diff > 1) {

                time =
                  `${diff} min atrás`
              }

              if (diff > 60) {

                time =
                  `${Math.floor(diff / 60)}h atrás`
              }

              return {

                id: msg.id,

                name:

                  conversationMap.get(
                    msg.conversation_id
                  ) ||

                  "Cliente",

                message:

                  msg.content ||

                  "Mensagem vazia",

                time
              }
            }
          )

        setConversations(
          formatted
        )

      } catch (err) {

        console.error(

          "💥 erro loadConversations:",

          err
        )

      } finally {

        setLoading(false)
      }
    }

    loadConversations()

  }, [])

  return (

    <div
      className={
        styles["dashboard-card"]
      }
    >

      {/* TITLE */}
      <h3>
        Conversas recentes
      </h3>

      {/* LIST */}
      <div
        className={
          styles["conversation-list"]
        }
      >

        {/* LOADING */}
        {loading && (

          <p
            className={
              styles.empty
            }
          >

            Carregando...

          </p>
        )}

        {/* EMPTY */}
        {!loading &&

          conversations.length === 0 && (

            <p
              className={
                styles.empty
              }
            >

              Nenhuma conversa ainda

            </p>
          )}

        {/* ITEMS */}
        {!loading &&

          conversations.map((conv) => (

            <div

              key={conv.id}

              className={
                styles["conversation-item"]
              }

            >

              <div
                className={
                  styles["conversation-content"]
                }
              >

                <strong
                  className={
                    styles["conversation-name"]
                  }
                >

                  {conv.name}

                </strong>

                <p
                  className={
                    styles["conversation-message"]
                  }
                >

                  {conv.message}

                </p>

              </div>

              <span
                className={
                  styles["conversation-time"]
                }
              >

                {conv.time}

              </span>

            </div>

          ))}

      </div>

    </div>
  )
}