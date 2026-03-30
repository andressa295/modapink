"use client"

import { useEffect, useState } from "react"
import { useSession } from "../../context/SessionContext"
import "../../styles/chat.css"

export type FilterType = "Todos" | "Vendas" | "SAC" | "Financeiro"

interface Props {
  onChange?: (filter: FilterType) => void
  counts?: Partial<Record<FilterType, number>>
}

const FILTERS: FilterType[] = ["Todos", "Vendas", "SAC", "Financeiro"]

export default function ChatFilters({ onChange, counts }: Props) {
  const [active, setActive] = useState<FilterType>("Todos")
  const [sessions, setSessions] = useState<any[]>([])

  const { activeSession, setActiveSession } = useSession()

  // ========================
  // 📲 CARREGA SESSÕES
  // ========================
  useEffect(() => {
    async function loadSessions() {
      try {
        const res = await fetch("/api/whatsapp/session")
        const data = await res.json()

        setSessions(data)

        // 🔥 define padrão automático
        if (data.length && !activeSession) {
          const defaultSession =
            data.find((s: any) => s.is_default) || data[0]

          setActiveSession(defaultSession.phone)
        }

      } catch (err) {
        console.error("Erro ao carregar sessões:", err)
      }
    }

    loadSessions()
  }, [])

  // ========================
  // 🎯 FILTRO
  // ========================
  function handleFilter(filter: FilterType) {
    if (filter === active) return

    setActive(filter)
    onChange?.(filter)
  }

  return (
    <div className="chat-filters-wrapper">

      {/* ========================
          📲 SELECT DE NÚMERO
      ======================== */}
      <div className="chat-session-select">

        <select
          value={activeSession || ""}
          onChange={(e) => setActiveSession(e.target.value)}
        >
          {sessions.map((s) => (
            <option key={s.phone} value={s.phone}>
              {s.phone} {s.status === "online" ? "🟢" : "🔴"}
            </option>
          ))}
        </select>

      </div>

      {/* ========================
          🎯 FILTROS
      ======================== */}
      <div className="chat-filters">

        {FILTERS.map((filter) => {
          const count = counts?.[filter]

          return (
            <button
              key={filter}
              type="button"
              onClick={() => handleFilter(filter)}
              className={`chat-filter-item ${
                active === filter ? "active" : ""
              }`}
            >
              <span>{filter}</span>

              {count !== undefined && (
                <span className="chat-filter-count">
                  {count}
                </span>
              )}
            </button>
          )
        })}

      </div>
    </div>
  )
}