type Campaign = {
  status: string
  last_error?: string | null
  expected_sender_phone?: string | null
}

type Session = {
  status: string
  ready: boolean
  phone?: string | null
}

type Notice = { title: string; detail: string }

function phoneKey(value: string | null | undefined) {
  const digits = String(value || "").replace(/\D/g, "")
  return /^\d{10,15}$/.test(digits) ? digits : ""
}

/** Read-only presentation. Never expose raw error text or decide whether to send. */
export function getBroadcastDeliveryDiagnostic(
  campaign: Campaign,
  session: Session | undefined,
  sessionsConfirmed: boolean
): { senderLabel: string; notice: Notice | null } {
  const sessionKnown = sessionsConfirmed && Boolean(session) && session?.status !== "unknown"
  const ready = sessionKnown && session?.ready === true && session.status === "ready"
  const senderLabel = !sessionsConfirmed || !session || session.status === "unknown"
    ? "Remetente: estado não confirmado"
    : ready
      ? "Remetente: conectado na última consulta"
      : ["initializing", "connecting", "authenticated"].includes(session.status)
        ? "Remetente: conectando"
        : ["qr", "auth_failure"].includes(session.status)
          ? "Remetente: precisa conectar novamente"
          : "Remetente: indisponível na última consulta"

  const result = (title: string, detail: string) => ({ senderLabel, notice: { title, detail } })
  if (!["draft", "paused", "running"].includes(campaign.status)) {
    return { senderLabel, notice: null }
  }

  const reason = String(campaign.last_error || "").trim()
  // Uncertain delivery must never be presented as a routine reconnect/retry.
  if (campaign.status === "paused" && reason === "send_outcome_unknown") {
    return result("Envio sem confirmação", "Confira no WhatsApp se a última mensagem chegou e peça a conciliação desse envio no serviço antes de retomar. Preserve o histórico e não crie outra campanha para reenviar a mesma fila.")
  }

  const expected = phoneKey(campaign.expected_sender_phone)
  const connected = phoneKey(session?.phone)
  if (ready && expected && connected && expected !== connected) {
    return result("O remetente conectado é outro número", "Não retome com este número. Confira o remetente original na tela Números antes de continuar.")
  }
  if (campaign.status === "paused" && ["sender_phone_mismatch", "sender_session_mismatch", "invalid_sender_session", "sender_expected_phone_unavailable", "sender_phone_unavailable"].includes(reason)) {
    return result("Remetente precisa de conferência", "Confira o número conectado e o remetente escolhido na campanha. A verificação de segurança precisa passar antes de retomar.")
  }

  if (campaign.status === "paused" && (reason === "session_unavailable" || reason.startsWith("session_unavailable:"))) {
    if (ready && (!expected || !connected)) {
      return result("Telefone do remetente não confirmado", "A sessão está conectada na última consulta, mas falta confirmar seu telefone e o remetente da campanha. Confira a tela Números antes de continuar.")
    }
    if (ready && expected && connected === expected) {
      return result("A conexão voltou; campanha ainda pausada", "O remetente corresponde ao número esperado na última consulta. Confira a campanha e use Retomar para continuar a fila existente; a retomada não é automática.")
    }
    return result("Campanha pausada por queda do remetente", !sessionKnown
      ? "Não foi possível confirmar a conexão agora. Atualize a consulta e confira a tela Números antes de retomar."
      : "Confira e reconecte o remetente original na tela Números. Depois, atualize a consulta e retome esta campanha, sem criar outra para a mesma fila.")
  }

  if (campaign.status === "paused" && reason) {
    const notices: Record<string, Notice> = {
      human_service_state_unavailable: { title: "Verificação de atendimento indisponível", detail: "O sistema não conseguiu conferir quais clientes estão em atendimento humano. Essa proteção precisa voltar a funcionar antes de retomar." },
      marketing_suppression_unavailable: { title: "Verificação de descadastro indisponível", detail: "O sistema não conseguiu conferir quem pediu para não receber mensagens. Essa proteção precisa voltar a funcionar antes de retomar." },
      campaign_state_unavailable: { title: "Estado da campanha não confirmado", detail: "Atualize a consulta. Se o aviso continuar, peça a verificação do serviço antes de retomar." },
      state_unavailable: { title: "Controle de envios indisponível", detail: "O controle que evita envios duplicados precisa ser conferido antes de retomar. Não apague o histórico nem crie outra campanha para a mesma fila." },
      failure_cooldown: { title: "Pausa de proteção após falhas", detail: "Confira a conexão e aguarde o período de proteção antes de retomar." }
    }
    notices.recipient_suppression_state_unavailable = notices.marketing_suppression_unavailable
    notices.recipient_human_state_unavailable = notices.human_service_state_unavailable
    return { senderLabel, notice: Object.prototype.hasOwnProperty.call(notices, reason) ? notices[reason] : { title: "Campanha pausada; revisão necessária", detail: "O motivo desta pausa precisa ser conferido no serviço antes de retomar. A fila existente foi mantida." } }
  }

  if (!sessionKnown) {
    return result("Conexão ainda não confirmada", "Atualize a consulta antes de iniciar ou retomar. O último estado salvo não confirma que o remetente esteja conectado agora.")
  }
  if (!ready) {
    return result("Remetente indisponível", "Confira a conexão do remetente na tela Números antes de iniciar ou retomar a campanha.")
  }
  if (!expected || !connected) {
    return result("Telefone do remetente não confirmado", "Confira o número conectado e o remetente da campanha antes de iniciar ou retomar. Conexão disponível, sozinha, não confirma o telefone.")
  }
  if (campaign.status === "draft") {
    return result("Rascunho ainda não iniciado", "Salvar o rascunho não começa os envios. Confira a mensagem, o público e o remetente antes de usar Iniciar.")
  }
  if (campaign.status === "paused") {
    return result("Campanha pausada", "Nenhum motivo automático de pausa foi registrado. Confira a campanha antes de retomar a fila existente.")
  }
  return { senderLabel, notice: null }
}
