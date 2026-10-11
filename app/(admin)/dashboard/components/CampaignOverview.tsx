"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowUpRight, CheckCheck, LoaderCircle, Megaphone, RefreshCw, Send } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { summarizeCampaigns, type CampaignMetricRow, type CampaignSummary } from "@/lib/campaign-overview"
import styles from "./CampaignOverview.module.css"

const API = process.env.NEXT_PUBLIC_API_URL
const numberFormat = new Intl.NumberFormat("pt-BR")

function isCampaignRow(value: unknown): value is CampaignMetricRow {
  return typeof value === "object" && value !== null &&
    "status" in value && typeof value.status === "string"
}

export default function CampaignOverview() {
  const [summary, setSummary] = useState<CampaignSummary | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    let inFlight = false
    let lastLoaded = 0
    let controller: AbortController | null = null

    async function loadSummary() {
      if (inFlight || document.visibilityState === "hidden") return
      inFlight = true
      controller = new AbortController()
      const timeout = window.setTimeout(() => controller?.abort(), 15000)

      try {
        if (!API) throw new Error("Não foi possível consultar as campanhas.")
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) throw new Error("Sua sessão expirou. Faça login novamente.")
        if (controller.signal.aborted) throw new Error("A consulta das campanhas demorou mais que o esperado.")

        const response = await fetch(`${API.replace(/\/+$/, "")}/broadcasts/`, {
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          signal: controller.signal,
        })
        const data = await response.json().catch(() => null)
        if (!response.ok || !data?.ok || !Array.isArray(data.campaigns) || !data.campaigns.every(isCampaignRow)) {
          throw new Error(typeof data?.error === "string" ? data.error : "Não foi possível carregar as campanhas.")
        }
        if (!active) return
        setSummary(summarizeCampaigns(data.campaigns))
        setError("")
        lastLoaded = Date.now()
      } catch (err) {
        if (active) setError(err instanceof Error && err.name !== "AbortError"
          ? err.message
          : "A consulta das campanhas demorou mais que o esperado.")
      } finally {
        window.clearTimeout(timeout)
        inFlight = false
        if (active) setLoading(false)
      }
    }

    void loadSummary()
    const onVisibility = () => {
      if (document.visibilityState === "visible" && Date.now() - lastLoaded >= 60000) {
        void loadSummary()
      }
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      active = false
      controller?.abort()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [revision])

  function refresh() {
    setLoading(true)
    setRevision(value => value + 1)
  }

  const metrics = [
    { label: "Campanhas", value: summary?.campaigns, icon: Megaphone },
    { label: "Concluídas", value: summary?.completed, icon: CheckCheck },
    { label: "Mensagens enviadas", value: summary?.sent, icon: Send },
  ]

  return (
    <section className={styles.card} aria-labelledby="campaign-overview-title" aria-busy={loading}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.eyebrow}>RELACIONAMENTO</span>
          <h2 id="campaign-overview-title">Campanhas</h2>
          <p>Seus disparos, organizados em um só lugar.</p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.refresh} onClick={refresh} disabled={loading} aria-label="Atualizar resumo das campanhas" title="Atualizar resumo">
            {loading ? <LoaderCircle size={15} className={styles.spin} aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />}
          </button>
          <Link href="/dashboard/disparos" className={styles.primaryLink}>Ver campanhas<ArrowUpRight size={14} aria-hidden="true" /></Link>
        </div>
      </header>

      <div className={styles.metrics}>
        {metrics.map(({ label, value, icon: Icon }) => (
          <div className={styles.metric} key={label}>
            <span className={styles.metricIcon}><Icon size={17} aria-hidden="true" /></span>
            <div><span className={styles.metricLabel}>{label}</span><strong>{value === undefined ? "—" : numberFormat.format(value)}</strong></div>
          </div>
        ))}
      </div>

      <footer className={styles.footer}>
        <p>{loading && !summary ? "Carregando campanhas…" : "Últimas 50 campanhas. Canceladas não entram nos números."}</p>
        <div className={styles.footerActions}>
          {summary && summary.running > 0 && <span className={styles.running}>{numberFormat.format(summary.running)} em andamento</span>}
          <Link href="/dashboard/relatorios">Relatórios<ArrowUpRight size={13} aria-hidden="true" /></Link>
        </div>
      </footer>

      {error && <div className={styles.notice} role="status">{summary ? "Consulta indisponível. Exibindo a última atualização. " : ""}{error}</div>}
      {!loading && !error && summary?.campaigns === 0 && <p className={styles.empty}>Suas campanhas aparecerão aqui quando você criar o primeiro disparo.</p>}
    </section>
  )
}
