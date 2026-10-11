"use client"

import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BarChart3, ChevronLeft, Instagram, LayoutDashboard, LogOut,
  Megaphone, Package, Settings, Smartphone, Users,
} from "lucide-react"
import { canAccessDashboard, type DashboardRole } from "@/lib/dashboard-access"
import { createClient } from "@/lib/supabase/client"
import styles from "./styles/sidebar.module.css"

const COLLAPSED_KEY = "modapink.dashboard.sidebar.collapsed"

const navigation = [
  {
    label: "Operação",
    items: [
      { label: "Visão geral", href: "/dashboard", icon: LayoutDashboard },
      { label: "Atendimento", href: "/dashboard/conversas", icon: WhatsAppIcon },
      { label: "Pedidos", href: "/dashboard/pedidos", icon: Package },
      { label: "Campanhas", href: "/dashboard/disparos", icon: Megaphone },
      { label: "Instagram", href: "/dashboard/instagram", icon: Instagram },
      { label: "Relatórios", href: "/dashboard/relatorios", icon: BarChart3 },
    ],
  },
  {
    label: "Gestão",
    items: [
      { label: "Números", href: "/dashboard/numeros", icon: Smartphone },
      { label: "Usuários", href: "/dashboard/usuarios", icon: Users },
      { label: "Configurações", href: "/dashboard/configuracoes", icon: Settings },
    ],
  },
]

export default function Sidebar({ role }: { role: DashboardRole }) {
  const [collapsed, setCollapsed] = useState(false)
  const [userName, setUserName] = useState("Usuário")
  const [loggingOut, setLoggingOut] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const readPreference = () => {
      try { setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "true") } catch {}
    }
    const frame = requestAnimationFrame(readPreference)
    const onStorage = (event: StorageEvent) => {
      if (event.key === COLLAPSED_KEY) readPreference()
    }
    window.addEventListener("storage", onStorage)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("storage", onStorage)
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

  function toggleSidebar() {
    const nextValue = !collapsed
    setCollapsed(nextValue)
    try { localStorage.setItem(COLLAPSED_KEY, String(nextValue)) } catch {}
  }

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      const { error } = await createClient().auth.signOut()
      if (error) throw error
      localStorage.clear()
      sessionStorage.clear()
      router.push("/login")
    } catch (error) {
      console.error("Erro ao sair:", error)
      setLoggingOut(false)
      window.alert("Não foi possível sair agora. Tente novamente.")
    }
  }

  const initials = userName.trim().split(/\s+/).slice(0, 2).map(name => name.charAt(0)).join("").toUpperCase() || "U"

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`} aria-label="Navegação principal">
      <div className={styles.brandRow}>
        <Link href={canAccessDashboard(role, "/dashboard") ? "/dashboard" : "/dashboard/conversas"} className={styles.brand} aria-label="Moda Pink — início" title={collapsed ? "Moda Pink" : undefined}>
          {collapsed ? <span className={styles.brandMark} aria-hidden="true">MP</span> : <Image src="/modapiink.png" alt="Moda Pink" width={144} height={52} priority />}
        </Link>
      </div>

      <button type="button" className={styles.toggle} onClick={toggleSidebar} aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"} aria-expanded={!collapsed} aria-controls="dashboard-navigation" title={collapsed ? "Expandir menu" : "Recolher menu"}>
        <ChevronLeft size={16} aria-hidden="true" />
        <span className={styles.toggleLabel}>Recolher menu</span>
      </button>

      <nav id="dashboard-navigation" className={styles.nav}>
        {navigation.map(group => {
          const visibleItems = group.items.filter(item => canAccessDashboard(role, item.href))
          if (!visibleItems.length) return null
          return (
            <div key={group.label} className={styles.group}>
              <span className={styles.groupLabel}>{group.label}</span>
              {visibleItems.map(item => {
                const Icon = item.icon
                const active = item.href === "/dashboard" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)
                return (
                  <Link key={item.href} href={item.href} className={`${styles.item} ${active ? styles.active : ""}`} aria-current={active ? "page" : undefined} aria-label={collapsed ? item.label : undefined} title={collapsed ? item.label : undefined}>
                    <Icon size={19} strokeWidth={1.75} aria-hidden="true" />
                    <span className={styles.itemLabel}>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      <div className={styles.userArea}>
        <div className={styles.user} title={collapsed ? userName : undefined}>
          <span className={styles.avatar} aria-hidden="true">{initials}</span>
          <div className={styles.userInfo}>
            <strong>{userName}</strong>
            <span>{role === "admin" ? "Administrador" : "Atendimento"}</span>
          </div>
        </div>
        <button type="button" className={styles.logout} onClick={handleLogout} disabled={loggingOut} aria-label={loggingOut ? "Saindo da conta" : "Sair da conta"} title={collapsed ? "Sair da conta" : undefined}>
          <LogOut size={17} strokeWidth={1.75} aria-hidden="true" />
          <span className={styles.itemLabel}>{loggingOut ? "Saindo…" : "Sair da conta"}</span>
        </button>
      </div>
    </aside>
  )
}
