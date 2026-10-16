"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import {
  Plus,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X
} from "lucide-react"

import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon"

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

const WHATSAPP_RUNTIME_API =
  "/api/whatsapp/runtime"

const idsPermitidos: SessionOption[] = [
  {
    id: "principal",
    nome: "Atendimento automático 1"
  },
  {
    id: "vendedora_1",
    nome: "Atendimento automático 2"
  },
  {
    id: "vendedora_2",
    nome: "Vendedora"
  },
  {
    id: "sac",
    nome: "SAC"
  },
  {
    id: "automacoes",
    nome: "Automações"
  },
  {
    id: "teste",
    nome: "Teste · vendas com fotos"
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
    return "Online"
  }

  if (
    status === "initializing"
  ) {
    return "Iniciando sessão"
  }

  if (
    status === "qr" ||
    status === "connecting"
  ) {
    return "Aguardando QR Code"
  }

  if (
    status === "authenticated"
  ) {
    return "Autenticado, conectando..."
  }

  if (
    status === "auth_failure"
  ) {
    return "Falha na autenticação"
  }

  if (
    status === "error"
  ) {
    return "Erro na conexão"
  }

  return "Desconectado"
}

function formatPhone(
  phone?: string | null
) {
  const value =
    getSessionPhone(phone)

  if (!value) {
    return "Número não identificado"
  }

  if (
    value.startsWith("55") &&
    value.length === 13
  ) {
    return `+55 (${value.slice(2, 4)}) ${value.slice(4, 9)}-${value.slice(9)}`
  }

  if (
    value.startsWith("55") &&
    value.length === 12
  ) {
    return `+55 (${value.slice(2, 4)}) ${value.slice(4, 8)}-${value.slice(8)}`
  }

  return `+${value}`
}

