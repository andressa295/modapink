"use client"

import { useState } from "react"
import styles from "./login.module.css"
import Image from "next/image"
import SoftParticles from "../components/SoftParticles"
import { createClient } from "@/lib/supabase/client"
import { dashboardHome, parseDashboardRole } from "@/lib/dashboard-access"

const DIRECT_LOGIN_TIMEOUT_MS = 12_000
const SERVER_LOGIN_TIMEOUT_MS = 20_000

type LoginResponse = {
  error?: string
  redirectTo?: string
}

function isCredentialError(error: unknown) {
  if (!error || typeof error !== "object") return false

  const candidate = error as {
    status?: number
    code?: string
    message?: string
  }

  const message = String(candidate.message || "").toLowerCase()

  return (
    candidate.code === "invalid_credentials" ||
    (candidate.status === 400 && message.includes("invalid login"))
  )
}

async function withTimeout<T>(operation: PromiseLike<T>, timeoutMs: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null

  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("LOGIN_TIMEOUT")),
          timeoutMs
        )
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export default function AdminLoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()

    if (loading) return

    setLoading(true)

    try {
      const normalizedEmail = email.trim()
      const supabase = createClient()

      try {
        const { data, error } = await withTimeout(
          supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          }),
          DIRECT_LOGIN_TIMEOUT_MS
        )

        if (error && isCredentialError(error)) {
          alert("Email ou senha inválidos")
          return
        }

        if (!error && data.session && data.user) {
          const { data: profile, error: profileError } = await withTimeout(
            supabase
              .from("profiles")
              .select("role")
              .eq("id", data.user.id)
              .maybeSingle(),
            DIRECT_LOGIN_TIMEOUT_MS
          )

          if (!profileError) {
            const role = parseDashboardRole(profile?.role)

            if (!role) {
              await supabase.auth.signOut({ scope: "local" })
              alert("Acesso não autorizado")
              return
            }

            window.location.assign(dashboardHome(role))
            return
          }
        }
      } catch (directError) {
        console.warn(
          "Login direto indisponível; tentando pelo servidor:",
          directError
        )
      }

      const controller = new AbortController()
      const timeout = window.setTimeout(
        () => controller.abort(),
        SERVER_LOGIN_TIMEOUT_MS
      )

      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: normalizedEmail,
            password,
          }),
          signal: controller.signal,
        })

        const result = (await response.json().catch(() => ({}))) as LoginResponse

        if (!response.ok) {
          alert(
            result.error ||
              "O serviço de login está temporariamente instável. Tente novamente."
          )
          return
        }

        if (!result.redirectTo) {
          alert("Não foi possível abrir o painel. Tente novamente.")
          return
        }

        window.location.assign(result.redirectTo)
      } finally {
        window.clearTimeout(timeout)
      }
    } catch (err) {
      console.error("Erro ao entrar:", err)

      if (
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && err.message === "LOGIN_TIMEOUT")
      ) {
        alert(
          "O Supabase está temporariamente instável. Aguarde alguns minutos e tente novamente."
        )
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
