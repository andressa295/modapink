"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react"

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ImagePlus,
  Megaphone,
  Pause,
  Play,
  RotateCcw,
  Square,
  Trash2,
  Video
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
  media_url?: string | null
  media_type?: "image" | "video" | null
  media_filename?: string | null
}

type BroadcastSession = {
  key: string
  label: string
  status: string
  phone?: string | null
  ready: boolean
}

const FALLBACK_SESSIONS: BroadcastSession[] = [
  {
    key: "principal",
    label: "Atendimento automático 1",
    status: "unknown",
    ready: false
  },
  {
    key: "vendedora_1",
    label: "Atendimento automático 2",
    status: "unknown",
    ready: false
  },
  {
    key: "vendedora_2",
    label: "Vendedora",
    status: "unknown",
    ready: false
  },
  {
    key: "sac",
    label: "SAC",
    status: "unknown",
    ready: false
  },
  {
    key: "automacoes",
    label: "Automações",
    status: "unknown",
    ready: false
  }
]

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
  const [availableSessions, setAvailableSessions] =
    useState<BroadcastSession[]>(FALLBACK_SESSIONS)
  const [name, setName] = useState("")
  const [message, setMessage] = useState("")
  const [sessionKey, setSessionKey] =
    useState("principal")
  const [mediaFile, setMediaFile] =
    useState<File | null>(null)
  const [mediaPreview, setMediaPreview] =
    useState("")
  const fileInputRef =
    useRef<HTMLInputElement | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingList, setLoadingList] =
    useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const loadData = useCallback(async () => {
    try {
      const [
        campaignData,
        countData,
        sessionData
      ] =
        await Promise.all([
          apiRequest("/"),
          apiRequest("/contacts/count"),
          apiRequest("/sessions")
        ])

      setCampaigns(campaignData.campaigns || [])
      setContactsCount(countData.count || 0)
      setAvailableSessions(
        Array.isArray(sessionData.sessions) &&
        sessionData.sessions.length
          ? sessionData.sessions
          : FALLBACK_SESSIONS
      )
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

  useEffect(() => {
    return () => {
      if (mediaPreview) {
        URL.revokeObjectURL(mediaPreview)
      }
    }
  }, [mediaPreview])

  function selectMedia(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0] || null

    setError("")

    if (!file) {
      setMediaFile(null)
      setMediaPreview("")
      return
    }

    const allowed =
      file.type.startsWith("image/") ||
      [
        "video/mp4",
        "video/webm"
      ].includes(file.type)

    if (!allowed) {
      event.target.value = ""
      setError(
        "Use uma imagem JPG, PNG ou WEBP, ou um vídeo MP4/WEBM."
      )
      return
    }

    if (file.size > 16 * 1024 * 1024) {
      event.target.value = ""
      setError(
        "O arquivo pode ter no máximo 16 MB."
      )
      return
    }

    setMediaFile(file)
    setMediaPreview(
      URL.createObjectURL(file)
    )
  }

  function removeMedia() {
    setMediaFile(null)
    setMediaPreview("")

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  function getSessionLabel(key: string) {
    return (
      availableSessions.find(
        item => item.key === key
      )?.label ||
      FALLBACK_SESSIONS.find(
        item => item.key === key
      )?.label ||
      key
    )
  }

  async function createDraft() {
    if (
      !name.trim() ||
      (!message.trim() && !mediaFile)
    ) {
      setError(
        "Preencha o nome e adicione uma mensagem, imagem ou vídeo."
      )
      return
    }

    try {
      setLoading(true)
      setError("")
      setNotice("")

      let uploadedPath = ""
      let mediaUrl: string | null = null
      let mediaType: "image" | "video" | null = null

      if (mediaFile) {
        const supabase = createClient()
        const {
          data: { session }
        } = await supabase.auth.getSession()

        if (!session?.user?.id) {
          throw new Error(
            "Sua sessão expirou. Faça login novamente."
          )
        }

        const safeName =
          mediaFile.name
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9._-]/g, "-")
            .slice(-120)

        uploadedPath =
          `${session.user.id}/${Date.now()}-${safeName}`

        const { error: uploadError } =
          await supabase.storage
            .from("broadcast-media")
            .upload(
              uploadedPath,
              mediaFile,
              {
                cacheControl: "3600",
                contentType:
                  mediaFile.type,
                upsert: false
              }
            )

        if (uploadError) {
          throw new Error(
            `Não foi possível enviar a mídia: ${uploadError.message}`
          )
        }

        const { data: publicData } =
          supabase.storage
            .from("broadcast-media")
            .getPublicUrl(uploadedPath)

        mediaUrl =
          publicData.publicUrl

        mediaType =
          mediaFile.type.startsWith("video/")
            ? "video"
            : "image"
      }

      try {
        await apiRequest("/", {
          method: "POST",
          body: JSON.stringify({
            name,
            message,
            session_key:
              sessionKey,
            media_url:
              mediaUrl,
            media_type:
              mediaType,
            media_filename:
              mediaFile?.name || null
          })
        })
      } catch (err) {
        if (uploadedPath) {
          const supabase = createClient()

          await supabase.storage
            .from("broadcast-media")
            .remove([uploadedPath])
            .catch(() => undefined)
        }

        throw err
      }

      setName("")
      setMessage("")
      removeMedia()
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
              {availableSessions.map(session => (
                <option
                  value={session.key}
                  key={session.key}
                >
                  {session.label}
                  {session.ready
                    ? " — conectado"
                    : session.status === "unknown"
                      ? ""
                      : " — desconectado"}
                </option>
              ))}
            </select>
            <small>
              O envio sai exatamente pelo número escolhido. Campanhas só iniciam quando ele estiver conectado.
            </small>
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

          <label>
            Imagem ou vídeo
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
              onChange={selectMedia}
            />
            <small>
              JPG, PNG, WEBP, MP4 ou WEBM. Máximo de 16 MB.
            </small>
          </label>

          {mediaPreview && mediaFile && (
            <div className={styles.mediaPreview}>
              <div className={styles.mediaPreviewTop}>
                <span>
                  {mediaFile.type.startsWith("video/")
                    ? <Video size={15} />
                    : <ImagePlus size={15} />}
                  {mediaFile.name}
                </span>

                <button
                  type="button"
                  onClick={removeMedia}
                  aria-label="Remover mídia"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {mediaFile.type.startsWith("video/") ? (
                <video
                  src={mediaPreview}
                  controls
                  playsInline
                />
              ) : (
                <img
                  src={mediaPreview}
                  alt="Prévia da campanha"
                />
              )}
            </div>
          )}

          {(preview || mediaPreview) && (
            <div className={styles.preview}>
              <span>Prévia da mensagem</span>
              {preview && (
                <p>{`${preview}\n\nSe não quiser receber novidades, responda SAIR.`}</p>
              )}
              {!preview && (
                <p>
                  A mídia será enviada com o aviso para responder SAIR.
                </p>
              )}
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
                        <span>{getSessionLabel(campaign.session_key)}</span>
                      </div>
                      <span className={`${styles.status} ${styles[campaign.status]}`}>
                        {STATUS_LABEL[campaign.status]}
                      </span>
                    </div>

                    {campaign.media_url && (
                      <div className={styles.campaignMedia}>
                        {campaign.media_type === "video" ? (
                          <video
                            src={campaign.media_url}
                            controls
                            playsInline
                          />
                        ) : (
                          <img
                            src={campaign.media_url}
                            alt={campaign.media_filename || campaign.name}
                          />
                        )}
                        <span>
                          {campaign.media_type === "video"
                            ? "Vídeo"
                            : "Imagem"}
                          {campaign.media_filename
                            ? ` · ${campaign.media_filename}`
                            : ""}
                        </span>
                      </div>
                    )}

                    {campaign.message && (
                      <p className={styles.campaignMessage}>{campaign.message}</p>
                    )}

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
