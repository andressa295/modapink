"use client"

import { useState } from "react"
import styles from "./login.module.css"
import Image from "next/image"
import SoftParticles from "../components/SoftParticles"

const LOGIN_TIMEOUT_MS = 20_000

type LoginResponse = {
  error?: string
  redirectTo?: string
}

export default function AdminLoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()

    if (loading) return

    setLoading(true)

    const controller = new AbortController()
    const timeout = window.setTimeout(
      () => controller.abort(),
      LOGIN_TIMEOUT_MS
    )

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
        signal: controller.signal,
      })

      const result = (await response.json().catch(() => ({}))) as LoginResponse

      if (!response.ok) {
        alert(result.error || "Não foi possível entrar agora. Tente novamente.")
        return
      }

      if (!result.redirectTo) {
        alert("Não foi possível abrir o painel. Tente novamente.")
        return
      }

      window.location.assign(result.redirectTo)
    } catch (err) {
      console.error("Erro ao entrar:", err)

      if (err instanceof DOMException && err.name === "AbortError") {
        alert("O servidor de login demorou para responder. Tente novamente.")
      } else {
        alert("Não foi possível entrar agora. Tente novamente.")
      }
    } finally {
      window.clearTimeout(timeout)
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
