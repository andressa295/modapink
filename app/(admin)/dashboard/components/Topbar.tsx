"use client"

import { useEffect, useMemo, useState } from "react"

import styles from "./styles/topbar.module.css"

import { createClient } from "@/lib/supabase/client"

import { usePathname } from "next/navigation"

import {
  CalendarDays,
  Clock3,
  Sparkles
} from "lucide-react"

// MOBILE
import MobileNav from "./layout/MobileNav"

import Sidebar from "./Sidebar"

export default function Topbar() {
  const [
    time,
    setTime
  ] = useState("")

  const [
    date,
    setDate
  ] = useState("")

  const [
    greeting,
    setGreeting
  ] = useState("Olá")

  const [
    userName,
    setUserName
  ] = useState("Usuário")

  const pathname =
    usePathname()

  const pageTitle =
    useMemo(() => {
      if (pathname === "/dashboard") {
        return "Dashboard"
      }

      if (pathname?.startsWith("/dashboard/conversas")) {
        return "WhatsApp"
      }

      if (pathname?.startsWith("/dashboard/instagram")) {
        return "Instagram"
      }

      if (pathname?.startsWith("/dashboard/numeros")) {
        return "Números"
      }

      if (pathname?.startsWith("/dashboard/usuarios")) {
        return "Usuários"
      }

      if (pathname?.startsWith("/dashboard/pedidos")) {
        return "Pedidos"
      }

      if (pathname?.startsWith("/dashboard/relatorios")) {
        return "Relatórios"
      }

      if (pathname?.startsWith("/dashboard/configuracoes")) {
        return "Configurações"
      }

      return "Dashboard"
    }, [pathname])

  const userInitial =
    useMemo(() => {
      return (
        userName
          ?.trim()
          ?.charAt(0)
          ?.toUpperCase() || "U"
      )
    }, [userName])

  // ======================
  // CLOCK
  // ======================
  useEffect(() => {
    const updateClock = () => {
      const now =
        new Date()

      const formattedTime =
        now.toLocaleTimeString(
          "pt-BR",
          {
            hour: "2-digit",
            minute: "2-digit"
          }
        )

      const formattedDate =
        now.toLocaleDateString(
          "pt-BR",
          {
            weekday: "long",
            day: "numeric",
            month: "long"
          }
        )

      const hour =
        now.getHours()

      let nextGreeting =
        "Boa noite"

      if (hour >= 5 && hour < 12) {
        nextGreeting =
          "Bom dia"
      } else if (hour >= 12 && hour < 18) {
        nextGreeting =
          "Boa tarde"
      }

      setTime(
        formattedTime
      )

      setDate(
        formattedDate
      )

      setGreeting(
        nextGreeting
      )
    }

    updateClock()

    const interval =
      setInterval(
        updateClock,
        1000
      )

    return () =>
      clearInterval(
        interval
      )
  }, [])

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
          "Erro ao carregar usuário:",
          err
        )

        setUserName(
          "Usuário"
        )
      }
    }

    loadUser()
  }, [])

  return (
    <header className={styles.topbar}>
      {/* LEFT */}
      <div className={styles["topbar-left"]}>
        {/* MOBILE ONLY */}
        <div className={styles["mobile-only"]}>
          <MobileNav>
            <Sidebar />
          </MobileNav>
        </div>

        {/* INFO */}
        <div className={styles["topbar-info"]}>
          <div className={styles["title-row"]}>
            <span className={styles["title-icon"]}>
              <Sparkles size={15} />
            </span>

            <div className={styles["topbar-title"]}>
              {pageTitle}
            </div>
          </div>

          <div className={styles["topbar-date"]}>
            <CalendarDays size={13} />
            <span>
              {date}
            </span>
          </div>
        </div>
      </div>

      {/* RIGHT */}
      <div className={styles["topbar-right"]}>
        <div className={styles["topbar-clock"]}>
          <span className={styles["clock-dot"]} />

          <Clock3 size={15} />

          <span>
            {time}
          </span>
        </div>

        <div className={styles["topbar-user"]}>
          <div className={styles["user-avatar"]}>
            {userInitial}
          </div>

          <div className={styles["user-info"]}>
            <span>
              {greeting}
            </span>

            <strong>
              {userName}
            </strong>
          </div>
        </div>
      </div>
    </header>
  )
}