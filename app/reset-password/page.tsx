"use client"

import {
  useEffect,
  useState
} from "react"

import {
  useRouter,
  useSearchParams
} from "next/navigation"

import Image from "next/image"

import { createClient }
from "@/lib/supabase/client"

import styles
from "./reset-password.module.css"

export default function ResetPassword() {

  const supabase =
    createClient()

  const router =
    useRouter()

  const searchParams =
    useSearchParams()

  const [password, setPassword] =
    useState("")

  const [
    confirmPassword,
    setConfirmPassword
  ] = useState("")

  const [loading, setLoading] =
    useState(false)

  const [error, setError] =
    useState("")

  const [success, setSuccess] =
    useState(false)

  const [validating, setValidating] =
    useState(true)

  // =========================================
  // RECOVERY SESSION
  // =========================================
  useEffect(() => {

    async function loadSession() {

      try {

        const code =
          searchParams.get("code")

        // =========================================
        // EXCHANGE CODE
        // =========================================
        if (code) {

          const { error } =
            await supabase.auth.exchangeCodeForSession(
              code
            )

          if (error) {

            console.error(
              "❌ erro exchange:",
              error
            )

            setError(
              "Link inválido ou expirado."
            )

            setValidating(false)

            return
          }
        }

        // =========================================
        // VALIDATE SESSION
        // =========================================
        const {
          data: { session }
        } = await supabase.auth.getSession()

        if (!session) {

          setError(
            "Sessão inválida ou expirada."
          )

          setValidating(false)

          return
        }

        setValidating(false)

      } catch (err) {

        console.error(err)

        setError(
          "Erro ao validar acesso."
        )

        setValidating(false)
      }

    }

    loadSession()

  }, [])

  // =========================================
  // SAVE PASSWORD
  // =========================================
  async function handleReset() {

    setError("")

    if (password.length < 6) {

      return setError(
        "A senha precisa ter no mínimo 6 caracteres"
      )
    }

    if (
      password !== confirmPassword
    ) {

      return setError(
        "As senhas não coincidem"
      )
    }

    setLoading(true)

    try {

      const { error } =
        await supabase.auth.updateUser({

          password
        })

      if (error) {

        console.error(error)

        setError(
          error.message ||
          "Erro ao salvar senha"
        )

        setLoading(false)

        return
      }

      setSuccess(true)

      setTimeout(() => {

        router.push("/login")

      }, 2000)

    } catch (err) {

      console.error(err)

      setError(
        "Erro inesperado"
      )

    } finally {

      setLoading(false)
    }
  }

  // =========================================
  // LOADING
  // =========================================
  if (validating) {

    return (
      <div className={styles.container}>
        <div className={styles.card}>
          Validando acesso...
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
            Crie sua nova senha
          </p>

        </div>

        {success ? (

          <div className={styles.success}>
            Senha criada com sucesso 🎉
          </div>

        ) : (

          <div className={styles.form}>

            <div className={styles.inputGroup}>

              <label>
                Nova senha
              </label>

              <input
                type="password"
                placeholder="Digite sua senha"
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
                  setConfirmPassword(
                    e.target.value
                  )
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
              onClick={handleReset}
              disabled={loading}
            >

              {loading
                ? "Salvando..."
                : "Salvar senha"}

            </button>

          </div>
        )}

      </div>

    </div>
  )
}