"use client"

import { useState } from "react"
import styles from "./login.module.css"
import Image from "next/image"
import SoftParticles from "../components/SoftParticles"
import { createClient } from "@/lib/supabase/client"
import { dashboardHome, parseDashboardRole } from "@/lib/dashboard-access"

const LOGIN_TIMEOUT_MS = 15_000

async function withLoginTimeout<T>(operation: PromiseLike<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null

  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("LOGIN_TIMEOUT")),
          LOGIN_TIMEOUT_MS
        )
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export default function AdminLoginPage() {
  const supabase = createClient()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)


  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()

    if (loading) return

    setLoading(true)

    try {
      const { data, error } = await withLoginTimeout(
        supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
      )

      if (error || !data.session || !data.user) {
        alert("Email ou senha inválidos")
        return
      }

      const { data: profile, error: profileError } = await withLoginTimeout(
        supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .maybeSingle()
      )

      if (profileError) {
        console.error(profileError)
        alert("Erro ao validar usuário")
        return
      }

      const role = parseDashboardRole(profile?.role)

      if (!role) {
        void supabase.auth.signOut({ scope: "local" })
        alert("Acesso não autorizado")
        return
      }

      window.location.assign(dashboardHome(role))
    } catch (err) {
      console.error("Erro ao entrar:", err)

      if (err instanceof Error && err.message === "LOGIN_TIMEOUT") {
        alert("O servidor de login demorou para responder. Tente novamente.")
      } else {
        alert("Não foi possível entrar agora. Tente novamente.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <SoftParticles />

      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logoArea}>
            <Image
              src="/logo.png"
              alt="ModaPink"
              width={140}
              height={140}
              priority
            />
          </div>

          <p>Painel Administrativo</p>
        </div>

        <form onSubmit={handleLogin} className={styles.form}>
          <div className={styles.inputGroup}>
            <label>Email</label>
            <input
              type="email"
              placeholder="seuemail@modapink.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label>Senha</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? "Entrando..." : "Entrar no painel"}
          </button>
        </form>

        <div className={styles.footer}>
          © ModaPink Admin
        </div>
      </div>
    </div>
  )
}