function getSessionPhone(
  value: any
): string | null {
  const candidates =
    value && typeof value === "object"
      ? [
          value.phone,
          value.phone_number,
          value.phoneNumber,
          value.number,
          value.wid,
          value.me,
          value.info?.wid,
          value.info?.me
        ]
      : [value]

  for (const candidate of candidates) {
    const serialized =
      typeof candidate === "object" && candidate
        ? (
            candidate._serialized ||
            candidate.$1 ||
            (
              candidate.user && candidate.server
                ? `${candidate.user}@${candidate.server}`
                : candidate.user
            )
          )
        : candidate

    const raw =
      String(serialized || "")
        .trim()

    if (
      !raw ||
      /@lid(?:$|:)/i.test(raw)
    ) {
      continue
    }

    const digits =
      raw
        .split("@")[0]
        .split(":")[0]
        .replace(/\D+/g, "")

    if (
      digits.length >= 10 &&
      digits.length <= 15
    ) {
      return digits
    }
  }

  return null
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
        getSessionPhone(item)
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

    map.set(
      id,
      {
        id,
        rawId:
          shouldReplace
            ? session.rawId
            : existing.rawId,
        status:
          shouldReplace
            ? session.status
            : existing.status,
        phone:
          session.phone ||
          existing.phone ||
          null
      }
    )
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

  const [finishingConnection, setFinishingConnection] =
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

  const connectButtonRef = useRef<HTMLButtonElement | null>(null)
  const connectionDialogRef = useRef<HTMLDivElement | null>(null)

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

      const savedSessionsRequest =
        fetch(
          "/api/whatsapp/session",
          {
            cache: "no-store"
          }
        ).catch(() => null)

      const res =
        await fetch(
          `${WHATSAPP_RUNTIME_API}/sessions`,
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

      const savedSessionsResponse =
        await savedSessionsRequest

      const savedSessions =
        savedSessionsResponse?.ok
          ? await savedSessionsResponse
              .json()
              .catch(() => [])
          : []

      const savedPhones =
        new Map<string, string>()

      if (Array.isArray(savedSessions)) {
        savedSessions.forEach((item: any) => {
          const id =
            normalizeSessionId(
              item?.session_key ||
              item?.session_id ||
              item?.id
            )

          const phone =
            getSessionPhone(item)

          if (id && phone) {
            savedPhones.set(id, phone)
          }
        })
      }

      const enrichedSessions =
        data.map((item: any) => {
          const id =
            normalizeSessionId(
              item?.id ||
              item?.session_key
            )

          return {
            ...item,
            phone:
              getSessionPhone(item) ||
              savedPhones.get(id) ||
              null
          }
        })

      const normalizedSessions =
        normalizeSessions(
          enrichedSessions
        )

      setSessions(currentSessions => {
        const currentPhones =
          new Map(
            currentSessions
              .filter(item => item.phone)
              .map(item => [
                item.id,
                item.phone as string
              ])
          )

        return normalizedSessions.map(item => ({
          ...item,
          phone:
            item.phone ||
            currentPhones.get(item.id) ||
            null
        }))
      })

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
    setFinishingConnection(false)

    setQr(null)
    setErrorMessage("")

    try {

      // =========================
      // CREATE
      // =========================
      const createResponse =
        await fetch(
          `${WHATSAPP_RUNTIME_API}/sessions/create`,
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
        r => setTimeout(r, 300)
      )

      // =========================
      // QR POLLING
      // =========================
      const loadQr =
        async () => {

          try {

            const res =
              await fetch(
                `${WHATSAPP_RUNTIME_API}/sessions/qr/${selectedSessionId}?t=${Date.now()}`,
                {
                  cache: "no-store"
                }
              )

            if (!res.ok) {
              return false
            }

            const data =
              await res.json()

            if (data.qr) {
              setFinishingConnection(false)

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
          700
        )

      // =========================
      // STATUS POLLING
      // =========================
      const loadStatus =
        async () => {

          try {

            const res =
              await fetch(
                `${WHATSAPP_RUNTIME_API}/sessions/status/${selectedSessionId}?t=${Date.now()}`,
                {
                  cache: "no-store"
                }
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
              currentStatus === "authenticated"
            ) {
              // O QR já foi aceito pelo celular, mas o WhatsApp Web ainda
              // precisa terminar de carregar. Não feche o modal nem anuncie
              // a conexão antes de a sessão realmente chegar em ready.
              if (qrIntervalRef.current) {
                clearInterval(
                  qrIntervalRef.current
                )

                qrIntervalRef.current = null
              }

              setQr(null)
              setLoading(true)
              setFinishingConnection(true)

              return false
            }

            if (
              currentStatus === "ready" ||
              currentStatus === "connected"
            ) {

              // A leitura do QR já terminou. O modal não deve continuar
              // aberto enquanto o WhatsApp finaliza a sessão em segundo plano.
              clearAllIntervals()

              setQr(null)
              setErrorMessage("")
              setShowModal(false)

              setSessionId(
                "principal"
              )

              setLoading(false)
              setFinishingConnection(false)

              await loadSessions()

              return true
            }

            if (
              currentStatus === "auth_failure" ||
              currentStatus === "error"
            ) {
              clearAllIntervals()
              setQr(null)
              setLoading(false)
              setFinishingConnection(false)
              setErrorMessage(
                currentStatus === "auth_failure"
                  ? "O WhatsApp recusou esta autenticação. Gere um novo QR Code e tente novamente."
                  : "A sessão não conseguiu concluir a conexão. Tente novamente."
              )

              return false
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
          1000
        )

      qrTimeoutRef.current =
        setTimeout(
          async () => {
            // Evita mostrar "QR expirou" quando a autenticação terminou
            // no mesmo instante do temporizador.
            const connected =
              await loadStatus()

            if (connected) {
              return
            }

            clearAllIntervals()
            setQr(null)
            setLoading(false)
            setFinishingConnection(false)

            setErrorMessage(
              "O QR Code expirou. Gerando um novo código..."
            )

            // O endpoint também renova a sessão quando o código venceu.
            // Reinicia o ciclo automaticamente para o usuário não ficar
            // preso no estado "Aguardando QR Code".
            void createSession()
          },
          120000
        )

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
      setFinishingConnection(false)
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
        `${WHATSAPP_RUNTIME_API}/sessions/${deleteId}`,
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

  useEffect(() => {
    if (!showModal) return
    const dialog = connectionDialogRef.current
    if (!dialog) return
    const trigger = connectButtonRef.current
    if (!dialog.contains(document.activeElement)) dialog.focus()

    function handleDialogKeyDown(event: KeyboardEvent) {
      if (!dialog) return
      if (event.key === "Escape") {
        event.preventDefault()
        dialog.querySelector<HTMLButtonElement>("[data-close-modal]")?.click()
        return
      }
      if (event.key !== "Tab") return
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>(
        "button:not(:disabled), select:not(:disabled), [tabindex='0']"
      ))
      const first = controls[0]
      const last = controls[controls.length - 1]
      const outsideControls = !controls.includes(document.activeElement as HTMLElement)
      if (event.shiftKey && (document.activeElement === first || outsideControls)) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && (document.activeElement === last || outsideControls)) {
        event.preventDefault()
        first?.focus()
      }
    }

    document.addEventListener("keydown", handleDialogKeyDown)
    return () => {
      document.removeEventListener("keydown", handleDialogKeyDown)
      if (trigger?.isConnected) trigger.focus()
    }
  }, [showModal])

  return (
    <div className={styles["numbers-page"]}>
      <header className={styles["numbers-header"]}>
        <div className={styles["header-copy"]}>
          <span className={styles["header-icon"]}>
            <WhatsAppIcon size={22} />
          </span>
          <div>
            <span className={styles["header-eyebrow"]}>Canais da loja</span>
            <h1>Conexões WhatsApp</h1>
            <p>Acompanhe seus números e o estado de cada conexão.</p>
          </div>
        </div>
        <button
          type="button"
          ref={connectButtonRef}
          className={styles["btn-add"]}
          onClick={() => {
            const nextSession = idsPermitidos.find(
              option => !connectedIds.has(option.id)
            )
            setSessionId(nextSession?.id || "principal")
            setQr(null)
            setFinishingConnection(false)
            setErrorMessage("")
            setShowModal(true)
          }}
          disabled={connectedIds.size >= idsPermitidos.length}
        >
          <Plus size={16} aria-hidden="true" />
          {connectedIds.size >= idsPermitidos.length
            ? "Todas conectadas"
            : "Conectar número"}
        </button>
      </header>

      <section className={styles["connection-summary"]} aria-label="Resumo das conexões">
        <div>
          <span className={styles["summary-icon"]}>
            <ShieldCheck size={18} aria-hidden="true" />
          </span>
          <div>
            <strong>{connectedIds.size} de {idsPermitidos.length} sessões online</strong>
            <span>
              {sessionsLoading
                ? "Sincronizando conexões..."
                : "Sessões autenticadas continuam salvas no servidor."}
            </span>
          </div>
        </div>
        <span className={styles["last-sync"]}>
          <RefreshCw size={12} aria-hidden="true" />
          {lastSyncAt
            ? `Atualizado às ${lastSyncAt.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit"
              })}`
            : "Aguardando atualização"}
        </span>
      </section>

      {errorMessage && !showModal && (
        <div className={styles["connection-alert"]} role="alert">{errorMessage}</div>
      )}

      <div className={styles["numbers-grid"]} aria-busy={sessionsLoading}>
        {sessions.length === 0 && (
          <div className={styles["empty-state"]}>
            <span className={styles["empty-icon"]}><WhatsAppIcon size={28} /></span>
            <strong>{sessionsLoading ? "Carregando conexões" : "Nenhum número conectado"}</strong>
            <p>
              {sessionsLoading
                ? "Consultando o estado dos seus canais de atendimento."
                : "Conecte uma sessão para começar o atendimento."}
            </p>
          </div>
        )}

        {sessions.map(s => (
          <article key={s.id} className={styles.card}>
            <div className={styles["card-header"]}>
              <span className={styles["card-icon"]}><WhatsAppIcon size={22} /></span>
              <div>
                <span className={styles.badge}>WhatsApp</span>
                <h2>{getSessionName(s.id)}</h2>
              </div>
            </div>
            <div className={styles["card-body"]}>
              <span className={styles["phone-label"]}>Número vinculado</span>
              <p className={styles.phone}>{formatPhone(s.phone)}</p>
              <div className={`${styles["status-indicator"]} ${getStatusClass(s.status)}`}>
                <span className={styles["status-dot"]} aria-hidden="true" />
                <span>{getStatusText(s.status)}</span>
              </div>
            </div>
            <div className={styles["card-footer"]}>
              <button
                type="button"
                className={styles["btn-delete"]}
                aria-label={`Remover conexão de ${getSessionName(s.id)}`}
                onClick={() => removeSession(s.id, s.rawId)}
              >
                <Trash2 size={14} aria-hidden="true" />
                Remover conexão
              </button>
            </div>
          </article>
        ))}
      </div>

      {showModal && (
        <div className={styles["modal-overlay"]}>
          <div
            className={styles["modal-content"]}
            role="dialog"
            aria-modal="true"
            aria-labelledby="connect-whatsapp-title"
            aria-describedby="connect-whatsapp-description"
            ref={connectionDialogRef}
            tabIndex={-1}
          >
            <span className={styles["modal-icon"]}><WhatsAppIcon size={26} /></span>
            <span className={styles["header-eyebrow"]}>Nova conexão</span>
            <h2 id="connect-whatsapp-title">Vincular aparelho</h2>
            <p id="connect-whatsapp-description">
              Escolha o canal e leia o QR Code no WhatsApp do celular.
            </p>

            <label htmlFor="whatsapp-session" className={styles["select-label"]}>Canal de atendimento</label>
            <select
              id="whatsapp-session"
              autoFocus
              value={sessionId}
              onChange={e => setSessionId(normalizeSessionId(e.target.value))}
              className={styles["select-session"]}
              disabled={loading || qr !== null}
            >
              {idsPermitidos.map(opt => (
                <option key={opt.id} value={opt.id} disabled={connectedIds.has(opt.id)}>
                  {opt.nome}{connectedIds.has(opt.id) ? " — conectado" : ""}
                </option>
              ))}
            </select>

            {!qr && (
              <button type="button" className={styles["btn-primary"]} onClick={createSession} disabled={loading}>
                {loading
                  ? <RefreshCw size={16} className={styles.spinner} aria-hidden="true" />
                  : <QrCode size={16} aria-hidden="true" />}
                {loading
                  ? finishingConnection
                    ? "Autenticado, finalizando conexão..."
                    : "Preparando conexão..."
                  : "Gerar QR Code"}
              </button>
            )}

            {qr && (
              <div className={styles["qr-container"]}>
                <img src={qr} width={256} height={256} alt={`QR Code para conectar ${getSessionName(sessionId)} ao WhatsApp`} />
                <ol className={styles["qr-steps"]}>
                  <li>Abra o WhatsApp no celular.</li>
                  <li>Entre em <strong>Aparelhos conectados</strong>.</li>
                  <li>Toque em <strong>Conectar um aparelho</strong> e leia o código.</li>
                </ol>
                <small>O código é atualizado automaticamente enquanto esta janela estiver aberta.</small>
              </div>
            )}

            {errorMessage && (
              <div className={styles["modal-alert"]} role="alert">{errorMessage}</div>
            )}
            <button
              type="button"
              data-close-modal
              className={styles["btn-close"]}
              onClick={() => {
                clearAllIntervals()
                setShowModal(false)
                setQr(null)
                setLoading(false)
                setFinishingConnection(false)
                setSessionId("principal")
              }}
            >
              <X size={14} aria-hidden="true" />
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
