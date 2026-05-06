"use client"

import { useEffect, useState } from "react"
import "./AutomationsUsage.css"
import { createClient } from "@/lib/supabase/client"

type Automation = {
  id: string
  name: string
  uses: number
}

export default function AutomationsUsage() {
  const [automations, setAutomations] = useState<
    Automation[]
  >([])

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    let mounted = true

    async function loadAutomations() {
      try {
        setLoading(true)

        const { data, error } = await supabase
          .from("automations")
          .select("id, name, uses")
          .order("uses", {
            ascending: false
          })
          .limit(5)

        if (error) {
          console.error(
            "❌ erro ao buscar automações:",
            error
          )

          return
        }

        if (!mounted) return

        setAutomations(data || [])

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

    // ========================================
    // REALTIME
    // ========================================
    const channel = supabase
      .channel("automations-usage")

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

      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <div className="dashboard-card">
      <div className="card-header">
        <h3>
          Automações mais usadas
        </h3>

        <span className="badge">
          Top 5
        </span>
      </div>

      <div className="automation-list">

        {/* ========================================
            LOADING
        ======================================== */}

        {loading && (
          <div className="empty">
            Carregando...
          </div>
        )}

        {/* ========================================
            EMPTY
        ======================================== */}

        {!loading &&
          automations.length === 0 && (
            <p className="empty">
              Nenhuma automação ainda
            </p>
          )}

        {/* ========================================
            LISTA
        ======================================== */}

        {!loading &&
          automations.map(
            (item, index) => (
              <div
                key={item.id}
                className="automation-item"
              >
                <div className="automation-left">
                  <span className="rank">
                    #{index + 1}
                  </span>

                  <span className="name">
                    {item.name}
                  </span>
                </div>

                <strong className="uses">
                  {item.uses ?? 0}
                </strong>
              </div>
            )
          )}
      </div>
    </div>
  )
}