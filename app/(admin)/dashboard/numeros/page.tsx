"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import styles from "../styles/numeros.module.css"

type SessionStatus =
  | "connecting"
  | "initializing"
  | "qr"
  | "authenticated"
  | "ready"
  | "connected"
  | "disconnected"
  | "auth_failure"
  | "error"

type Session = {
  id: string
  rawId?: string
  status: SessionStatus
  phone?: string | null
}

type SessionOption = {
  id: string
  nome: string
}

const API = process.env.NEXT_PUBLIC_API_URL!

const idsPermitidos: SessionOption[] = [
  {
    id: "principal",
    nome: "Número principal"
  },
  {
    id: "vendedora_1",
    nome: "Vendedora 1"
  },
  {
    id: "sac",
    nome: "SAC"
  }
]

function normalizeSessionId(
  value?: string | null
) {
  const clean =
    String(value || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9_-]/g, "")

  if (!clean) {
    return "principal"
  }

  if (
    clean === "vendedora-1" ||
    clean === "vendedora1"
  ) {
    return "vendedora_1"
  }

  if (
    clean.startsWith("sac")
  ) {
    return "sac"
  }

  return clean
}

function getSessionName(
  id: string
) {
  const normalized =
    normalizeSessionId(id)

  return (
    idsPermitidos.find(
      item => item.id === normalized
    )?.nome || normalized
  )
}

function normalizeStatus(
  status?: string | null
): SessionStatus {
  const value =
    String(status || "disconnected")
      .toLowerCase()
      .trim()

  if (
    value === "connected"
  ) {
    return "ready"
  }

  if (
    [
      "connecting",
      "initializing",
      "qr",
      "authenticated",
      "ready",
      "disconnected",
      "auth_failure",
      "error"
    ].includes(value)
  ) {
    return value as SessionStatus
  }

  return "disconnected"
}

function getStatusClass(
  status: SessionStatus
) {
  if (
    status === "ready" ||
    status === "connected"
  ) {
    return styles.ready
  }

  if (
    status === "connecting" ||
    status === "initializing" ||
    status === "qr" ||
    status === "authenticated"
  ) {
    return styles.connecting
  }

  return styles.disconnected
}

function getStatusText(
  status: SessionStatus
) {
  if (
    status === "ready" ||
    status === "connected"
  ) {
    return "🟢 Online"
  }

  if (
    status === "initializing"
  ) {
    return "🟡 Iniciando sessão"
  }

  if (
    status === "qr" ||
    status === "connecting"
  ) {
    return "🟡 Aguardando QR Code"
  }

  if (
    status === "authenticated"
  ) {
    return "🟡 Autenticado, conectando..."
  }

  if (
    status === "auth_failure"
  ) {
    return "🔴 Falha na autenticação"
  }

  if (
    status === "error"
  ) {
    return "🔴 Erro na conexão"
  }

  return "🔴 Desconectado"
}

function formatPhone(
  phone?: string | null
) {
  if (!phone) {
    return "Número não identificado"
  }

  return String(phone)
    .replace("@c.us", "")
    .replace("@lid", "")
}

function normalizeSessions(
  data: any[]
) {
  const map =
    new Map<string, Session>()

  data.forEach((item: any) => {
    const rawId =
      String(item?.id || item?.session_key || "")

    const id =
      normalizeSessionId(rawId)

    const session: Session = {
      id,
      rawId:
        rawId || id,
      status:
        normalizeStatus(item?.status),
      phone:
        item?.phone || null
    }

    const existing =
      map.get(id)

    if (!existing) {
      map.set(id, session)
      return
    }

    const shouldReplace =
      (
        session.status === "ready" &&
        existing.status !== "ready"
      ) ||
      (
        !existing.phone &&
        Boolean(session.phone)
      )

    if (shouldReplace) {
      map.set(id, session)
    }
  })

  const ordered =
    idsPermitidos
      .map(option => map.get(option.id))
      .filter(Boolean) as Session[]

  const others =
    Array.from(map.values())
      .filter(session =>
        !idsPermitidos.some(
          option => option.id === session.id
        )
      )

  return [
    ...ordered,
    ...others
  ]
}

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

  const qrIntervalRef =
    useRef<NodeJS.Timeout | null>(null)

  const statusIntervalRef =
    useRef<NodeJS.Timeout | null>(null)

  const connectedIds =
    useMemo(
      () =>
        new Set(
          sessions
            .filter(session =>
              session.status === "ready" ||
              session.status === "connected"
            )
            .map(session => session.id)
        ),
      [sessions]
    )

  // =========================
  // LOAD SESSIONS
  // =========================
  async function loadSessions() {

    try {

      const res =
        await fetch(
          `${API}/sessions`,
          {
            cache: "no-store"
          }
        )

      const data =
        await res.json()

      setSessions(
        Array.isArray(data)
          ? normalizeSessions(data)
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

    const selectedSessionId =
      normalizeSessionId(sessionId)

    if (
      !selectedSessionId ||
      loading
    ) {
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
            sessionId:
              selectedSessionId
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

            const res =
              await fetch(
                `${API}/sessions/qr/${selectedSessionId}`
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

                qrIntervalRef.current = null
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

            const res =
              await fetch(
                `${API}/sessions/status/${selectedSessionId}`
              )

            if (!res.ok) {
              return
            }

            const data =
              await res.json()

            if (
              data.status === "ready" ||
              data.status === "connected"
            ) {

              clearAllIntervals()

              setQr(null)

              setShowModal(false)

              setSessionId(
                "principal"
              )

              setLoading(false)

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
    id: string,
    rawId?: string
  ) {

    const normalizedId =
      normalizeSessionId(id)

    const deleteId =
      rawId || normalizedId

    const confirmDelete =
      confirm(
        `Deseja desconectar e remover a sessão: ${getSessionName(normalizedId)}?`
      )

    if (!confirmDelete) {
      return
    }

    try {

      await fetch(
        `${API}/sessions/${deleteId}`,
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

          onClick={() => {

            setSessionId(
              "principal"
            )

            setQr(null)

            setShowModal(true)
          }}
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
                {getSessionName(s.id)}
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

                {formatPhone(s.phone)}

              </p>

              <div
                className={`
                  ${styles["status-indicator"]}
                  ${getStatusClass(s.status)}
                `}
              >

                <span>
                  {getStatusText(s.status)}
                </span>

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
                  removeSession(
                    s.id,
                    s.rawId
                  )
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
                  normalizeSessionId(
                    e.target.value
                  )
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
                    {connectedIds.has(opt.id)
                      ? " — conectado"
                      : ""}

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

                setLoading(false)

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
