"use client"

import { useEffect, useState } from "react"
import "./styles/topbar.css"

export default function Topbar() {

  const [time, setTime] = useState("")
  const [date, setDate] = useState("")

  useEffect(() => {

    const updateClock = () => {

      const now = new Date()

      const formattedTime = now.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
      })

      const formattedDate = now.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long"
      })

      setTime(formattedTime)
      setDate(formattedDate)

    }

    updateClock()

    const interval = setInterval(updateClock, 1000)

    return () => clearInterval(interval)

  }, [])

  const user = {
    name: "Rafaela"
  }

  return (
    <header className="topbar">

      <div className="topbar-left">

        <div className="topbar-title">
          Painel Administrativo
        </div>

        <div className="topbar-date">
          {date}
        </div>

      </div>

      <div className="topbar-right">

        <div className="topbar-clock">
          {time}
        </div>

        <div className="topbar-user">
          Olá, {user.name}
        </div>

      </div>

    </header>
  )
}