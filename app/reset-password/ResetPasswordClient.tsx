"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const alreadyValidated = useRef(false)

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    async function validateLink() {
      if (alreadyValidated.current) {
        return
      }

      alreadyValidated.current = true

      try {
        if (errorParam) {
          setError(
            errorDescription ||
              "Link inválido ou expirado. Peça um novo link de acesso."
          )

          setValidating(false)
          return
        }

        const currentUrl =
          typeof window !== "undefined"
            ? new URL(window.location.href)
            : null

        const searchParams =
          currentUrl?.searchParams

        const hashParams =
          currentUrl?.hash
            ? new URLSearchParams(
                currentUrl.hash.replace("#", "")
              )
            : null

        const recoveryCode =
          code ||
          searchParams?.get("code") ||
          undefined

        const accessToken =
          hashParams?.get("access_token") ||
          searchParams?.get("access_token")

        const refreshToken =
          hashParams?.get("refresh_token") ||
          searchParams?.get("refresh_token")

        const tokenHash =
          searchParams?.get("token_hash") ||
          hashParams?.get("token_hash")

        const type =
          searchParams?.get("type") ||
          hashParams?.get("type")

        // =========================
        // CASO 1: Supabase voltou com ?code=
        // =========================
        if (recoveryCode) {
          const {
            data,
            error: exchangeError
          } = await supabase.auth.exchangeCodeForSession(
            recoveryCode
          )

          if (exchangeError) {
            console.error("Erro exchange:", exchangeError)

            setError(
              `Erro ao validar link: ${exchangeError.message}`
            )

            setValidating(false)
            return
          }

          if (!data.session) {
            setError(
              "O link foi aberto, mas a sessão não foi criada. Gere um novo link."
            )

            setValidating(false)
            return
          }

          setHasSession(true)
          setValidating(false)

          window.history.replaceState(
            {},
            document.title,
            "/reset-password"
          )

          return
        }

        // =========================
        // CASO 2: Supabase voltou com #access_token=
        // =========================
        if (accessToken && refreshToken) {
          const {
            data,
            error: sessionError
          } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          })

          if (sessionError) {
            console.error("Erro setSession:", sessionError)

            setError(
              `Erro ao validar sessão: ${sessionError.message}`
            )

            setValidating(false)
            return
          }

          if (!data.session) {
            setError(
              "A sessão não foi criada. Gere um novo link de acesso."
            )

            setValidating(false)
            return
          }

          setHasSession(true)
          setValidating(false)

          window.history.replaceState(
            {},
            document.title,
            "/reset-password"
          )

          return
        }

        // =========================
        // CASO 3: Supabase voltou com token_hash
        // =========================
        if (tokenHash) {
          const {
            data,
            error: verifyError
          } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type:
              type === "invite"
                ? "invite"
                : "recovery"
          })

          if (verifyError) {
            console.error("Erro verifyOtp:", verifyError)

            setError(
              `Erro ao validar link: ${verifyError.message}`
            )

            setValidating(false)
            return
          }

          if (!data.session) {
            setError(
              "Link validado, mas a sessão não foi criada. Gere um novo link."
            )

            setValidating(false)
            return
          }

          setHasSession(true)
          setValidating(false)

          window.history.replaceState(
            {},
            document.title,
            "/reset-password"
          )

          return
        }

        // =========================
        // CASO 4: já existe sessão
        // =========================
        const {
          data: { session },
          error: sessionError
        } = await supabase.auth.getSession()

        if (sessionError) {
          console.error("Erro getSession:", sessionError)

          setError(
            `Erro ao buscar sessão: ${sessionError.message}`
          )

          setValidating(false)
          return
        }

        if (session) {
          setHasSession(true)
        } else {
          setError(
            "Link inválido ou expirado. Peça um novo link de acesso."
          )
        }

        setValidating(false)
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
    supabase
  ])

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

      const {
        data: userData,
        error: userError
      } = await supabase.auth.getUser()

      if (userError || !userData.user) {
        console.error(
          "Erro getUser antes de salvar senha:",
          userError
        )

        setError(
          userError?.message ||
            "Sessão inválida antes de salvar a senha. Gere um novo link."
        )

        return
      }

      const {
        error: updateError
      } = await supabase.auth.updateUser({
        password
      })

      if (updateError) {
        console.error("Erro update:", updateError)

        setError(
          `Erro ao definir senha: ${updateError.message}`
        )

        return
      }

      await supabase.auth.signOut()

      setSuccess(true)

      setTimeout(() => {
        router.push("/login")
      }, 1800)
    } catch (err) {
      console.error("Erro reset:", err)

      setError("Erro inesperado ao salvar senha.")
    } finally {
      setLoading(false)
    }
  }

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

          <p>
            Crie sua nova senha para acessar sua conta
          </p>
        </div>

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

            {error && (
              <span className={styles.error}>
                {error}
              </span>
            )}

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