"use client"

import { useEffect, useState } from "react"

import styles from "./styles/topbar.module.css"

import { createClient } from "@/lib/supabase/client"

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

    userName,

    setUserName

  ] = useState("Usuário")

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

      setTime(
        formattedTime
      )

      setDate(
        formattedDate
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

    <header
      className={
        styles.topbar
      }
    >

      {/* LEFT */}
      <div
        className={
          styles["topbar-left"]
        }
      >

        {/* MOBILE ONLY */}
        <div
          className={
            styles["mobile-only"]
          }
        >

          <MobileNav>

            <Sidebar />

          </MobileNav>

        </div>

        {/* INFO */}
        <div
          className={
            styles["topbar-info"]
          }
        >

          <div
            className={
              styles["topbar-title"]
            }
          >

            Dashboard

          </div>

          <div
            className={
              styles["topbar-date"]
            }
          >

            {date}

          </div>

        </div>

      </div>

      {/* RIGHT */}
      <div
        className={
          styles["topbar-right"]
        }
      >

        <div
          className={
            styles["topbar-clock"]
          }
        >

          {time}

        </div>

        <div
          className={
            styles["topbar-user"]
          }
        >

          👋 {userName}

        </div>

      </div>

    </header>
  )
}