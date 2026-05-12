"use client"

import { useEffect, useState } from "react"

import styles from "./AutomationsUsage.module.css"

import { createClient } from "@/lib/supabase/client"

type Automation = {

  id: string

  name: string

  uses: number
}

export default function AutomationsUsage() {

  const [

    automations,

    setAutomations

  ] = useState<Automation[]>([])

  const [

    loading,

    setLoading

  ] = useState(true)

  useEffect(() => {

    const supabase =
      createClient()

    let mounted = true

    async function loadAutomations() {

      try {

        setLoading(true)

        const {

          data,

          error

        } = await supabase

          .from("automations")

          .select(
            "id, name, uses"
          )

          .order(
            "uses",
            {
              ascending: false
            }
          )

          .limit(5)

        if (error) {

          console.error(

            "❌ erro ao buscar automações:",

            error
          )

          return
        }

        if (!mounted) {
          return
        }

        setAutomations(
          data || []
        )

      } catch (err) {

        console.error(

          "💥 erro loadAutomations:",

          err
        )

      } finally {

        if (mounted) {

          setLoading(false)
        }
      }
    }

    loadAutomations()

    // ==========================
    // REALTIME
    // ==========================
    const channel = supabase

      .channel(
        "automations-usage"
      )

      .on(

        "postgres_changes",

        {

          event: "*",

          schema: "public",

          table: "automations",

        },

        (payload) => {

          console.log(

            "⚡ automação atualizada:",

            payload
          )

          loadAutomations()
        }
      )

      .subscribe()

    return () => {

      mounted = false

      supabase.removeChannel(
        channel
      )
    }

  }, [])

  return (

    <div
      className={
        styles["dashboard-card"]
      }
    >

      {/* HEADER */}
      <div
        className={
          styles["card-header"]
        }
      >

        <h3>
          Automações mais usadas
        </h3>

        <span
          className={
            styles.badge
          }
        >

          Top 5

        </span>

      </div>

      {/* LIST */}
      <div
        className={
          styles["automation-list"]
        }
      >

        {/* LOADING */}
        {loading && (

          <div
            className={
              styles.empty
            }
          >

            Carregando...

          </div>
        )}

        {/* EMPTY */}
        {!loading &&

          automations.length === 0 && (

            <p
              className={
                styles.empty
              }
            >

              Nenhuma automação ainda

            </p>
          )}

        {/* ITEMS */}
        {!loading &&

          automations.map(

            (
              item,
              index
            ) => (

              <div

                key={item.id}

                className={
                  styles["automation-item"]
                }

              >

                <div
                  className={
                    styles["automation-left"]
                  }
                >

                  <span
                    className={
                      styles.rank
                    }
                  >

                    #{index + 1}

                  </span>

                  <span
                    className={
                      styles.name
                    }
                  >

                    {item.name}

                  </span>

                </div>

                <strong
                  className={
                    styles.uses
                  }
                >

                  {item.uses ?? 0}

                </strong>

              </div>
            )
          )}

      </div>

    </div>
  )
}