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

import { createClient } from "@/lib/supabase/client"

import styles from "./reset-password.module.css"

export default function ResetPassword() {

  const supabase =
    createClient()

  const router =
    useRouter()

  const searchParams =
    useSearchParams()

  // =========================
  // STATES
  // =========================
  const [

    password,

    setPassword

  ] = useState("")

  const [

    confirmPassword,

    setConfirmPassword

  ] = useState("")

  const [

    loading,

    setLoading

  ] = useState(false)

  const [

    validating,

    setValidating

  ] = useState(true)

  const [

    error,

    setError

  ] = useState("")

  const [

    success,

    setSuccess

  ] = useState(false)

  // =========================
  // EXCHANGE CODE SESSION
  // =========================
  useEffect(() => {

    async function validateRecovery() {

      try {

        const code =
          searchParams.get("code")

        // 🔥 sem code
        if (!code) {

          setError(
            "Link inválido ou expirado."
          )

          setValidating(false)

          return
        }

        // 🔥 cria sessão recovery
        const { error } =

          await supabase
            .auth
            .exchangeCodeForSession(
              code
            )

        if (error) {

          console.error(
            "Erro exchange:",
            error
          )

          setError(
            "Link inválido ou expirado."
          )
        }

      } catch (err) {

        console.error(
          "Erro validateRecovery:",
          err
        )

        setError(
          "Erro ao validar link."
        )

      } finally {

        setValidating(false)
      }
    }

    validateRecovery()

  }, [searchParams, supabase])

  // =========================
  // RESET PASSWORD
  // =========================
  async function handleReset() {

    setError("")

    // 🔥 validações
    if (password.length < 6) {

      setError(
        "A senha precisa ter no mínimo 6 caracteres"
      )

      return
    }

    if (
      password !==
      confirmPassword
    ) {

      setError(
        "As senhas não coincidem"
      )

      return
    }

    try {

      setLoading(true)

      // 🔥 update password
      const { error } =

        await supabase
          .auth
          .updateUser({

            password
          })

      if (error) {

        console.error(
          "Erro update:",
          error
        )

        setError(
          "Erro ao definir senha. Tente novamente."
        )

        return
      }

      // 🔥 sucesso
      setSuccess(true)

      setTimeout(() => {

        router.push("/login")

      }, 2000)

    } catch (err) {

      console.error(
        "Erro reset:",
        err
      )

      setError(
        "Erro inesperado"
      )

    } finally {

      setLoading(false)
    }
  }

  // =========================
  // LOADING
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

          <p>

            Crie sua nova senha
            para acessar sua conta

          </p>

        </div>

        {/* SUCCESS */}
        {success ? (

          <div className={styles.success}>

            Senha criada com sucesso! 🎉

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

                  setPassword(
                    e.target.value
                  )
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

                  setConfirmPassword(
                    e.target.value
                  )
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