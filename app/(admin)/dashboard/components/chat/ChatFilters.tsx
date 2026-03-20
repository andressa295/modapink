"use client"

import { useState } from "react"
import "../../styles/chat.css"

export type FilterType = "Todos" | "Vendas" | "SAC" | "Financeiro"

interface Props {
  onChange?: (filter: FilterType) => void
  counts?: Partial<Record<FilterType, number>>
}

/* 🔥 fora do componente (evita recriação) */
const FILTERS: FilterType[] = ["Todos", "Vendas", "SAC", "Financeiro"]

export default function ChatFilters({ onChange, counts }: Props) {
  const [active, setActive] = useState<FilterType>("Todos")

  function handleClick(filter: FilterType) {
    if (filter === active) return // 🔥 evita re-render inútil

    setActive(filter)
    onChange?.(filter)
  }

  return (
    <div className="chat-filters">
      {FILTERS.map((filter) => {
        const count = counts?.[filter]

        return (
          <button
            key={filter}
            type="button"
            onClick={() => handleClick(filter)}
            className={`chat-filter-item ${active === filter ? "active" : ""}`}
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
  )
}