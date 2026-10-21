export const RECOVERY_TIME_ZONE = "America/Sao_Paulo"
export const RECOVERY_STALE_AFTER_MS = 15 * 60 * 1000

export const RECOVERY_LIMITATIONS = [
  "source_unavailable", "credentials_missing", "orders_incomplete", "carts_incomplete",
  "messages_incomplete", "payment_time_missing", "send_evidence_missing", "link_unverified",
  "amount_unverified", "currency_unsupported", "conflicting_order_snapshot", "historical_coverage_unverified"
] as const

export type CartRecoverySummary = {
  version: 1
  window: { startInclusive: string; endExclusive: string; timeZone: typeof RECOVERY_TIME_ZONE; days: 90 }
  checkedAt: string
  status: "complete" | "partial"
  aggregate: {
    confirmedOrders: number | null; recoveredCarts: number | null
    grossCents: number | null; productsCents: number | null
    sentCarts: number | null; recoveryRate: null
  }
  coverage: {
    checkedOrders: number; scannedCarts: number; scannedMessages: number; orderPages: number
    latestOrderUpdatedAt: string | null; unresolved: number
    paymentTimestampOrders: number; missingPaymentTimestampCandidates: number; inProgress: boolean
  }
  limitations: string[]
  cached: boolean
  freshness?: {
    mode: "full" | "incremental"; state: "idle" | "running" | "failed"
    lastCompletedAt: string | null; lastFullScanAt: string | null; refreshIntervalSeconds: 60
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_recovery_summary")
  return value as Record<string, unknown>
}

function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("invalid_recovery_summary")
  return value
}

function nullableCount(value: unknown) { return value === null ? null : count(value) }

function timestamp(value: unknown): string {
  // Require an explicit offset: never interpret an upstream date in the server/browser's timezone.
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error("invalid_recovery_summary")
  }
  return new Date(value).toISOString()
}

