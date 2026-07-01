"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"

import { createClient } from "@/lib/supabase/client"

import styles from "./reset-password.module.css"

type Props = {
  code?: string
  errorParam?: string
  errorDescription?: string
}

export default function ResetPasswordClient({
  code,
  errorParam,
  errorDescription
}: Props) {
  const supabase = createClient()
  const router = useRouter()

  // =========================
  // STATES
  // =========================
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [hasSession, setHasSession] = useState(false)

  // =========================
  // VALIDATE LINK
  // =========================
  useEffect(() => {
    async function validateLink() {
      try {
        // Se o Supabase voltou com erro na URL
        if (errorParam) {
          setError(
            errorDescription ||
              "Link inválido ou expirado. Peça um novo link de acesso."
          )

          setValidating(false)
          return
        }

        let recoveryCode = code

        // Garantia extra: se o code não veio pelo server component,
        // tenta pegar direto da URL no navegador.
        if (!recoveryCode && typeof window !== "undefined") {
          const url = new URL(window.location.href)

          recoveryCode =
            url.searchParams.get("code") || undefined
        }

        // Se não tem code, verifica se já existe sessão ativa.
        if (!recoveryCode) {
          const {
            data: { session }
          } = await supabase.auth.getSession()

          if (session) {
            setHasSession(true)
          } else {
            setError(
              "Link inválido ou expirado. Peça um novo link de acesso."
            )
          }

          setValidating(false)
          return
        }

        // Troca o code por uma sessão válida.
        const { error } =
          await supabase.auth.exchangeCodeForSession(
            recoveryCode
          )

        if (error) {
          console.error("Erro exchange:", error)

          setError(
            "Link inválido ou expirado. Peça um novo link de acesso."
          )

          setValidating(false)
          return
        }

        setHasSession(true)
        setValidating(false)

        // Remove o code da URL depois de validar.
        window.history.replaceState(
          {},
          document.title,
          "/reset-password"
        )
      } catch (err) {
        console.error("Erro validateLink:", err)

        setError("Erro ao validar link.")
        setValidating(false)
      }
    }

    validateLink()
  }, [
    code,
    errorParam,
    errorDescription,
    supabase.auth
  ])

  // =========================
  // RESET PASSWORD
  // =========================
  async function handleReset() {
    setError("")

    if (!hasSession) {
      setError(
        "Sessão inválida. Peça um novo link de acesso."
      )

      return
    }

    if (password.length < 6) {
      setError(
        "A senha precisa ter no mínimo 6 caracteres"
      )

      return
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem")
      return
    }

    try {
      setLoading(true)

      const { error } =
        await supabase.auth.updateUser({
          password
        })

      if (error) {
        console.error("Erro update:", error)

        setError(
          "Erro ao definir senha. Tente novamente."
        )

        return
      }

      // Depois de criar senha, sai da sessão temporária
      // e manda para o login normal.
      await supabase.auth.signOut()

      setSuccess(true)

      setTimeout(() => {
        router.push("/login")
      }, 1800)
    } catch (err) {
      console.error("Erro reset:", err)

      setError("Erro inesperado")
    } finally {
      setLoading(false)
    }
  }

  // =========================
  // VALIDATING
  // =========================
  if (validating) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.loading}>
            Validando link...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* HEADER */}
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

          <h1>
            Criar senha
          </h1>

          <p>
            Defina sua senha para acessar o painel Moda Pink.
          </p>
        </div>

        {/* SUCCESS */}
        {success ? (
          <div className={styles.success}>
            Senha criada com sucesso! Você será redirecionado para o login.
          </div>
        ) : !hasSession ? (
          <div className={styles.form}>
            <span className={styles.error}>
              {error ||
                "Link inválido ou expirado. Peça um novo link de acesso."}
            </span>

            <button
              className={styles.button}
              type="button"
              onClick={() => router.push("/login")}
            >
              Voltar para o login
            </button>
          </div>
        ) : (
          <div className={styles.form}>
            {/* PASSWORD */}
            <div className={styles.inputGroup}>
              <label>
                Nova senha
              </label>

              <input
                type="password"
                placeholder="Digite sua nova senha"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
              />
            </div>

            {/* CONFIRM */}
            <div className={styles.inputGroup}>
              <label>
                Confirmar senha
              </label>

              <input
                type="password"
                placeholder="Confirme sua senha"
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword(e.target.value)
                }
              />
            </div>

            {/* ERROR */}
            {error && (
              <span className={styles.error}>
                {error}
              </span>
            )}

            {/* BUTTON */}
            <button
              className={styles.button}
              type="button"
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