"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import {
  Link2,
  Plus,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
  X
} from "lucide-react"

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
    id: "vendedora_2",
    nome: "Vendedora 2"
  },
  {
    id: "sac",
    nome: "SAC"
  },
  {
    id: "automacoes",
    nome: "Automações"
  }
]

function normalizeSessionId(
  value?: string | null
) {
  const clean =
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9_-]/g, "")

  if (!clean) {
    return "principal"
  }

  if (
    clean === "vendedora-1" ||
    clean === "vendedora1" ||
    clean === "vendedor-a1" ||
    clean === "vendedora-a1" ||
    clean === "vendedor_1" ||
    clean === "vendedor1"
  ) {
    return "vendedora_1"
  }

  if (
    clean === "vendedora-2" ||
    clean === "vendedora2" ||
    clean === "vendedor-a2" ||
    clean === "vendedora-a2" ||
    clean === "vendedor_2" ||
    clean === "vendedor2" ||
    clean === "monitoramento"
  ) {
    return "vendedora_2"
  }

  if (
    clean === "automacao" ||
    clean === "automacoes" ||
    clean === "automation" ||
    clean === "automations" ||
    clean === "pedidos" ||
    clean === "status-pedido" ||
    clean === "status_pedido"
  ) {
    return "automacoes"
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

  const [sessionsLoading, setSessionsLoading] =
    useState(true)

  const [errorMessage, setErrorMessage] =
    useState("")

  const [lastSyncAt, setLastSyncAt] =
    useState<Date | null>(null)

  const qrIntervalRef =
    useRef<NodeJS.Timeout | null>(null)

  const statusIntervalRef =
    useRef<NodeJS.Timeout | null>(null)

  const qrTimeoutRef =
    useRef<NodeJS.Timeout | null>(null)

  const sessionsRequestInFlightRef =
    useRef(false)

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
    if (sessionsRequestInFlightRef.current) {
      return
    }

    sessionsRequestInFlightRef.current = true

    try {

      const res =
        await fetch(
          `${API}/sessions`,
          {
            cache: "no-store"
          }
        )

      if (!res.ok) {
        throw new Error(
          `Falha ao atualizar conexões: ${res.status}`
        )
      }

      const data =
        await res.json()

      if (!Array.isArray(data)) {
        throw new Error(
          "A API retornou um formato inesperado para as conexões."
        )
      }

      setSessions(
        normalizeSessions(data)
      )

      setLastSyncAt(
        new Date()
      )

      setErrorMessage("")

    } catch (err) {

      console.error(
        "❌ erro loadSessions:",
        err
      )

      setErrorMessage(
        "Não foi possível atualizar agora. As conexões conhecidas foram mantidas."
      )
    } finally {
      sessionsRequestInFlightRef.current = false
      setSessionsLoading(false)
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

    if (qrTimeoutRef.current) {
      clearTimeout(
        qrTimeoutRef.current
      )

      qrTimeoutRef.current = null
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

    if (
      connectedIds.has(
        selectedSessionId
      )
    ) {
      setErrorMessage(
        "Essa sessão já está conectada. Não é necessário gerar outro QR Code."
      )

      return
    }

    clearAllIntervals()

    setLoading(true)

    setQr(null)
    setErrorMessage("")

    try {

      // =========================
      // CREATE
      // =========================
      const createResponse =
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

      if (!createResponse.ok) {
        throw new Error(
          `Não foi possível iniciar a sessão: ${createResponse.status}`
        )
      }

      // =========================
      // DELAY
      // =========================
      await new Promise(
        r => setTimeout(r, 2000)
      )

      // =========================
      // QR POLLING
      // =========================
      const loadQr =
        async () => {

          try {

            const res =
              await fetch(
                `${API}/sessions/qr/${selectedSessionId}`
              )

            if (!res.ok) {
              return false
            }

            const data =
              await res.json()

            if (data.qr) {
              setQr(currentQr =>
                currentQr === data.qr
                  ? currentQr
                  : data.qr
              )

              setLoading(false)
            }

          } catch {}
        }

      await loadQr()

      qrIntervalRef.current =
        setInterval(
          loadQr,
          5000
        )

      // =========================
      // STATUS POLLING
      // =========================
      const loadStatus =
        async () => {

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

            const currentStatus =
              normalizeStatus(
                data.status
              )

            if (
              currentStatus === "ready" ||
              currentStatus === "connected"
            ) {

              clearAllIntervals()

              setQr(null)

              setShowModal(false)

              setSessionId(
                "principal"
              )

              setLoading(false)

              await loadSessions()

              return true
            }

          } catch {}

          return false
        }

      const alreadyConnected =
        await loadStatus()

      if (alreadyConnected) {
        return
      }

      statusIntervalRef.current =
        setInterval(
          loadStatus,
          3000
        )

      qrTimeoutRef.current =
        setTimeout(() => {
          clearAllIntervals()
          setLoading(false)

          setErrorMessage(
            "O QR Code expirou. Gere um novo código para continuar a conexão."
          )
        }, 120000)

    } catch (err) {

      console.error(
        "❌ erro createSession:",
        err
      )

      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Não foi possível iniciar a conexão."
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

    const interval =
      setInterval(
        loadSessions,
        15000
      )

    function handleVisibilityChange() {
      if (!document.hidden) {
        loadSessions()
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    )

    return () => {
      clearInterval(interval)
      clearAllIntervals()

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      )
    }

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
        <div className={styles["header-copy"]}>
          <span className={styles["header-icon"]}>
            <Link2 size={18} />
          </span>

          <div>
            <span className={styles["header-eyebrow"]}>
              Infraestrutura
            </span>

            <h1>
              Conexões WhatsApp
            </h1>

            <p>
              Acompanhe as sessões sem interromper os números já autenticados.
            </p>
          </div>
        </div>

        <button
          className={
            styles["btn-add"]
          }

          onClick={() => {

            const nextSession =
              idsPermitidos.find(
                option =>
                  !connectedIds.has(
                    option.id
                  )
              )

            setSessionId(
              nextSession?.id ||
                "principal"
            )

            setQr(null)
            setErrorMessage("")

            setShowModal(true)
          }}
          disabled={
            connectedIds.size >=
              idsPermitidos.length
          }
        >
          <Plus size={15} />
          {connectedIds.size >=
          idsPermitidos.length
            ? "Todas conectadas"
            : "Conectar número"}

        </button>

      </div>

      <div className={styles["connection-summary"]}>
        <div>
          <span className={styles["summary-icon"]}>
            <ShieldCheck size={16} />
          </span>

          <div>
            <strong>
              {connectedIds.size} de {idsPermitidos.length} sessões online
            </strong>

            <span>
              {sessionsLoading
                ? "Sincronizando conexões..."
                : "Sessões autenticadas continuam salvas no servidor."}
            </span>
          </div>
        </div>

        <span className={styles["last-sync"]}>
          <RefreshCw size={12} />
          {lastSyncAt
            ? `Atualizado às ${lastSyncAt.toLocaleTimeString(
                "pt-BR",
                {
                  hour: "2-digit",
                  minute: "2-digit"
                }
              )}`
            : "Aguardando atualização"}
        </span>
      </div>

      {errorMessage && !showModal && (
        <div className={styles["connection-alert"]}>
          {errorMessage}
        </div>
      )}

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

            <Smartphone size={26} />

            <strong>
              Nenhum número conectado
            </strong>

            <p>
              Conecte uma sessão para começar o atendimento.
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

                <Smartphone size={11} />
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
                <Trash2 size={14} />
                Remover conexão

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
              Vincular aparelho
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
                    disabled={
                      connectedIds.has(
                        opt.id
                      )
                    }
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
                <QrCode size={16} />
                {loading
                  ? "Preparando conexão..."
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
                  No celular, abra WhatsApp, vá em Aparelhos conectados
                  e toque em Conectar um aparelho.
                </p>

                <small>
                  O código é atualizado automaticamente enquanto esta janela estiver aberta.
                </small>

              </div>
            )}

            {errorMessage && (
              <div className={styles["modal-alert"]}>
                {errorMessage}
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
              <X size={14} />
              Fechar

            </button>

          </div>

        </div>
      )}

    </div>
  )
}
