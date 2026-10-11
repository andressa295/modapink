export type CampaignMetricRow = {
  status: string
  sent_count?: number | string | null
}

export type CampaignSummary = {
  campaigns: number
  completed: number
  running: number
  sent: number
}

function sentCount(value: CampaignMetricRow["sent_count"]) {
  if (typeof value !== "number" && typeof value !== "string") return 0
  if (typeof value === "string" && !value.trim()) return 0
  const count = Number(value)
  return Number.isSafeInteger(count) && count >= 0 ? count : 0
}

export function summarizeCampaigns(rows: readonly CampaignMetricRow[]): CampaignSummary {
  return rows.reduce<CampaignSummary>((summary, row) => {
    if (row.status === "cancelled") return summary
    summary.campaigns += 1
    summary.completed += row.status === "completed" ? 1 : 0
    summary.running += row.status === "running" ? 1 : 0
    summary.sent += sentCount(row.sent_count)
    return summary
  }, { campaigns: 0, completed: 0, running: 0, sent: 0 })
}
