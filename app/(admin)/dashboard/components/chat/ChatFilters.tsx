"use client"

import { useState } from "react"
import "../../styles/chat.css"

// Tipos
export type FilterType = "Todos" | "Vendas" | "SAC" | "Financeiro"

interface ChatFiltersProps {
  onChange?: (filter: FilterType) => void

  // 🔥 pronto pra backend (contadores)
  counts?: {
    Todos?: number
    Vendas?: number
    SAC?: number
    Financeiro?: number
  }
}

export default function ChatFilters({ onChange, counts }: ChatFiltersProps) {

  const filters: FilterType[] = [
    "Todos",
    "Vendas",
    "SAC",
    "Financeiro",
  ]

  const [active, setActive] = useState<FilterType>("Todos")

  function handleClick(filter: FilterType) {
    if (filter === active) return

    setActive(filter)
    onChange?.(filter)
  }

  return (
    <div className="chat-filters">

      {filters.map((filter) => (

        <button
          key={filter}
          onClick={() => handleClick(filter)}
          className={`chat-filter-item ${active === filter ? "active" : ""}`}
        >

          <span>{filter}</span>

          {/* 🔥 contador (UX MUITO FORTE) */}
          {counts?.[filter] !== undefined && (
            <span className="chat-filter-count">
              {counts[filter]}
            </span>
          )}

        </button>

      ))}

    </div>
  )
}