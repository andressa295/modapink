"use client"

import { useState, useEffect } from "react"

import styles from "./styles/sidebar.module.css"

import Image from "next/image"

import {
  usePathname,
  useRouter
} from "next/navigation"

import { createClient } from "@/lib/supabase/client"

import {
  LayoutDashboard,
  Smartphone,
  Users,
  Package,
  BarChart3,
  Settings,
  ChevronLeft,
  LogOut
} from "lucide-react"

function WhatsAppIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#25D366"
        d="M16 .5C7.44.5.5 7.44.5 16c0 2.82.76 5.46 2.08 7.74L.5 31.5l7.95-2.03A15.4 15.4 0 0 0 16 31.5c8.56 0 15.5-6.94 15.5-15.5S24.56.5 16 .5Z"
      />

      <path
        fill="#ffffff"
        d="M24.18 19.62c-.45-.22-2.65-1.3-3.06-1.45-.41-.15-.71-.22-1.01.23-.3.44-1.16 1.45-1.42 1.74-.26.3-.52.33-.97.11-.45-.22-1.89-.7-3.6-2.23-1.33-1.19-2.23-2.66-2.49-3.11-.26-.45-.03-.69.2-.91.2-.2.45-.52.67-.78.22-.26.3-.45.45-.75.15-.3.07-.56-.04-.78-.11-.22-1.01-2.43-1.38-3.33-.36-.87-.73-.75-1.01-.76-.26-.01-.56-.01-.86-.01-.3 0-.78.11-1.19.56-.41.45-1.56 1.52-1.56 3.7s1.6 4.3 1.82 4.59c.22.3 3.14 4.79 7.61 6.72 1.06.46 1.89.73 2.54.94 1.07.34 2.04.29 2.81.18.86-.13 2.65-1.08 3.02-2.13.37-1.04.37-1.94.26-2.13-.11-.19-.41-.3-.86-.52Z"
      />
    </svg>
  )
}

function InstagramBrandIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id="instagramGradientSidebar"
          x1="4"
          y1="28"
          x2="28"
          y2="4"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#F58529" />
          <stop offset="0.35" stopColor="#DD2A7B" />
          <stop offset="0.7" stopColor="#8134AF" />
          <stop offset="1" stopColor="#515BD4" />
        </linearGradient>
      </defs>

      <rect
        x="3"
        y="3"
        width="26"
        height="26"
        rx="7"
        fill="url(#instagramGradientSidebar)"
      />

      <circle
        cx="16"
        cy="16"
        r="6"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.4"
      />

      <circle
        cx="22.5"
        cy="9.5"
        r="1.8"
        fill="#ffffff"
      />
    </svg>
  )
}

export default function Sidebar() {
  const [
    collapsed,
    setCollapsed
  ] = useState(false)

  const [
    userName,
    setUserName
  ] = useState("Usuário")

  const router =
    useRouter()

  const pathname =
    usePathname()

  function getItemClass(
    href: string
  ) {
    const isDashboard =
      href === "/dashboard"

    const active =
      isDashboard
        ? pathname === href
        : pathname?.startsWith(href)

    return `
      ${styles["sidebar-item"]}
      ${active ? styles.active : ""}
    `
  }

  // ======================
  // USER
  // ======================
  useEffect(() => {
    const supabase =
      createClient()

    async function loadUser() {
      try {
        const {
          data: { user }
        } = await supabase
          .auth
          .getUser()

        if (!user) {
          setUserName(
            "Usuário"
          )

          return
        }

        const {
          data: profile,
          error
        } = await supabase
          .from("profiles")
          .select("name")
          .eq(
            "id",
            user.id
          )
          .single()

        if (
          error ||
          !profile
        ) {
          setUserName(
            "Usuário"
          )

          return
        }

        setUserName(
          profile.name ||
          "Usuário"
        )

      } catch (err) {
        console.error(
          "Erro user:",
          err
        )

        setUserName(
          "Usuário"
        )
      }
    }

    loadUser()
  }, [])

  // ======================
  // LOGOUT
  // ======================
  async function handleLogout() {
    const supabase =
      createClient()

    await supabase
      .auth
      .signOut()

    localStorage.clear()

    sessionStorage.clear()

    router.push("/login")
  }

  return (
    <aside
      className={`
        ${styles.sidebar}
        ${collapsed ? styles.collapsed : ""}
      `}
    >
      {/* TOGGLE */}
      <div
        className={styles["sidebar-toggle"]}
        onClick={() =>
          setCollapsed(
            !collapsed
          )
        }
      >
        <ChevronLeft
          size={16}
          style={{
            transform:
              collapsed
                ? "rotate(180deg)"
                : "rotate(0deg)",
            transition:
              "0.25s"
          }}
        />
      </div>

      {/* LOGO */}
      {!collapsed && (
        <div
          className={styles["sidebar-logo"]}
        >
          <Image
            src="/modapiink.png"
            alt="Moda Pink"
            width={140}
            height={50}
            priority
          />
        </div>
      )}

      {/* NAV */}
      <nav
        className={styles["sidebar-nav"]}
      >
        {/* DASHBOARD */}
        <a
          href="/dashboard"
          className={getItemClass("/dashboard")}
        >
          <LayoutDashboard />

          <span className={styles["sidebar-text"]}>
            Dashboard
          </span>
        </a>

        {/* CONVERSAS / WHATSAPP */}
        <a
          href="/dashboard/conversas"
          className={getItemClass("/dashboard/conversas")}
        >
          <WhatsAppIcon />

          <span className={styles["sidebar-text"]}>
            WhatsApp
          </span>
        </a>

        {/* INSTAGRAM */}
        <a
          href="/dashboard/instagram"
          className={getItemClass("/dashboard/instagram")}
        >
          <InstagramBrandIcon />

          <span className={styles["sidebar-text"]}>
            Instagram
          </span>
        </a>

        {/* NÚMEROS */}
        <a
          href="/dashboard/numeros"
          className={getItemClass("/dashboard/numeros")}
        >
          <Smartphone />

          <span className={styles["sidebar-text"]}>
            Números
          </span>
        </a>

        {/* USERS */}
        <a
          href="/dashboard/usuarios"
          className={getItemClass("/dashboard/usuarios")}
        >
          <Users />

          <span className={styles["sidebar-text"]}>
            Usuários
          </span>
        </a>

        {/* PEDIDOS */}
        <a
          href="/dashboard/pedidos"
          className={getItemClass("/dashboard/pedidos")}
        >
          <Package />

          <span className={styles["sidebar-text"]}>
            Pedidos
          </span>
        </a>

        {/* RELATÓRIOS */}
        <a
          href="/dashboard/relatorios"
          className={getItemClass("/dashboard/relatorios")}
        >
          <BarChart3 />

          <span className={styles["sidebar-text"]}>
            Relatórios
          </span>
        </a>

        {/* CONFIG */}
        <a
          href="/dashboard/configuracoes"
          className={getItemClass("/dashboard/configuracoes")}
        >
          <Settings />

          <span className={styles["sidebar-text"]}>
            Configurações
          </span>
        </a>
      </nav>

      {/* USER */}
      <div className={styles["sidebar-user"]}>
        {!collapsed && (
          <>
            <div className={styles["sidebar-user-name"]}>
              Logado como{" "}

              <strong>
                {userName}
              </strong>
            </div>

            <button
              className={styles["sidebar-logout"]}
              onClick={handleLogout}
            >
              <LogOut size={16} />

              <span>
                Sair
              </span>
            </button>
          </>
        )}
      </div>
    </aside>
  )
}