"use client"

import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import {
  BarChart3, Instagram, LayoutDashboard, LogOut, Megaphone, Menu,
  Package, Settings, Smartphone, Users, X,
} from "lucide-react"
import { canAccessDashboard, type DashboardRole } from "@/lib/dashboard-access"
import { createClient } from "@/lib/supabase/client"
import styles from "./mobile-nav.module.css"

const navigation = [
  { label: "Operação", items: [
    { label: "Visão geral", href: "/dashboard", icon: LayoutDashboard },
    { label: "Atendimento", href: "/dashboard/conversas", icon: WhatsAppIcon },
    { label: "Pedidos", href: "/dashboard/pedidos", icon: Package },
    { label: "Campanhas", href: "/dashboard/disparos", icon: Megaphone },
    { label: "Instagram", href: "/dashboard/instagram", icon: Instagram },
    { label: "Relatórios", href: "/dashboard/relatorios", icon: BarChart3 },
  ] },
  { label: "Gestão", items: [
    { label: "Números", href: "/dashboard/numeros", icon: Smartphone },
    { label: "Usuários", href: "/dashboard/usuarios", icon: Users },
    { label: "Configurações", href: "/dashboard/configuracoes", icon: Settings },
  ] },
]

export default function MobileNav({ role }: { role: DashboardRole }) {
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLElement>(null)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!open) return
    const trigger = triggerRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const frame = requestAnimationFrame(() => drawerRef.current?.querySelector<HTMLButtonElement>("button")?.focus())
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        setOpen(false)
      }
      if (event.key !== "Tab") return
      const elements = drawerRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
      if (!elements?.length) return
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", onKeyDown)
      trigger?.focus()
    }
  }, [open])

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      const { error } = await createClient().auth.signOut()
      if (error) throw error
      localStorage.clear()
      sessionStorage.clear()
      setOpen(false)
      router.push("/login")
    } catch (error) {
      console.error("Erro ao sair:", error)
      setLoggingOut(false)
      window.alert("Não foi possível sair agora. Tente novamente.")
    }
  }

  return (
    <>
      <button ref={triggerRef} type="button" className={styles.trigger} onClick={() => setOpen(true)} aria-label="Abrir menu de navegação" aria-expanded={open} aria-controls={open ? "dashboard-mobile-menu" : undefined}>
        <Menu size={19} strokeWidth={1.75} aria-hidden="true" />
      </button>
      {open && createPortal(
        <div className={styles.modal}>
          <button className={styles.overlay} type="button" onClick={() => setOpen(false)} aria-label="Fechar menu de navegação" tabIndex={-1} />
          <aside ref={drawerRef} id="dashboard-mobile-menu" className={styles.drawer} role="dialog" aria-modal="true" aria-label="Menu de navegação">
            <div className={styles.top}>
              <Image src="/modapiink.png" alt="Moda Pink" width={140} height={50} />
              <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Fechar menu de navegação"><X size={18} aria-hidden="true" /></button>
            </div>
            <nav className={styles.content} aria-label="Navegação principal">
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
                        <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`${styles.link} ${active ? styles.active : ""}`} aria-current={active ? "page" : undefined}>
                          <Icon size={19} strokeWidth={1.75} aria-hidden="true" /><span>{item.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )
              })}
            </nav>
            <div className={styles.footer}>
              <button type="button" className={styles.logout} onClick={handleLogout} disabled={loggingOut}><LogOut size={17} aria-hidden="true" />{loggingOut ? "Saindo…" : "Sair da conta"}</button>
            </div>
          </aside>
        </div>, document.body,
      )}
    </>
  )
}
