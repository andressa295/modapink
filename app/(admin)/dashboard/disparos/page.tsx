"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react"

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Megaphone,
  Pause,
  Play,
  RotateCcw,
  Square
} from "lucide-react"

import styles from "../styles/disparos.module.css"
import { createClient } from "@/lib/supabase/client"

const API = process.env.NEXT_PUBLIC_API_URL!

type CampaignStatus =
  | "draft"
  | "running"
  | "paused"
  | "completed"
  | "cancelled"

type Campaign = {
  id: string
  name: string
  message: string
  session_key: string
  status: CampaignStatus
  total_count: number
  sent_count: number
  failed_count: number
  skipped_count: number
  created_at: string
}

const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: "Rascunho",
  running: "Enviando",
  paused: "Pausada",
  completed: "Concluída",
  cancelled: "Cancelada"
}

async function apiRequest(
  path: string,
  options?: RequestInit
) {
  const supabase = createClient()
  const {
    data: { session }
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error(
      "Sua sessão expirou. Faça login novamente."
    )
  }

  const response = await fetch(
    `${API}/broadcasts${path}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization:
          `Bearer ${session.access_token}`,
        ...(options?.headers || {})
      }
    }
  )

  const data = await response.json()

  if (!response.ok || !data?.ok) {
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : "Não foi possível concluir a operação."
    )
  }

  return data
}

export default function DisparosPage() {
  const [campaigns, setCampaigns] =
    useState<Campaign[]>([])
  const [contactsCount, setContactsCount] =
    useState<number | null>(null)
  const [name, setName] = useState("")
  const [message, setMessage] = useState("")
  const [sessionKey, setSessionKey] =
    useState("principal")
  const [loading, setLoading] = useState(false)
  const [loadingList, setLoadingList] =
    useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const loadData = useCallback(async () => {
    try {
      const [campaignData, countData] =
        await Promise.all([
          apiRequest("/"),
          apiRequest("/contacts/count")
        ])

      setCampaigns(campaignData.campaigns || [])
      setContactsCount(countData.count || 0)
      setError("")
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar as campanhas."
      )
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    void loadData()

    const timer = window.setInterval(
      () => void loadData(),
      15_000
    )

    return () => window.clearInterval(timer)
  }, [loadData])

  const preview = useMemo(
    () => message.replace(/{{\s*nome\s*}}/gi, "Ana"),
    [message]
  )

  async function createDraft() {
    if (!name.trim() || !message.trim()) {
      setError("Preencha o nome e a mensagem da campanha.")
      return
    }

    try {
      setLoading(true)
      setError("")
      setNotice("")

      await apiRequest("/", {
        method: "POST",
        body: JSON.stringify({
          name,
          message,
          session_key: sessionKey
        })
      })

      setName("")
      setMessage("")
      setNotice(
        "Rascunho criado. Confira a mensagem e clique em Iniciar quando estiver pronta."
      )
      await loadData()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível criar o rascunho."
      )
    } finally {
      setLoading(false)
    }
  }

  async function runAction(
    campaign: Campaign,
    action: "start" | "pause" | "resume" | "cancel"
  ) {
    if (action === "start") {
      const confirmed = window.confirm(
        `Iniciar “${campaign.name}” para ${contactsCount ?? "todos os"} contatos elegíveis? Os envios serão intercalados e respeitarão o limite diário.`
      )

      if (!confirmed) return
    }

    if (
      action === "cancel" &&
      !window.confirm(
        `Cancelar “${campaign.name}”? Os envios pendentes não serão retomados.`
      )
    ) {
      return
    }

    try {
      setLoading(true)
      setError("")
      setNotice("")

      await apiRequest(
        `/${campaign.id}/${action}`,
        { method: "POST" }
      )

      setNotice(
        action === "start"
          ? "Campanha iniciada com a fila protegida."
          : action === "pause"
            ? "Campanha pausada."
            : action === "resume"
              ? "Campanha retomada."
              : "Campanha cancelada."
      )
      await loadData()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível atualizar a campanha."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>
            <Megaphone size={17} /> Comunicação
          </span>
          <h1>Disparos segmentados</h1>
          <p>
            Envie novidades para quem já conversou com a Moda Pink,
            com fila, intervalo e controle de pausa.
          </p>
        </div>

        <div className={styles.contactCounter}>
          <strong>
            {contactsCount === null ? "—" : contactsCount}
          </strong>
          <span>contatos elegíveis</span>
        </div>
      </header>

      <section className={styles.safetyGrid}>
        <div>
          <Clock3 size={20} />
          <span><strong>Horário:</strong> somente das 9h às 20h</span>
        </div>
        <div>
          <Pause size={20} />
          <span><strong>Intervalo:</strong> aleatório de 45 a 90 segundos</span>
        </div>
        <div>
          <AlertTriangle size={20} />
          <span><strong>Limite:</strong> até 40 envios por dia e sessão</span>
        </div>
      </section>

      <div className={styles.columns}>
        <section className={styles.card}>
          <div className={styles.cardHeading}>
            <div>
              <h2>Nova campanha</h2>
              <p>Primeiro salve como rascunho. Nada será enviado ainda.</p>
            </div>
          </div>

          <label>
            Nome interno
            <input
              value={name}
              onChange={event => setName(event.target.value)}
              maxLength={120}
              placeholder="Ex.: Reposição de Baby Tee"
            />
          </label>

          <label>
            Número de envio
            <select
              value={sessionKey}
              onChange={event => setSessionKey(event.target.value)}
            >
              <option value="principal">Principal</option>
              <option value="vendedora_1">Vendedora 1</option>
            </select>
          </label>

          <label>
            Mensagem
            <textarea
              value={message}
              onChange={event => setMessage(event.target.value)}
              maxLength={1500}
              rows={7}
              placeholder="Oi, {{nome}}! Chegaram novidades na Moda Pink 💗"
            />
            <small>
              Use <code>{"{{nome}}"}</code> para chamar a cliente pelo primeiro nome.
              {" "}{message.length}/1500
            </small>
          </label>

          {preview && (
            <div className={styles.preview}>
              <span>Prévia</span>
              <p>{`${preview}\n\nSe não quiser receber novidades, responda SAIR.`}</p>
            </div>
          )}

          <button
            className={styles.primaryButton}
            onClick={createDraft}
            disabled={loading}
          >
            Salvar rascunho
          </button>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeading}>
            <div>
              <h2>Campanhas</h2>
              <p>Acompanhe o progresso e interrompa quando precisar.</p>
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}
          {notice && <div className={styles.notice}>{notice}</div>}

          {loadingList ? (
            <p className={styles.empty}>Carregando campanhas...</p>
          ) : campaigns.length === 0 ? (
            <p className={styles.empty}>Nenhuma campanha criada ainda.</p>
          ) : (
            <div className={styles.campaignList}>
              {campaigns.map(campaign => {
                const progress = campaign.total_count
                  ? Math.round(
                      ((campaign.sent_count + campaign.failed_count + campaign.skipped_count) /
                        campaign.total_count) * 100
                    )
                  : 0

                return (
                  <article className={styles.campaign} key={campaign.id}>
                    <div className={styles.campaignTop}>
                      <div>
                        <h3>{campaign.name}</h3>
                        <span>{campaign.session_key}</span>
                      </div>
                      <span className={`${styles.status} ${styles[campaign.status]}`}>
                        {STATUS_LABEL[campaign.status]}
                      </span>
                    </div>

                    <p className={styles.campaignMessage}>{campaign.message}</p>

                    <div className={styles.progressTrack}>
                      <span style={{ width: `${progress}%` }} />
                    </div>
                    <div className={styles.metrics}>
                      <span>{campaign.sent_count} enviadas</span>
                      <span>{campaign.failed_count} falhas</span>
                      <span>{campaign.skipped_count} ignoradas</span>
                      <strong>{campaign.total_count || "—"} total</strong>
                    </div>

                    <div className={styles.actions}>
                      {campaign.status === "draft" && (
                        <button onClick={() => runAction(campaign, "start")} disabled={loading}>
                          <Play size={15} /> Iniciar
                        </button>
                      )}
                      {campaign.status === "running" && (
                        <button onClick={() => runAction(campaign, "pause")} disabled={loading}>
                          <Pause size={15} /> Pausar
                        </button>
                      )}
                      {campaign.status === "paused" && (
                        <button onClick={() => runAction(campaign, "resume")} disabled={loading}>
                          <RotateCcw size={15} /> Retomar
                        </button>
                      )}
                      {["draft", "running", "paused"].includes(campaign.status) && (
                        <button
                          className={styles.cancelButton}
                          onClick={() => runAction(campaign, "cancel")}
                          disabled={loading}
                        >
                          <Square size={14} /> Cancelar
                        </button>
                      )}
                      {campaign.status === "completed" && (
                        <span className={styles.done}>
                          <CheckCircle2 size={16} /> Envio concluído
                        </span>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>

      <p className={styles.disclaimer}>
        O intervalo e os limites diminuem rajadas, mas não eliminam o risco de
        restrição em uma conexão não oficial do WhatsApp. Para campanhas grandes,
        use a API oficial com modelos de mensagem aprovados e consentimento.
      </p>
    </main>
  )
}
