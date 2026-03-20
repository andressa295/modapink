"use client"

import { useState } from "react"
import styles from "./login.module.css"
import Image from "next/image"
import SoftParticles from "../components/SoftParticles"

export default function AdminLoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    console.log("Login:", { email, password })
  }

  return (
    <div className={styles.container}>
      {/* 💖 FUNDO SUAVE */}
      <SoftParticles />

      {/* 🔒 CARD LOGIN */}
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

          <button type="submit" className={styles.button}>
            Entrar no painel
          </button>
        </form>

        <div className={styles.footer}>
          © ModaPink Admin
        </div>
      </div>
    </div>
  )
}