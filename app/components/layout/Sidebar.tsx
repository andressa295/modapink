"use client"

import { useState } from "react"
import "./styles/sidebar.css"
import Image from "next/image"

import {
  LayoutDashboard,
  MessageCircle,
  Smartphone,
  Users,
  Package,
  BarChart3,
  Settings,
  ChevronLeft
} from "lucide-react"

export default function Sidebar() {

  const [collapsed, setCollapsed] = useState(false)

  const user = {
    name: "Rafaela"
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

      {/* USUÁRIO */}
      <div className="sidebar-user">

        {!collapsed && (
          <div className="sidebar-user-name">
            Logado como <strong>{user.name}</strong>
          </div>
        )}

      </div>

    </aside>
  )
}