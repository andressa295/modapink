"use client"

import { useState } from "react"
import styles from "./login.module.css"
import Image from "next/image"
import SoftParticles from "../components/SoftParticles"
import { supabase } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export default function AdminLoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      // 🔥 LIMPA QUALQUER SESSÃO QUEBRADA
      await supabase.auth.signOut()

      // 🔐 LOGIN
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error || !data.session) {
        alert("Email ou senha inválidos")
        setLoading(false)
        return
      }

      // 🔥 GARANTE QUE A SESSÃO FOI SETADA
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        alert("Erro ao iniciar sessão. Tente novamente.")
        setLoading(false)
        return
      }

      // 🔐 BUSCA ROLE COM SEGURANÇA
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle()

      if (profileError) {
        console.error("Erro ao buscar perfil:", profileError)
        alert("Erro ao validar usuário")
        setLoading(false)
        return
      }

      if (!profile || profile.role !== "admin") {
        await supabase.auth.signOut()
        alert("Acesso não autorizado")
        setLoading(false)
        return
      }

      // 🔥 REDIRECT FORÇADO (GARANTE COOKIE)
      window.location.href = "/dashboard"

    } catch (err) {
      console.error("Erro inesperado:", err)
      alert("Erro inesperado ao fazer login")
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