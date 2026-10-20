"use client"

import { useEffect, useState } from "react"
import { ReceiptText } from "lucide-react"
import type { VerifiedSales } from "@/lib/attributed-sales"
import styles from "../styles/dashboard.module.css"

export default function ConfirmedSalesMetric() {
  const [data, setData] = useState<VerifiedSales | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    let inFlight = false
    let controller: AbortController | null = null
    async function load() {
      if (inFlight || document.visibilityState === "hidden") return
      inFlight = true
      controller = new AbortController()
      let timer: number | undefined
      let accumulated: VerifiedSales | null = null
      try {
        let cursor = ""
        const seen = new Set<string>()
        do {
          timer = window.setTimeout(() => controller?.abort(), 55000)
          const response = await fetch(`/api/dashboard/attributed-sales${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store", signal: controller.signal })
          const value = await response.json() as VerifiedSales
          window.clearTimeout(timer)
          if (!response.ok || !Number.isSafeInteger(value.confirmed) || value.confirmed < 0 ||
            !Number.isSafeInteger(value.unresolved) || value.unresolved < 0 || !Number.isSafeInteger(value.checked) || value.checked < 0 ||
            !Number.isSafeInteger(value.recordedLinks) || !Number.isSafeInteger(value.remaining) || value.remaining < 0 ||
            (value.nextCursor !== null && typeof value.nextCursor !== "string") || value.coverage !== "recorded_links_only" ||
            !Number.isFinite(Date.parse(value.checkedAt))) throw new Error("invalid_summary")
          accumulated = accumulated ? {
            ...value,
            confirmed: accumulated.confirmed + value.confirmed,
            grossCents: accumulated.grossCents + value.grossCents,
            productsCents: accumulated.productsCents + value.productsCents,
            checked: accumulated.checked + value.checked,
            unresolved: accumulated.unresolved + value.unresolved,
            // A multi-page result is only as fresh as its oldest verification.
            checkedAt: Date.parse(accumulated.checkedAt) < Date.parse(value.checkedAt) ? accumulated.checkedAt : value.checkedAt,
          } : value
          if (active) { setData(accumulated); setError(false) }
          cursor = value.nextCursor || ""
          if (cursor && seen.has(cursor)) throw new Error("repeated_cursor")
          seen.add(cursor)
        } while (cursor && active)
      } catch { if (active) setError(true) }
      finally { window.clearTimeout(timer); inFlight = false; if (active) setLoading(false) }
    }
    void load()
    const interval = window.setInterval(() => void load(), 300000)
    const visibility = () => { if (document.visibilityState === "visible") void load() }
    document.addEventListener("visibilitychange", visibility)
    return () => { active = false; controller?.abort(); window.clearInterval(interval); document.removeEventListener("visibilitychange", visibility) }
  }, [])
  const partial = Boolean(data && (data.unresolved > 0 || data.remaining > 0))
  const showCount = data && data.checked > 0
  const checkedAt = data ? new Date(data.checkedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""
  return <article className={styles.summaryCard} aria-busy={loading}>
    <div className={styles.summaryTop}><span>Vendas do atendimento</span><span className={`${styles.summaryIcon} ${styles.metricViolet}`}><ReceiptText size={16} aria-hidden="true" /></span></div>
    <strong className={styles.summaryValue}>{showCount ? `${partial ? "≥ " : ""}${data.confirmed}` : "—"}</strong>
    <p>{loading ? "Conferindo pagamentos na Nuvemshop…" : error ? (data ? "Consulta indisponível. Última conferência abaixo." : "Não foi possível conferir na Nuvemshop.") : partial ? `${(data?.unresolved || 0) + (data?.remaining || 0)} link(s) ainda sem consulta concluída` : data?.recordedLinks === 0 ? "Nenhum link com origem registrada" : "Pagas na Nuvemshop · acumulado"}</p>
    {data && <p>Links registrados, não todas as vendas. Conferido em {checkedAt} (Brasília).{error ? " Resultado anterior, não atualizado." : ""}</p>}
  </article>
}
