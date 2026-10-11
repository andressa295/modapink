"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Clock3 } from "lucide-react"
import type { DashboardRole } from "@/lib/dashboard-access"
import { createClient } from "@/lib/supabase/client"
import MobileNav from "./layout/MobileNav"
import styles from "./styles/topbar.module.css"

const pageNames = [
  ["/dashboard/conversas", "Atendimento"],
  ["/dashboard/disparos", "Campanhas"],
  ["/dashboard/instagram", "Instagram"],
  ["/dashboard/numeros", "Números"],
  ["/dashboard/usuarios", "Usuários"],
  ["/dashboard/pedidos", "Pedidos"],
  ["/dashboard/relatorios", "Relatórios"],
  ["/dashboard/configuracoes", "Configurações"],
] as const

export default function Topbar({ role }: { role: DashboardRole }) {
  const [clock, setClock] = useState({ time: "", date: "", greeting: "Olá" })
  const [userName, setUserName] = useState("Usuário")
  const pathname = usePathname()
  const pageTitle = pageNames.find(([path]) => pathname === path || pathname.startsWith(`${path}/`))?.[1] || "Visão geral"
  const userInitial = userName.trim().charAt(0).toUpperCase() || "U"

  useEffect(() => {
    const updateClock = () => {
      const now = new Date()
      const options = { timeZone: "America/Sao_Paulo" }
      const hour = Number(new Intl.DateTimeFormat("pt-BR", { ...options, hour: "numeric", hourCycle: "h23" }).format(now))
      setClock({
        time: now.toLocaleTimeString("pt-BR", { ...options, hour: "2-digit", minute: "2-digit" }),
        date: now.toLocaleDateString("pt-BR", { ...options, weekday: "short", day: "numeric", month: "short" }),
        greeting: hour >= 5 && hour < 12 ? "Bom dia" : hour >= 12 && hour < 18 ? "Boa tarde" : "Boa noite",
      })
    }
    const frame = requestAnimationFrame(updateClock)
    const interval = window.setInterval(updateClock, 30_000)
    return () => {
      cancelAnimationFrame(frame)
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    let active = true
    const supabase = createClient()
    async function loadUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single()
        if (active) setUserName(profile?.name || "Usuário")
      } catch (error) {
        console.error("Erro ao carregar usuário:", error)
      }
    }
    void loadUser()
    return () => { active = false }
  }, [])

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <div className={styles.mobileOnly}><MobileNav role={role} /></div>
        <div className={styles.breadcrumb} aria-label="Página atual">
          <span className={styles.storeName}>Moda Pink</span>
          <span className={styles.separator} aria-hidden="true">/</span>
          <span className={styles.pageTitle}>{pageTitle}</span>
        </div>
      </div>
      <div className={styles.right}>
        <div className={styles.clock} title="Horário de Brasília">
          <Clock3 size={14} strokeWidth={1.75} aria-hidden="true" />
          <span>{clock.time || "—"}</span>
          <span className={styles.date}>{clock.date}</span>
        </div>
        <div className={styles.user} title={userName}>
          <div className={styles.avatar} aria-hidden="true">{userInitial}</div>
          <div className={styles.userInfo}>
            <span>{clock.greeting}</span>
            <strong>{userName}</strong>
          </div>
        </div>
      </div>
    </header>
  )
}
