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
  FileSpreadsheet,
  FolderOpen,
  ImagePlus,
  Megaphone,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Save,
  Send,
  Square,
  Trash2,
  Upload,
  Users,
  Video
} from "lucide-react"

import styles from "../styles/disparos.module.css"
import { createClient } from "@/lib/supabase/client"
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon"

const BROADCASTS_API = "/api/whatsapp/broadcasts"

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
  expected_sender_phone?: string | null
  status: CampaignStatus
  total_count: number
  sent_count: number
  failed_count: number
  skipped_count: number
  created_at: string
  media_url?: string | null
  media_type?: "image" | "video" | null
  media_filename?: string | null
  audience?: "previous_contacts" | "contact_lists"
  audience_labels?: string[]
  audience_list_ids?: string[]
}
type ContactList = {
  id: string
  name: string
  status: "importing" | "ready" | "failed" | "archived"
  source_filename?: string | null
  contacts_count: number
  total_rows: number
  valid_count: number
  duplicate_count: number
  invalid_count: number
  existing_count: number
  new_count: number
  last_error?: string | null
  created_at: string
  updated_at: string
}

type BroadcastSession = {
  key: string
  label: string
  status: string
  phone?: string | null
  ready: boolean
}

type CampaignActionState = {
  campaignId: string
  action: "start" | "pause" | "resume" | "cancel"
  phase: "checking" | "submitting"
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
    `${BROADCASTS_API}${path === "/" ? "" : path}`,
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

  const data = await response.json().catch(() => null)

  if (!response.ok || !data?.ok) {
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : typeof data?.error?.message === "string"
          ? data.error.message
          : `Não foi possível concluir a operação (HTTP ${response.status}).`
    )
  }

  return data
}

