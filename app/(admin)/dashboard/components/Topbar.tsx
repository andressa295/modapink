"use client"

import { useEffect, useState } from "react"
import "./styles/topbar.css"
import { createClient } from "@/lib/supabase/client"

// 🔥 MOBILE NAV
import MobileNav from "./layout/MobileNav"
import Sidebar from "./Sidebar"

export default function Topbar() {

  const [time, setTime] = useState("")
  const [date, setDate] = useState("")
  const [userName, setUserName] = useState("Usuário")

  // ⏰ RELÓGIO
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

  // 👤 USUÁRIO REAL (CORRIGIDO)
  useEffect(() => {
    const supabase = createClient()

    async function loadUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          setUserName("Usuário")
          return
        }

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", user.id)
          .single()

        if (error || !profile) {
          setUserName("Usuário")
          return
        }

        setUserName(profile.name || "Usuário")

      } catch (err) {
        console.error("Erro ao carregar usuário:", err)
        setUserName("Usuário")
      }
    }

    loadUser()
  }, [])

  return (
    <header className="topbar">

      {/* ESQUERDA */}
      <div className="topbar-left">

        {/* 📱 MENU MOBILE */}
        <MobileNav>
          <Sidebar />
        </MobileNav>

        <div className="topbar-info">
          <div className="topbar-title">
            Dashboard
          </div>

          <div className="topbar-date">
            {date}
          </div>
        </div>

      </div>

      {/* DIREITA */}
      <div className="topbar-right">

        <div className="topbar-clock">
          {time}
        </div>

        <div className="topbar-user">
          👋 {userName}
        </div>

      </div>

    </header>
  )
}