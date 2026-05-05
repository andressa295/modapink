"use client"

import { useState, useEffect } from "react"
import "./styles/sidebar.css"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

import {
  LayoutDashboard,
  MessageCircle,
  Smartphone,
  Users,
  Package,
  BarChart3,
  Settings,
  ChevronLeft,
  LogOut
} from "lucide-react"

export default function Sidebar() {

  const [collapsed, setCollapsed] = useState(false)
  const [userName, setUserName] = useState("Usuário")

  const router = useRouter()

  // 🔐 BUSCAR USUÁRIO
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
        console.error("Erro user:", err)
        setUserName("Usuário")
      }
    }

    loadUser()
  }, [])

  // 🚪 LOGOUT
  async function handleLogout() {
    const supabase = createClient()

    await supabase.auth.signOut()

    // 🔥 limpa sessão bugada
    localStorage.clear()
    sessionStorage.clear()

    router.push("/login")
  }

  return (
    <aside
      className={`sidebar ${collapsed ? "collapsed" : ""}`}
      style={{ position: "relative" }}
    >

      {/* BOTÃO ENCOLHER */}
      <div
        className="sidebar-toggle"
        onClick={() => setCollapsed(!collapsed)}
      >
        <ChevronLeft
          size={16}
          style={{
            transform: collapsed ? "rotate(180deg)" : "rotate(0deg)",
            transition: "0.25s"
          }}
        />
      </div>

      {/* LOGO */}
      {!collapsed && (
        <div className="sidebar-logo">
          <Image
            src="/modapink.png"
            alt="Moda Pink"
            width={140}
            height={50}
            priority
          />
        </div>
      )}

      {/* MENU */}
      <nav className="sidebar-nav">

        <a href="/dashboard" className="sidebar-item active">
          <LayoutDashboard />
          <span className="sidebar-text">Dashboard</span>
        </a>

        <a href="/dashboard/conversas" className="sidebar-item">
          <MessageCircle />
          <span className="sidebar-text">Conversas</span>
        </a>

        <a href="/dashboard/numeros" className="sidebar-item">
          <Smartphone />
          <span className="sidebar-text">Números</span>
        </a>

        <a href="/dashboard/usuarios" className="sidebar-item">
          <Users />
          <span className="sidebar-text">Usuários</span>
        </a>

        <a href="/dashboard/pedidos" className="sidebar-item">
          <Package />
          <span className="sidebar-text">Pedidos</span>
        </a>

        <a href="/dashboard/relatorios" className="sidebar-item">
          <BarChart3 />
          <span className="sidebar-text">Relatórios</span>
        </a>

        <a href="/dashboard/configuracoes" className="sidebar-item">
          <Settings />
          <span className="sidebar-text">Configurações</span>
        </a>

      </nav>

      {/* USUÁRIO + LOGOUT */}
      <div className="sidebar-user">

        {!collapsed && (
          <>
            <div className="sidebar-user-name">
              Logado como <strong>{userName}</strong>
            </div>

            <button
              className="sidebar-logout"
              onClick={handleLogout}
            >
              <LogOut size={16} />
              <span>Sair</span>
            </button>
          </>
        )}

      </div>

    </aside>
  )
}