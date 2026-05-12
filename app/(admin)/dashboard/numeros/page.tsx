"use client"

import { useEffect, useRef, useState } from "react"

import styles from "../styles/numeros.module.css"

type Session = {
  id: string
  status: "connecting" | "ready" | "disconnected"
  phone?: string
}

const API = process.env.NEXT_PUBLIC_API_URL!

export default function Numeros() {

  const [sessions, setSessions] =
    useState<Session[]>([])

  const [showModal, setShowModal] =
    useState(false)

  const [sessionId, setSessionId] =
    useState("principal")

  const [qr, setQr] =
    useState<string | null>(null)

  const [loading, setLoading] =
    useState(false)

  // =========================
  // IDs
  // =========================
  const idsPermitidos = [

    {
      id: "principal",
      nome: "Bot Principal"
    },

    {
      id: "vendedora-1",
      nome: "Vendedora 1"
    },

    {
      id: "vendedora-2",
      nome: "Vendedora 2"
    },

    {
      id: "vendedora-3",
      nome: "Vendedora 3"
    },

  ]

  const qrIntervalRef =
    useRef<NodeJS.Timeout | null>(null)

  const statusIntervalRef =
    useRef<NodeJS.Timeout | null>(null)

  // =========================
  // LOAD SESSIONS
  // =========================
  async function loadSessions() {

    try {

      const res = await fetch(
        `${API}/sessions`,
        {
          cache: "no-store"
        }
      )

      const data = await res.json()

      setSessions(
        Array.isArray(data)
          ? data
          : []
      )

    } catch (err) {

      console.error(
        "❌ erro loadSessions:",
        err
      )

      setSessions([])
    }
  }

  // =========================
  // CLEAR INTERVALS
  // =========================
  function clearAllIntervals() {

    if (qrIntervalRef.current) {

      clearInterval(
        qrIntervalRef.current
      )

      qrIntervalRef.current = null
    }

    if (statusIntervalRef.current) {

      clearInterval(
        statusIntervalRef.current
      )

      statusIntervalRef.current = null
    }
  }

  // =========================
  // CREATE SESSION
  // =========================
  async function createSession() {

    if (!sessionId || loading) {
      return
    }

    clearAllIntervals()

    setLoading(true)

    setQr(null)

    try {

      // =========================
      // CREATE
      // =========================
      await fetch(
        `${API}/sessions/create`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            sessionId
          })
        }
      )

      // =========================
      // DELAY
      // =========================
      await new Promise(
        r => setTimeout(r, 2000)
      )

      // =========================
      // QR POLLING
      // =========================
      qrIntervalRef.current =
        setInterval(async () => {

          try {

            const res = await fetch(
              `${API}/sessions/qr/${sessionId}`
            )

            if (!res.ok) {
              return
            }

            const data =
              await res.json()

            if (data.qr) {

              setQr(data.qr)

              setLoading(false)

              if (
                qrIntervalRef.current
              ) {

                clearInterval(
                  qrIntervalRef.current
                )
              }
            }

          } catch {}
        }, 2000)

      // =========================
      // STATUS POLLING
      // =========================
      statusIntervalRef.current =
        setInterval(async () => {

          try {

            const res = await fetch(
              `${API}/sessions/status/${sessionId}`
            )

            if (!res.ok) {
              return
            }

            const data =
              await res.json()

            if (
              data.status === "ready"
            ) {

              clearAllIntervals()

              setQr(null)

              setShowModal(false)

              setSessionId(
                "principal"
              )

              loadSessions()
            }

          } catch {}

        }, 3000)

    } catch (err) {

      console.error(
        "❌ erro createSession:",
        err
      )

      setLoading(false)
    }
  }

  // =========================
  // REMOVE SESSION
  // =========================
  async function removeSession(
    id: string
  ) {

    const confirmDelete =
      confirm(
        `Deseja desconectar e remover a sessão: ${id}?`
      )

    if (!confirmDelete) {
      return
    }

    try {

      await fetch(
        `${API}/sessions/${id}`,
        {
          method: "DELETE"
        }
      )

      loadSessions()

    } catch (err) {

      console.error(
        "❌ erro removeSession:",
        err
      )
    }
  }

  // =========================
  // INIT
  // =========================
  useEffect(() => {

    loadSessions()

    return () =>
      clearAllIntervals()

  }, [])

  return (

    <div
      className={
        styles["numbers-page"]
      }
    >

      {/* HEADER */}
      <div
        className={
          styles["numbers-header"]
        }
      >

        <h1>
          Conexões WhatsApp
        </h1>

        <button
          className={
            styles["btn-add"]
          }

          onClick={() =>
            setShowModal(true)
          }
        >

          + Conectar novo número

        </button>

      </div>

      {/* GRID */}
      <div
        className={
          styles["numbers-grid"]
        }
      >

        {sessions.length === 0 && (

          <div
            className={
              styles["empty-state"]
            }
          >

            <p>
              Nenhum número conectado no momento.
            </p>

          </div>
        )}

        {sessions.map((s) => (

          <div
            key={s.id}

            className={
              styles.card
            }
          >

            {/* CARD HEADER */}
            <div
              className={
                styles["card-header"]
              }
            >

              <span
                className={
                  styles.badge
                }
              >

                Sessão

              </span>

              <h3>
                {s.id.toUpperCase()}
              </h3>

            </div>

            {/* CARD BODY */}
            <div
              className={
                styles["card-body"]
              }
            >

              <p
                className={
                  styles.phone
                }
              >

                {s.phone ||
                  "Número não identificado"}

              </p>

              <div
                className={`
                  ${styles["status-indicator"]}
                  ${styles[s.status]}
                `}
              >

                {s.status === "ready" && (
                  <span>
                    🟢 Online
                  </span>
                )}

                {s.status === "connecting" && (
                  <span>
                    🟡 Aguardando QR Code
                  </span>
                )}

                {s.status === "disconnected" && (
                  <span>
                    🔴 Desconectado
                  </span>
                )}

              </div>

            </div>

            {/* CARD FOOTER */}
            <div
              className={
                styles["card-footer"]
              }
            >

              <button
                className={
                  styles["btn-delete"]
                }

                onClick={() =>
                  removeSession(s.id)
                }
              >

                Remover Conexão

              </button>

            </div>

          </div>
        ))}

      </div>

      {/* MODAL */}
      {showModal && (

        <div
          className={
            styles["modal-overlay"]
          }
        >

          <div
            className={
              styles["modal-content"]
            }
          >

            <h2>
              Vincular Novo Aparelho
            </h2>

            <p>
              Selecione quem será o dono desta conexão:
            </p>

            <select

              value={sessionId}

              onChange={(e) =>
                setSessionId(
                  e.target.value
                )
              }

              className={
                styles["select-session"]
              }

              disabled={
                loading ||
                qr !== null
              }
            >

              {idsPermitidos.map(
                (opt) => (

                  <option
                    key={opt.id}
                    value={opt.id}
                  >

                    {opt.nome}

                  </option>
                )
              )}

            </select>

            {!qr && (

              <button

                className={
                  styles["btn-primary"]
                }

                onClick={
                  createSession
                }

                disabled={loading}
              >

                {loading
                  ? "Iniciando Puppeteer..."
                  : "Gerar QR Code"}

              </button>
            )}

            {qr && (

              <div
                className={
                  styles["qr-container"]
                }
              >

                <img
                  src={qr}
                  alt="WhatsApp QR Code"
                />

                <p>
                  Abra o WhatsApp {" > "}
                  Aparelhos Conectados {" > "}
                  Conectar um aparelho
                </p>

              </div>
            )}

            <button

              className={
                styles["btn-close"]
              }

              onClick={() => {

                clearAllIntervals()

                setShowModal(false)

                setQr(null)

                setSessionId(
                  "principal"
                )
              }}
            >

              Cancelar e Fechar

            </button>

          </div>

        </div>
      )}

    </div>
  )
}