// Reconstruct the allowlisted aggregate. Never relay customer records, tokens,
// checkout URLs, upstream errors or unknown fields to the browser.
export function parseCartRecoverySummary(input: unknown, now = Date.now()): CartRecoverySummary {
  const source = record(input)
  const window = record(source.window)
  const aggregate = record(source.aggregate)
  const coverage = record(source.coverage)
  if (source.version !== 1 || window.days !== 90 || window.timeZone !== RECOVERY_TIME_ZONE ||
      (source.status !== "complete" && source.status !== "partial") || typeof source.cached !== "boolean" ||
      aggregate.recoveryRate !== null || !Array.isArray(source.limitations) ||
      source.limitations.some(item => typeof item !== "string") || typeof coverage.inProgress !== "boolean") throw new Error("invalid_recovery_summary")

  const startInclusive = timestamp(window.startInclusive)
  const endExclusive = timestamp(window.endExclusive)
  const checkedAt = timestamp(source.checkedAt)
  const duration = Date.parse(endExclusive) - Date.parse(startInclusive)
  const parts = (value: string) => Object.fromEntries(new Intl.DateTimeFormat("en", {
    timeZone: RECOVERY_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date(value)).map(part => [part.type, part.value]))
  const start = parts(startInclusive)
  const end = parts(endExclusive)
  const calendarDay = (value: Record<string, string>) => Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day))
  if (duration < 89 * 86400000 || duration > 90 * 86400000 ||
      start.hour !== "00" || start.minute !== "00" || start.second !== "00" || new Date(startInclusive).getUTCMilliseconds() !== 0 ||
      calendarDay(end) - calendarDay(start) !== 89 * 86400000 ||
      Date.parse(checkedAt) < Date.parse(endExclusive) || Date.parse(checkedAt) > now + 60000) throw new Error("invalid_recovery_summary")

  const result: CartRecoverySummary = {
    version: 1,
    window: { startInclusive, endExclusive, timeZone: RECOVERY_TIME_ZONE, days: 90 },
    checkedAt, status: source.status,
    aggregate: {
      confirmedOrders: nullableCount(aggregate.confirmedOrders), recoveredCarts: nullableCount(aggregate.recoveredCarts),
      grossCents: nullableCount(aggregate.grossCents), productsCents: nullableCount(aggregate.productsCents),
      sentCarts: nullableCount(aggregate.sentCarts), recoveryRate: null
    },
    coverage: {
      checkedOrders: count(coverage.checkedOrders), scannedCarts: count(coverage.scannedCarts),
      scannedMessages: count(coverage.scannedMessages), orderPages: count(coverage.orderPages),
      latestOrderUpdatedAt: coverage.latestOrderUpdatedAt === null ? null : timestamp(coverage.latestOrderUpdatedAt),
      unresolved: count(coverage.unresolved), paymentTimestampOrders: count(coverage.paymentTimestampOrders),
      missingPaymentTimestampCandidates: count(coverage.missingPaymentTimestampCandidates), inProgress: coverage.inProgress
    },
    limitations: [...new Set(source.limitations.map(item =>
      (RECOVERY_LIMITATIONS as readonly string[]).includes(item) ? item : "source_unavailable"))],
    cached: source.cached
  }
  const a = result.aggregate
  if (source.freshness !== undefined) {
    const freshness = record(source.freshness)
    if (typeof freshness.mode !== "string" || !["full", "incremental"].includes(freshness.mode) ||
        typeof freshness.state !== "string" || !["idle", "running", "failed"].includes(freshness.state) || freshness.refreshIntervalSeconds !== 60) throw new Error("invalid_recovery_summary")
    const lastCompletedAt = freshness.lastCompletedAt === null ? null : timestamp(freshness.lastCompletedAt)
    const lastFullScanAt = freshness.lastFullScanAt === null ? null : timestamp(freshness.lastFullScanAt)
    if ([lastCompletedAt, lastFullScanAt].some(value => value !== null && Date.parse(value) > now + 60000) ||
        (lastCompletedAt === null && lastFullScanAt !== null) ||
        (lastCompletedAt !== null && Date.parse(lastCompletedAt) > Date.parse(checkedAt)) ||
        (lastCompletedAt !== null && lastFullScanAt !== null && Date.parse(lastFullScanAt) > Date.parse(lastCompletedAt)) ||
        (freshness.state === "running") !== result.coverage.inProgress) throw new Error("invalid_recovery_summary")
    result.freshness = {
      mode: freshness.mode as "full" | "incremental", state: freshness.state as "idle" | "running" | "failed",
      lastCompletedAt, lastFullScanAt, refreshIntervalSeconds: 60
    }
  }
  if ((a.confirmedOrders !== null && a.confirmedOrders > result.coverage.checkedOrders) ||
      (a.recoveredCarts !== null && a.recoveredCarts > result.coverage.scannedCarts) ||
      (a.sentCarts !== null && a.sentCarts > result.coverage.scannedCarts) ||
      (a.grossCents !== null && a.productsCents !== null && a.productsCents > a.grossCents) ||
      result.coverage.paymentTimestampOrders !== (a.confirmedOrders ?? 0) ||
      result.coverage.missingPaymentTimestampCandidates > result.coverage.unresolved ||
      (source.status === "complete" && ((result.coverage.inProgress && !result.freshness?.lastCompletedAt) || result.coverage.unresolved > 0 || result.limitations.length > 0 ||
        [a.confirmedOrders, a.recoveredCarts, a.grossCents, a.productsCents, a.sentCarts].some(value => value === null)))) {
    throw new Error("invalid_recovery_summary")
  }
  return result
}

export function recoveryIsStale(data: CartRecoverySummary, now = Date.now()) {
  return now - Date.parse(data.checkedAt) > RECOVERY_STALE_AFTER_MS || Date.parse(data.checkedAt) > now + 60000
}

export function recoveryMetricValue(data: CartRecoverySummary | null, value: number | null | undefined, money = false, unavailable = false, now = Date.now()) {
  if (!data || value === null || value === undefined) return "—"
  const previousSnapshot = data.freshness?.state === "failed" || (data.freshness?.state === "running" && data.freshness.lastCompletedAt !== null)
  const incomplete = data.status !== "complete" || unavailable || previousSnapshot || recoveryIsStale(data, now)
  // A partial scan, old response or failed refresh can never prove zero recoveries.
  if (incomplete && value === 0) return "—"
  const formatted = money
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100)
    : value.toLocaleString("pt-BR")
  return `${data.status === "partial" && !unavailable && !previousSnapshot && !recoveryIsStale(data, now) && value > 0 ? "≥ " : ""}${formatted}`
}

export function recoveryTimestamp(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: RECOVERY_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value))
}
