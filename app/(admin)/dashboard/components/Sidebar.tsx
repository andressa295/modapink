"use client"

import { useState, useEffect } from "react"

import styles from "./styles/sidebar.module.css"

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

    // limpa sessão
    localStorage.clear()

    sessionStorage.clear()

    router.push("/login")
  }

  return (

    <aside

      className={`

        ${styles.sidebar}

        ${collapsed
          ? styles.collapsed
          : ""}

      `}

    >

      {/* TOGGLE */}
      <div

        className={
          styles["sidebar-toggle"]
        }

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
          className={
            styles["sidebar-logo"]
          }
        >

          <Image

            src="/modapink.png"

            alt="Moda Pink"

            width={140}

            height={50}

            priority

          />

        </div>
      )}

      {/* NAV */}
      <nav
        className={
          styles["sidebar-nav"]
        }
      >

        {/* DASHBOARD */}
        <a

          href="/dashboard"

          className={`

            ${styles["sidebar-item"]}

            ${styles.active}

          `}
        >

          <LayoutDashboard />

          <span
            className={
              styles["sidebar-text"]
            }
          >

            Dashboard

          </span>

        </a>

        {/* CONVERSAS */}
        <a

          href="/dashboard/conversas"

          className={
            styles["sidebar-item"]
          }
        >

          <MessageCircle />

          <span
            className={
              styles["sidebar-text"]
            }
          >

            Conversas

          </span>

        </a>

        {/* NÚMEROS */}
        <a

          href="/dashboard/numeros"

          className={
            styles["sidebar-item"]
          }
        >

          <Smartphone />

          <span
            className={
              styles["sidebar-text"]
            }
          >

            Números

          </span>

        </a>

        {/* USERS */}
        <a

          href="/dashboard/usuarios"

          className={
            styles["sidebar-item"]
          }
        >

          <Users />

          <span
            className={
              styles["sidebar-text"]
            }
          >

            Usuários

          </span>

        </a>

        {/* PEDIDOS */}
        <a

          href="/dashboard/pedidos"

          className={
            styles["sidebar-item"]
          }
        >

          <Package />

          <span
            className={
              styles["sidebar-text"]
            }
          >

            Pedidos

          </span>

        </a>

        {/* RELATÓRIOS */}
        <a

          href="/dashboard/relatorios"

          className={
            styles["sidebar-item"]
          }
        >

          <BarChart3 />

          <span
            className={
              styles["sidebar-text"]
            }
          >

            Relatórios

          </span>

        </a>

        {/* CONFIG */}
        <a

          href="/dashboard/configuracoes"

          className={
            styles["sidebar-item"]
          }
        >

          <Settings />

          <span
            className={
              styles["sidebar-text"]
            }
          >

            Configurações

          </span>

        </a>

      </nav>

      {/* USER */}
      <div
        className={
          styles["sidebar-user"]
        }
      >

        {!collapsed && (

          <>

            <div
              className={
                styles["sidebar-user-name"]
              }
            >

              Logado como{" "}

              <strong>
                {userName}
              </strong>

            </div>

            <button

              className={
                styles["sidebar-logout"]
              }

              onClick={
                handleLogout
              }

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