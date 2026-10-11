export type PeriodId = "7d" | "30d" | "month" | "lastMonth"
export type MetricId = "conversations" | "checkouts" | "carts" | "payments"

export type MessageRow = {
  id?: string | null
  conversation_id?: string | null
  sender?: string | null
  created_at?: string | null
  content?: string | null
  text?: string | null
  body?: string | null
  message?: string | null
  caption?: string | null
  intent?: string | null
  flow?: string | null
  step?: string | null
}

export type ActivityDay = {
  date: string
  label: string
  fullLabel: string
  value: number
}

const TIME_ZONE = "America/Sao_Paulo"
const DAY_MS = 86_400_000
// São Paulo has used UTC−03 year-round since 2019. Build dashboard ranges in
// that zone instead of using the browser's local midnight or setDate().
const SP_OFFSET_MS = 3 * 60 * 60 * 1000
const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

export function formatDateKey(date: Date): string {
  if (Number.isNaN(date.getTime())) return ""
  const parts = dayFormatter.formatToParts(date)
  return ["year", "month", "day"]
    .map(type => parts.find(part => part.type === type)?.value)
    .join("-")
}

function saoPauloMidnight(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day) + SP_OFFSET_MS)
}

export function getDateRange(period: PeriodId, now = new Date()) {
  if (Number.isNaN(now.getTime())) throw new RangeError("Invalid dashboard date")
  const [year, month, day] = formatDateKey(now).split("-").map(Number)
  const today = saoPauloMidnight(year, month - 1, day)
  let start = new Date(today.getTime())
  let endExclusive = new Date(today.getTime() + DAY_MS)

  if (period === "7d") start = new Date(today.getTime() - 6 * DAY_MS)
  if (period === "30d") start = new Date(today.getTime() - 29 * DAY_MS)
  if (period === "month") start = saoPauloMidnight(year, month - 1, 1)
  if (period === "lastMonth") {
    start = saoPauloMidnight(year, month - 2, 1)
    endExclusive = saoPauloMidnight(year, month - 1, 1)
  }
  return { start, endExclusive }
}

export function listDays(period: PeriodId, now = new Date()): ActivityDay[] {
  const { start, endExclusive } = getDateRange(period, now)
  const shortFormatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    ...(period === "7d" ? { weekday: "short" as const } : { day: "2-digit" as const, month: "2-digit" as const }),
  })
  const fullFormatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  const days: ActivityDay[] = []
  for (let time = start.getTime(); time < endExclusive.getTime(); time += DAY_MS) {
    const date = new Date(time)
    days.push({
      date: formatDateKey(date),
      label: shortFormatter.format(date).replace(/\.$/, ""),
      fullLabel: fullFormatter.format(date),
      value: 0,
    })
  }
  return days
}

export function normalizeText(value?: string | null): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

export function getMessageText(message: MessageRow): string {
  return [message.text, message.content, message.body, message.message,
    message.caption, message.intent, message.flow, message.step]
    .filter(value => typeof value === "string" && value.trim())
    .join("\n")
}

export function isOutgoingMessage(message: MessageRow): boolean {
  return ["agent", "bot", "system", "automacao", "automacoes"]
    .includes(normalizeText(message.sender))
}

export function isCheckoutSignal(message: MessageRow): boolean {
  if (!isOutgoingMessage(message)) return false
  const text = normalizeText(getMessageText(message))
  return ["checkout", "link de compra", "link do pedido", "finalizar compra",
    "finalize sua compra", "pedido criado", "pedido gerado", "draft_order",
    "draft order", "/checkout", "comprar agora"]
    .some(signal => text.includes(signal))
}

export function isCartRecoverySignal(message: MessageRow): boolean {
  if (!isOutgoingMessage(message)) return false
  const text = normalizeText(getMessageText(message))
  return ["carrinho abandonado", "recuperacao de carrinho", "recuperar carrinho",
    "carrinho enviado", "abandoned cart", "seu carrinho", "carrinho esperando",
    "ficou no carrinho", "esqueceu seu carrinho"]
    .some(signal => text.includes(signal))
}

// These are payment notification signals, not a count or value of orders sold.
// In particular, an outgoing explanation of what happens *after* approval is
// not proof that a payment has already been approved.
export function isPaymentSignal(message: MessageRow): boolean {
  if (!isOutgoingMessage(message)) return false
  const textFields = [message.text, message.content, message.body, message.message, message.caption]
  const confirmation = /\b(?:pagamento\s+(?:(?:foi|esta|ja esta|ja foi)\s+)?(?:aprovado|confirmado)|pedido\s+(?:(?:foi|esta|ja esta|ja foi)\s+)?(?:aprovado|pago)|venda\s+(?:foi\s+)?confirmada|compra\s+(?:foi\s+)?aprovada|order\s+(?:is\s+)?paid|payment\s+(?:is\s+)?(?:approved|confirmed))\b/g
  const disqualifier = /\b(?:nao|nunca|ainda|aguardando|aguarde|pendente|apos|depois|quando|caso|se|assim que|ate|antes|precisa|precisamos|necessario|sera|ser|for|pode|poderia|deve|devera|sem|upon|after|once|if|not|unpaid|pending|will|would|must)\b/

  for (const value of textFields) {
    if (!value) continue
    // Preserve sentence boundaries before whitespace normalization.
    const sentences = value.match(/[^.!?\n;]+[.!?\n;]*/g) || []
    for (const sentence of sentences) {
      const normalized = normalizeText(sentence).replace(/[*_`]/g, "")
      confirmation.lastIndex = 0
      for (const match of normalized.matchAll(confirmation)) {
        const prefix = normalized.slice(0, match.index)
        const suffix = normalized.slice((match.index || 0) + match[0].length)
        if (disqualifier.test(prefix)) continue
        if (/^\s*(?:nao|ainda nao|pendente|somente apos|so quando|apenas quando|only if)\b/.test(suffix)) continue
        // A question or an instruction to obtain approval is not a notification.
        if (/\?/.test(sentence) || /\b(?:como|confirme|confirmar|verificar|verifique|simule|exemplo)\b/.test(prefix)) continue
        return true
      }
    }
  }
  return false
}

export function buildDailyActivity(
  days: ActivityDay[],
  rows: MessageRow[],
  metric: MetricId,
): ActivityDay[] {
  const result = days.map(day => ({ ...day, value: 0 }))
  const byDate = new Map(result.map(day => [day.date, day]))
  const counted = new Set<string>()
  rows.forEach((row, index) => {
    if (!row.created_at) return
    const date = new Date(row.created_at)
    const key = formatDateKey(date)
    const day = byDate.get(key)
    if (!day) return
    if (metric === "checkouts" && !isCheckoutSignal(row)) return
    if (metric === "carts" && !isCartRecoverySignal(row)) return
    if (metric === "payments" && !isPaymentSignal(row)) return

    const rowKey = row.id || `row:${index}`
    const countKey = metric === "payments"
      ? `${key}:${row.conversation_id || row.id || `${row.created_at}:${normalizeText(getMessageText(row))}`}`
      : rowKey
    if (counted.has(countKey)) return
    counted.add(countKey)
    day.value += 1
  })
  return result
}