export default function DisparosPage() {
  const [campaigns, setCampaigns] =
    useState<Campaign[]>([])
  const [contactsCount, setContactsCount] =
    useState<number | null>(null)
  const [audienceCount, setAudienceCount] =
    useState<number | null>(null)
  const [dailyLimit, setDailyLimit] =
    useState(70)
  const [availableSessions, setAvailableSessions] =
    useState<BroadcastSession[]>(FALLBACK_SESSIONS)
  const [contactLists, setContactLists] =
    useState<ContactList[]>([])
  const [name, setName] = useState("")
  const [message, setMessage] = useState("")
  const [sessionKey, setSessionKey] =
    useState("principal")
  const [audienceListId, setAudienceListId] =
    useState("unselected")
  const [showContactLists, setShowContactLists] =
    useState(false)
  const [contactListName, setContactListName] =
    useState("")
  const [contactListFile, setContactListFile] =
    useState<File | null>(null)
  const [importingContacts, setImportingContacts] =
    useState(false)
  const [mediaFile, setMediaFile] =
    useState<File | null>(null)
  const [mediaPreview, setMediaPreview] =
    useState("")
  const fileInputRef =
    useRef<HTMLInputElement | null>(null)
  const contactFileInputRef =
    useRef<HTMLInputElement | null>(null)
  const contactListsRequestRef = useRef(0)
  const loadDataRequestRef = useRef(0)
  const audienceCountRequestRef = useRef(0)
  const [contactListsLoading, setContactListsLoading] =
    useState(true)
  const [contactListsLoaded, setContactListsLoaded] =
    useState(false)
  const [contactListsError, setContactListsError] =
    useState("")
  const [loading, setLoading] = useState(false)
  const [campaignAction, setCampaignAction] =
    useState<CampaignActionState | null>(null)
  const [campaignActionErrors, setCampaignActionErrors] =
    useState<Record<string, string>>({})
  const [loadingList, setLoadingList] =
    useState(true)
  const [listError, setListError] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [statusFilter, setStatusFilter] =
    useState<"all" | Exclude<CampaignStatus, "cancelled">>("all")

  const campaignSummary = useMemo(() => ({
    sent: campaigns.reduce((total, campaign) => total + campaign.sent_count, 0),
    running: campaigns.filter(campaign => campaign.status === "running").length,
    completed: campaigns.filter(campaign => campaign.status === "completed").length
  }), [campaigns])

  const visibleCampaigns = useMemo(
    () => campaigns.filter(campaign => statusFilter === "all" || campaign.status === statusFilter),
    [campaigns, statusFilter]
  )

  const loadContactLists = useCallback(async () => {
    const requestId = ++contactListsRequestRef.current
    setContactListsLoading(true)

    try {
      const listData = await apiRequest("/contact-lists")

      if (requestId !== contactListsRequestRef.current) return

      setContactLists(
        Array.isArray(listData.lists)
          ? listData.lists
          : []
      )
      setContactListsLoaded(true)
      setContactListsError("")
    } catch (err) {
      if (requestId !== contactListsRequestRef.current) return

      // Mantém a última lista visível, mas bloqueia uma nova campanha até
      // confirmar os IDs novamente. Assim uma falha nunca vira "Todos".
      setContactListsLoaded(false)
      setContactListsError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar as carteiras."
      )
    } finally {
      if (requestId === contactListsRequestRef.current) {
        setContactListsLoading(false)
      }
    }
  }, [])

  const loadData = useCallback(async () => {
    const requestId = ++loadDataRequestRef.current
    void loadContactLists()

    try {
      const [campaignData, sessionData] =
        await Promise.all([
          apiRequest("/"),
          apiRequest("/sessions")
        ])

      if (requestId !== loadDataRequestRef.current) return

      setCampaigns(
        (campaignData.campaigns || []).filter(
          (campaign: Campaign) => campaign.status !== "cancelled"
        )
      )
      setAvailableSessions(
        Array.isArray(sessionData.sessions) &&
        sessionData.sessions.length
          ? sessionData.sessions
          : FALLBACK_SESSIONS
      )
      const configuredDailyLimit =
        Number(sessionData.dailyLimit)
      setDailyLimit(
        Number.isFinite(configuredDailyLimit) &&
        configuredDailyLimit > 0
          ? configuredDailyLimit
          : 70
      )
      setListError("")
    } catch (err) {
      if (requestId !== loadDataRequestRef.current) return

      setListError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar as campanhas."
      )
    } finally {
      if (requestId === loadDataRequestRef.current) {
        setLoadingList(false)
      }
    }

    // A contagem não deve atrasar a lista nem bloquear o formulário.
    void apiRequest("/contacts/count")
      .then(countData => {
        if (requestId !== loadDataRequestRef.current) return
        setContactsCount(countData.count || 0)
      })
      .catch(() => {
        // Mantém a contagem anterior quando o endpoint estiver lento
        // ou indisponível; campanhas e sessões continuam utilizáveis.
      })
  }, [loadContactLists])

  useEffect(() => {
    const requestId = ++audienceCountRequestRef.current

    if (audienceListId === "unselected") {
      setAudienceCount(null)
      return
    }

    if (audienceListId === "all") {
      setAudienceCount(contactsCount)
      return
    }

    const selectedListExists = contactLists.some(
      list =>
        list.id === audienceListId &&
        list.status === "ready"
    )

    if (!selectedListExists) {
      setAudienceListId("unselected")
      setAudienceCount(null)
      setNotice(
        "A carteira selecionada não está mais disponível. Escolha o público novamente antes de salvar a campanha."
      )
      return
    }

    setAudienceCount(null)

    void apiRequest(
      `/contacts/count?contact_list_ids=${encodeURIComponent(audienceListId)}`
    )
      .then(data => {
        if (requestId !== audienceCountRequestRef.current) return
        setAudienceCount(Number(data.count) || 0)
      })
      .catch(() => {
        if (requestId !== audienceCountRequestRef.current) return
        const selectedList = contactLists.find(
          list => list.id === audienceListId
        )
        setAudienceCount(selectedList?.contacts_count ?? null)
      })
  }, [audienceListId, contactLists, contactsCount])

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

  function formatSessionPhone(phone?: string | null) {
    const digits = String(phone || "").replace(/\D/g, "")

    if (digits.length === 13 && digits.startsWith("55")) {
      return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`
    }

    if (digits.length === 12 && digits.startsWith("55")) {
      return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`
    }

    return digits ? `+${digits}` : "Número não identificado"
  }

  function getSession(key: string) {
    return availableSessions.find(item => item.key === key)
  }

  function getSessionDisplay(key: string) {
    const session = getSession(key)
    return `${getSessionLabel(key)} · ${formatSessionPhone(session?.phone)}`
  }

  function getCampaignSenderDisplay(campaign: Campaign) {
    const expectedPhone =
      campaign.expected_sender_phone ||
      getSession(campaign.session_key)?.phone

    return `${getSessionLabel(campaign.session_key)} · ${formatSessionPhone(expectedPhone)}`
  }

  function getAudienceLabel(campaign: Campaign) {
    return campaign.audience_labels?.length
      ? campaign.audience_labels.join(", ")
      : "Todos os contatos elegíveis"
  }

  async function getEligibleAudienceEstimate(
    campaign: Campaign
  ) {
    if (campaign.audience === "contact_lists") {
      const listIds = Array.from(new Set(
        (campaign.audience_list_ids || [])
          .map(id => String(id || "").trim())
          .filter(Boolean)
      ))

      if (listIds.length === 0) {
        throw new Error(
          "Esta campanha não tem os IDs das carteiras salvos. Crie um novo rascunho e escolha o público novamente."
        )
      }

      if (!contactListsLoaded || contactListsError) {
        throw new Error(
          "Não foi possível confirmar as carteiras agora. Recarregue as carteiras antes de iniciar."
        )
      }

      const readyListsById = new Map(
        contactLists
          .filter(list => list.status === "ready")
          .map(list => [list.id, list] as const)
      )

      if (listIds.some(id => !readyListsById.has(id))) {
        throw new Error(
          "Uma das carteiras desta campanha não está mais disponível. Crie um novo rascunho e confira o público."
        )
      }

      const count = listIds.reduce((total, id) => {
        const listCount = Number(
          readyListsById.get(id)?.contacts_count
        )

        return total + (
          Number.isInteger(listCount) && listCount >= 0
            ? listCount
            : 0
        )
      }, 0)

      // Esta é uma estimativa superior: uma pessoa pode constar em mais de
      // uma carteira. O backend deduplica, aplica bloqueios e congela a fila.
      return { count, isUpperBound: true }
    }

    const data = await apiRequest("/contacts/count")
    const count = Number(data.count)

    if (!Number.isInteger(count) || count < 0) {
      throw new Error(
        "Não foi possível confirmar a quantidade de contatos elegíveis."
      )
    }

    return { count, isUpperBound: false }
  }

  function setCampaignActionError(
    campaignId: string,
    message: string
  ) {
    setCampaignActionErrors(current => ({
      ...current,
      [campaignId]: message
    }))
  }

  function clearCampaignActionError(campaignId: string) {
    setCampaignActionErrors(current => {
      if (!current[campaignId]) return current

      const next = { ...current }
      delete next[campaignId]
      return next
    })
  }

  function fileAsBase64(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = () => {
        const result = String(reader.result || "")
        resolve(result.split(",").pop() || "")
      }

      reader.onerror = () => reject(
        new Error("Não foi possível ler a planilha.")
      )

      reader.readAsDataURL(file)
    })
  }

  async function importContactList() {
    if (!contactListName.trim() || !contactListFile) {
      setError("Informe o nome da carteira e selecione a planilha.")
      return
    }

    const extension = contactListFile.name
      .split(".")
      .pop()
      ?.toLowerCase()

    if (!["xlsx", "csv"].includes(extension || "")) {
      setError("Use uma planilha XLSX ou CSV.")
      return
    }

    if (contactListFile.size > 8 * 1024 * 1024) {
      setError("A planilha pode ter no máximo 8 MB.")
      return
    }

    try {
      setImportingContacts(true)
      setError("")
      setNotice("")

      const fileBase64 = await fileAsBase64(contactListFile)
      const data = await apiRequest("/contact-lists/import", {
        method: "POST",
        body: JSON.stringify({
          name: contactListName,
          filename: contactListFile.name,
          file_base64: fileBase64
        })
      })

      const imported = data.list as ContactList

      setContactListName("")
      setContactListFile(null)
      if (contactFileInputRef.current) {
        contactFileInputRef.current.value = ""
      }
      // Atualiza o estado antes de selecionar. Assim, uma resposta antiga da
      // listagem não consegue trocar silenciosamente a nova carteira por Todos.
      contactListsRequestRef.current += 1
      setContactLists(current => [
        imported,
        ...current.filter(list => list.id !== imported.id)
      ])
      setAudienceListId(imported.id)
      setNotice(
        `${imported.name} criada com ${imported.contacts_count.toLocaleString("pt-BR")} contatos. ${imported.duplicate_count.toLocaleString("pt-BR")} repetidos e ${imported.invalid_count.toLocaleString("pt-BR")} inválidos foram ignorados.`
      )
      await Promise.all([
        loadData(),
        loadContactLists()
      ])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível importar a planilha."
      )
    } finally {
      setImportingContacts(false)
    }
  }

  async function archiveContactList(list: ContactList) {
    if (!window.confirm(
      `Arquivar a carteira “${list.name}”? Campanhas finalizadas continuam preservadas. Se houver um rascunho usando essa carteira, o sistema pedirá para cancelá-lo primeiro.`
    )) {
      return
    }

    try {
      setLoading(true)
      setError("")

      await apiRequest(`/contact-lists/${list.id}`, {
        method: "DELETE"
      })

      if (audienceListId === list.id) {
        setAudienceListId("unselected")
      }

      setNotice(`A carteira “${list.name}” foi arquivada.`)
      await loadData()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível arquivar a carteira."
      )
    } finally {
      setLoading(false)
    }
  }

  async function renameContactList(list: ContactList) {
    const nextName = window.prompt(
      "Novo nome da carteira:",
      list.name
    )?.trim()

    if (!nextName || nextName === list.name) return

    try {
      setLoading(true)
      setError("")

      await apiRequest(`/contact-lists/${list.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: nextName })
      })

      setNotice(`Carteira renomeada para “${nextName}”.`)
      await loadData()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível renomear a carteira."
      )
    } finally {
      setLoading(false)
    }
  }

  async function createDraft() {
    if (!contactListsLoaded || contactListsError) {
      setError(
        "As carteiras ainda não foram confirmadas. Recarregue essa lista antes de salvar a campanha."
      )
      return
    }

    if (audienceListId === "unselected") {
      setError(
        "Escolha o público da campanha antes de salvar o rascunho."
      )
      return
    }

    if (
      audienceListId !== "all" &&
      !contactLists.some(
        list =>
          list.id === audienceListId &&
          list.status === "ready"
      )
    ) {
      setAudienceListId("unselected")
      setError(
        "A carteira escolhida não está mais disponível. Selecione o público novamente."
      )
      return
    }

    if (
      !name.trim() ||
      (!message.trim() && !mediaFile)
    ) {
      setError(
        "Preencha o nome e adicione uma mensagem, imagem ou vídeo."
      )
      return
    }

    const draftSessionKey = sessionKey
    const draftSenderPhone = String(
      getSession(draftSessionKey)?.phone || ""
    ).replace(/\D/g, "")

    if (draftSenderPhone.length < 10) {
      setError(
        `O telefone real do remetente ${getSessionLabel(draftSessionKey)} não foi identificado. Atualize as sessões antes de salvar.`
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
              draftSessionKey,
            expected_sender_phone:
              draftSenderPhone,
            media_url:
              mediaUrl,
            media_type:
              mediaType,
            media_filename:
              mediaFile?.name || null,
            audience_mode:
              audienceListId === "all"
                ? "all_contacts"
                : "selected_lists",
            contact_list_ids:
              audienceListId === "all"
                ? []
                : [audienceListId]
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
      setAudienceListId("unselected")
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
    clearCampaignActionError(campaign.id)

    if (action === "start" || action === "resume") {
      const senderSession = getSession(campaign.session_key)
      const senderPhone = String(senderSession?.phone || "")
        .replace(/\D/g, "")
      const expectedSenderPhone = String(
        campaign.expected_sender_phone || ""
      ).replace(/\D/g, "")

      if (!senderSession?.ready) {
        setCampaignActionError(
          campaign.id,
          `O remetente ${getSessionLabel(campaign.session_key)} não está conectado. Reconecte o número antes de iniciar ou retomar.`
        )
        return
      }

      if (senderPhone.length < 10) {
        setCampaignActionError(
          campaign.id,
          `O telefone do remetente ${getSessionLabel(campaign.session_key)} não foi identificado. Atualize as sessões antes de iniciar ou retomar.`
        )
        return
      }

      if (expectedSenderPhone.length < 10) {
        setCampaignActionError(
          campaign.id,
          `Esta campanha não tem o telefone esperado do remetente salvo. Cancele-a e crie outro rascunho confirmando o número correto.`
        )
        return
      }

      if (expectedSenderPhone !== senderPhone) {
        setCampaignActionError(
          campaign.id,
          `O telefone conectado em ${getSessionLabel(campaign.session_key)} mudou desde a criação deste rascunho. Cancele-o e crie outro confirmando o remetente correto.`
        )
        return
      }
    }

    if (action === "start") {
      setLoading(true)
      setCampaignAction({
        campaignId: campaign.id,
        action,
        phase: "checking"
      })
      setError("")
      setNotice("")

      let estimate: {
        count: number
        isUpperBound: boolean
      }

      try {
        estimate =
          await getEligibleAudienceEstimate(campaign)
      } catch (err) {
        setLoading(false)
        setCampaignAction(null)
        setCampaignActionError(
          campaign.id,
          err instanceof Error
            ? err.message
            : "Não foi possível conferir o público da campanha."
        )
        return
      }

      if (estimate.count === 0) {
        setLoading(false)
        setCampaignAction(null)
        setCampaignActionError(
          campaign.id,
          "Nenhum contato elegível foi encontrado neste público. Confira a carteira antes de iniciar."
        )
        return
      }

      const estimateLabel = estimate.isUpperBound
        ? `até ${estimate.count.toLocaleString("pt-BR")} contatos nas carteiras selecionadas`
        : `${estimate.count.toLocaleString("pt-BR")} contatos elegíveis`

      const confirmed = window.confirm(
        `Iniciar “${campaign.name}”?\n\nRemetente: ${getCampaignSenderDisplay(campaign)}\nPúblico: ${getAudienceLabel(campaign)}\nEstimativa atual: ${estimateLabel}\n\nAo confirmar, o sistema validará os contatos, removerá duplicidades e congelará a fila definitiva. O limite diário será respeitado.`
      )

      if (!confirmed) {
        setLoading(false)
        setCampaignAction(null)
        return
      }

      setCampaignAction({
        campaignId: campaign.id,
        action,
        phase: "submitting"
      })
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
      setCampaignAction(current => current || ({
        campaignId: campaign.id,
        action,
        phase: "submitting"
      }))
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
      setCampaignActionError(
        campaign.id,
        err instanceof Error
          ? err.message
          : "Não foi possível atualizar a campanha."
      )
    } finally {
      setLoading(false)
      setCampaignAction(null)
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>
            COMUNICAÇÃO DA LOJA
          </span>
          <h1>Campanhas</h1>
          <p>
            Crie mensagens, acompanhe os envios e mantenha o controle de cada campanha.
          </p>
        </div>
        <span className={styles.headerContext}><Megaphone size={16} /> Disparos pelo WhatsApp</span>
      </header>

      <section className={styles.headerStats} aria-label="Resumo das campanhas">
          <div className={styles.contactCounter}>
            <div className={styles.statLabel}><span>Campanhas</span><Megaphone size={17} /></div>
            <strong>{loadingList ? "—" : campaigns.length.toLocaleString("pt-BR")}</strong>
            <small>{campaignSummary.running} em envio · {campaignSummary.completed} concluídas</small>
          </div>

          <div className={styles.contactCounter}>
            <div className={styles.statLabel}><span>Mensagens enviadas</span><Send size={17} /></div>
            <strong>{loadingList ? "—" : campaignSummary.sent.toLocaleString("pt-BR")}</strong>
            <small>nas campanhas desta lista</small>
          </div>

          <div className={styles.contactCounter}>
            <div className={styles.statLabel}><span>Contatos elegíveis</span><Users size={17} /></div>
            <strong>
              {contactsCount === null ? "—" : contactsCount.toLocaleString("pt-BR")}
            </strong>
            <small>{contactLists.filter(list => list.status === "ready").length} carteiras salvas · público geral</small>
          </div>

          <div className={styles.dailyLimitCard}>
            <div className={styles.statLabel}><span>Limite diário</span><Clock3 size={17} /></div>
            <div className={styles.dailyLimitValue}>
              <strong>{dailyLimit}</strong>
              <span>envios por número</span>
            </div>
            <small>renova à meia-noite · Brasília</small>
          </div>
      </section>

      <section className={styles.safetyGrid}>
        <div>
          <Clock3 size={16} />
          <span><strong>Horário:</strong> somente das 9h às 20h</span>
        </div>
        <div>
          <Pause size={16} />
          <span><strong>Intervalo:</strong> aleatório de 45 a 90 segundos</span>
        </div>
        <div>
          <AlertTriangle size={16} />
          <span><strong>Renovação:</strong> o limite reinicia à meia-noite</span>
        </div>
      </section>

      {listError && <div className={styles.error} role="alert">{listError}</div>}
      {error && <div className={styles.error} role="alert">{error}</div>}
      {notice && <div className={styles.notice} role="status">{notice}</div>}

      <section className={styles.audienceBar}>
        <div>
          <span className={styles.audienceIcon}><FolderOpen size={18} /></span>
          <div>
            <strong>Carteiras de clientes</strong>
            <p>Importe planilhas, organize os contatos por mês ou campanha e escolha o público antes de disparar.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowContactLists(value => !value)}
          aria-expanded={showContactLists}
          disabled={importingContacts}
        >
          <FileSpreadsheet size={16} />
          {showContactLists ? "Fechar carteiras" : "Gerenciar carteiras"}
        </button>
      </section>

      {showContactLists && (
        <section className={styles.contactListManager}>
          <div className={styles.importCard}>
            <div className={styles.managerHeading}>
              <span><Upload size={17} /></span>
              <div>
                <h2>Nova carteira</h2>
                <p>Use uma planilha com uma coluna de nome e outra de celular.</p>
              </div>
            </div>

            <label>
              Nome da carteira
              <input
                value={contactListName}
                onChange={event => setContactListName(event.target.value)}
                maxLength={120}
                placeholder="Ex.: Clientes de outubro"
                disabled={importingContacts}
              />
            </label>

            <label>
              Planilha de clientes
              <input
                ref={contactFileInputRef}
                type="file"
                accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                onChange={event => setContactListFile(event.target.files?.[0] || null)}
                disabled={importingContacts}
              />
              <small>XLSX ou CSV, até 8 MB. Telefones repetidos e inválidos serão separados automaticamente.</small>
            </label>

            <button
              type="button"
              className={styles.importButton}
              onClick={importContactList}
              disabled={importingContacts}
            >
              <Upload size={16} />
              {importingContacts ? "Importando e conferindo…" : "Criar carteira"}
            </button>
          </div>

          <div className={styles.savedLists}>
            <div className={styles.managerHeading}>
              <span><Users size={17} /></span>
              <div>
                <h2>Carteiras salvas</h2>
                <p>Essas opções aparecem no público de cada nova campanha.</p>
              </div>
            </div>

            {contactListsError ? (
              <div className={styles.listLoadError} role="alert">
                <AlertTriangle size={20} />
                <strong>Não foi possível confirmar as carteiras.</strong>
                <p>{contactListsError}</p>
                <button
                  type="button"
                  onClick={() => void loadContactLists()}
                  disabled={contactListsLoading}
                >
                  <RotateCcw size={14} />
                  {contactListsLoading ? "Tentando novamente…" : "Tentar novamente"}
                </button>
              </div>
            ) : contactListsLoading && !contactListsLoaded ? (
              <div className={styles.listEmpty} role="status">
                <RotateCcw size={22} />
                <p>Carregando carteiras…</p>
              </div>
            ) : contactLists.length === 0 ? (
              <div className={styles.listEmpty}>
                <FileSpreadsheet size={22} />
                <p>Nenhuma carteira importada ainda.</p>
              </div>
            ) : (
              <div className={styles.contactListGrid}>
                {contactLists.map(list => (
                  <article className={styles.contactListItem} key={list.id}>
                    <div>
                      <strong>{list.name}</strong>
                      <span className={`${styles.listStatus} ${styles[`listStatus_${list.status}`]}`}>
                        {list.status === "ready"
                          ? "Pronta"
                          : list.status === "failed"
                            ? "Falhou"
                            : "Importando"}
                      </span>
                    </div>
                    <b>{list.contacts_count.toLocaleString("pt-BR")} contatos</b>
                    <p>{list.source_filename || "Planilha sem nome"}</p>
                    {list.status === "ready" && (
                      <small>
                        {list.duplicate_count.toLocaleString("pt-BR")} repetidos · {list.invalid_count.toLocaleString("pt-BR")} inválidos ignorados
                      </small>
                    )}
                    {list.last_error && <small className={styles.listError}>{list.last_error}</small>}
                    <div className={styles.listActions}>
                      <button
                        type="button"
                        onClick={() => renameContactList(list)}
                        disabled={loading || importingContacts}
                        aria-label={`Renomear ${list.name}`}
                      >
                        <Pencil size={13} /> Renomear
                      </button>
                      <button
                        type="button"
                        onClick={() => archiveContactList(list)}
                        disabled={loading || importingContacts}
                        aria-label={`Arquivar ${list.name}`}
                      >
                        <Trash2 size={13} /> Arquivar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <div className={styles.columns}>
        <section className={styles.card}>
          <div className={styles.cardHeading}>
            <div>
              <h2>Nova campanha</h2>
              <p>Prepare a mensagem e salve para revisar antes de iniciar.</p>
            </div>
          </div>

          <label>
            Nome interno
            <input
              value={name}
              onChange={event => setName(event.target.value)}
              maxLength={120}
              placeholder="Ex.: Reposição de Baby Tee"
              disabled={loading || importingContacts}
            />
          </label>

          <label>
            Número de envio
            <select
              value={sessionKey}
              onChange={event => setSessionKey(event.target.value)}
              disabled={loading || importingContacts}
            >
              {availableSessions.map(session => (
                <option
                  value={session.key}
                  key={session.key}
                >
                  {session.label} — {formatSessionPhone(session.phone)}
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
            Público da campanha
            <select
              value={audienceListId}
              onChange={event => setAudienceListId(event.target.value)}
              disabled={
                loading ||
                importingContacts ||
                !contactListsLoaded ||
                Boolean(contactListsError)
              }
            >
              <option value="unselected" disabled>
                Selecione o público antes de continuar
              </option>
              <option value="all">
                Todos os contatos elegíveis{contactsCount === null ? "" : ` — ${contactsCount.toLocaleString("pt-BR")}`}
              </option>
              {contactLists
                .filter(list => list.status === "ready")
                .map(list => (
                  <option value={list.id} key={list.id}>
                    {list.name} — {list.contacts_count.toLocaleString("pt-BR")}
                  </option>
                ))}
            </select>
            <small>
              {contactListsError
                ? "Recarregue as carteiras para liberar a escolha do público. "
                : contactListsLoading && !contactListsLoaded
                  ? "Carregando carteiras e contatos elegíveis… "
                  : audienceListId === "unselected"
                ? "Escolha explicitamente a carteira ou o público geral. "
                : audienceCount === null
                  ? "Conferindo o público elegível…"
                  : `${audienceCount.toLocaleString("pt-BR")} contatos elegíveis agora. `}
              A carteira fica salva no rascunho; ao iniciar, a fila é congelada e cada telefone entra uma única vez.
            </small>
            {contactListsError && (
              <button
                type="button"
                className={styles.audienceRetryButton}
                onClick={() => void loadContactLists()}
                disabled={contactListsLoading}
              >
                <RotateCcw size={13} />
                {contactListsLoading ? "Recarregando…" : "Recarregar carteiras"}
              </button>
            )}
          </label>

          <label>
            Mensagem
            <textarea
              value={message}
              onChange={event => setMessage(event.target.value)}
              maxLength={1500}
              rows={7}
              placeholder="Oi, {{nome}}! Chegaram novidades na Moda Pink 💗"
              disabled={loading || importingContacts}
            />
            <small>
              Use <code>{"{{nome}}"}</code> para personalizar. <span className={styles.characterCount}>{message.length}/1500</span>
            </small>
          </label>

          <label>
            Imagem ou vídeo
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
              onChange={selectMedia}
              disabled={loading || importingContacts}
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
                  disabled={loading || importingContacts}
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
              <span><WhatsAppIcon size={14} aria-hidden="true" /> Prévia da mensagem</span>
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
            type="button"
            onClick={createDraft}
            disabled={
              loading ||
              importingContacts ||
              !contactListsLoaded ||
              Boolean(contactListsError)
            }
          >
            <Save size={16} /> {loading ? "Aguarde…" : "Salvar rascunho"}
          </button>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeading}>
            <div>
              <h2>Suas campanhas <span className={styles.listCount}>{visibleCampaigns.length}</span></h2>
              <p>Últimas 50 campanhas. Canceladas são removidas desta lista.</p>
            </div>
            <label className={styles.statusFilter}>
              <span className={styles.srOnly}>Filtrar campanhas por status</span>
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)}>
                <option value="all">Todos os status</option>
                <option value="draft">Rascunhos</option>
                <option value="running">Em envio</option>
                <option value="paused">Pausadas</option>
                <option value="completed">Concluídas</option>
              </select>
            </label>
          </div>

          {loadingList ? (
            <p className={styles.empty}>Carregando campanhas...</p>
          ) : campaigns.length === 0 ? (
            <div className={styles.empty}><Megaphone size={25} /><strong>Sua primeira campanha começa aqui</strong><p>Prepare a mensagem no formulário e salve um rascunho.</p></div>
          ) : visibleCampaigns.length === 0 ? (
            <div className={styles.empty}><Megaphone size={25} /><strong>Nenhuma campanha neste status</strong><p>Escolha outro status para visualizar as campanhas.</p></div>
          ) : (
            <div className={styles.campaignList}>
              {visibleCampaigns.map(campaign => {
                const progress = campaign.total_count
                  ? Math.min(100, Math.max(0, Math.round(
                      ((campaign.sent_count + campaign.failed_count + campaign.skipped_count) /
                        campaign.total_count) * 100
                    )))
                  : 0

                return (
                  <article className={styles.campaign} key={campaign.id}>
                    <div className={styles.campaignTop}>
                      <div>
                        <h3>{campaign.name}</h3>
                        <span className={styles.campaignChannel}><WhatsAppIcon size={13} aria-hidden="true" /> {getCampaignSenderDisplay(campaign)}</span>
                        <span className={styles.campaignAudience}><Users size={13} aria-hidden="true" /> {getAudienceLabel(campaign)}</span>
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
                            loading="lazy"
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

                    <div className={styles.progressHeading}><span>Progresso da fila</span><strong>{progress}%</strong></div>
                    <div className={styles.progressTrack} role="progressbar" aria-label={`Progresso de ${campaign.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                      <span style={{ width: `${progress}%` }} />
                    </div>
                    <div className={styles.metrics}>
                      <span><strong>{campaign.sent_count}</strong> enviadas</span>
                      <span><strong>{campaign.failed_count}</strong> falhas</span>
                      <span><strong>{campaign.skipped_count}</strong> ignoradas</span>
                      <span><strong>{campaign.total_count || "—"}</strong> total</span>
                    </div>

                    {campaignActionErrors[campaign.id] && (
                      <p className={styles.campaignError} role="alert">
                        <AlertTriangle size={14} aria-hidden="true" />
                        <span>{campaignActionErrors[campaign.id]}</span>
                      </p>
                    )}

                    <div className={styles.actions}>
                      {campaign.status === "draft" && (
                        <button onClick={() => runAction(campaign, "start")} disabled={loading}>
                          <Play size={15} />
                          {campaignAction?.campaignId === campaign.id &&
                          campaignAction.action === "start"
                            ? campaignAction.phase === "checking"
                              ? "Conferindo…"
                              : "Iniciando…"
                            : "Iniciar"}
                        </button>
                      )}
                      {campaign.status === "running" && (
                        <button onClick={() => runAction(campaign, "pause")} disabled={loading}>
                          <Pause size={15} />
                          {campaignAction?.campaignId === campaign.id &&
                          campaignAction.action === "pause"
                            ? "Pausando…"
                            : "Pausar"}
                        </button>
                      )}
                      {campaign.status === "paused" && (
                        <button onClick={() => runAction(campaign, "resume")} disabled={loading}>
                          <RotateCcw size={15} />
                          {campaignAction?.campaignId === campaign.id &&
                          campaignAction.action === "resume"
                            ? "Retomando…"
                            : "Retomar"}
                        </button>
                      )}
                      {["draft", "running", "paused"].includes(campaign.status) && (
                        <button
                          className={styles.cancelButton}
                          onClick={() => runAction(campaign, "cancel")}
                          disabled={loading}
                        >
                          <Square size={14} />
                          {campaignAction?.campaignId === campaign.id &&
                          campaignAction.action === "cancel"
                            ? "Cancelando…"
                            : "Cancelar"}
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
