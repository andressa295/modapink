"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Image from "next/image"
import styles from "./reset-password.module.css"

export default function ResetPassword() {
  const supabase = createClient()

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const router = useRouter()

  async function handleReset() {
    setError("")

    // validações
    if (password.length < 6) {
      return setError("A senha precisa ter no mínimo 6 caracteres")
    }

    if (password !== confirmPassword) {
      return setError("As senhas não coincidem")
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password
      })

      if (error) {
        setError("Erro ao definir senha. Tente novamente.")
        setLoading(false)
        return
      }

      setSuccess(true)

      setTimeout(() => {
        router.push("/login")
      }, 1500)

    } catch (err) {
      console.error("Erro reset:", err)
      setError("Erro inesperado")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>

        <div className={styles.header}>
          <div className={styles.logoArea}>
            <Image
              src="/logo.png"
              alt="Moda Pink"
              width={140}
              height={140}
              priority
            />
          </div>
          <p>Crie sua nova senha para acessar sua conta</p>
        </div>

        {success ? (
          <div className={styles.success}>
            Senha criada com sucesso! 🎉
          </div>
        ) : (
          <div className={styles.form}>

            <div className={styles.inputGroup}>
              <label>Nova senha</label>
              <input
                type="password"
                placeholder="Digite sua nova senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Confirmar senha</label>
              <input
                type="password"
                placeholder="Confirme sua senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {error && <span className={styles.error}>{error}</span>}

            <button
              className={styles.button}
              onClick={handleReset}
              disabled={loading}
            >
              {loading ? "Salvando..." : "Salvar senha"}
            </button>

          </div>
        )}

      </div>
    </div>
  )
}