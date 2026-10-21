"use client"

import { useEffect, useState } from "react"
import { ArrowUpRight, CheckCircle2, ShoppingBag, ShoppingCart, TrendingUp } from "lucide-react"
import styles from "./SalesFunnel.module.css"
import {
  parseCartRecoverySummary, recoveryIsStale, recoveryMetricValue, recoveryTimestamp,
  type CartRecoverySummary
} from "@/lib/cart-recovery-summary"

export default function SalesFunnel() {
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [data, setData] = useState<CartRecoverySummary | null>(null)

  useEffect(() => {
    let active = true
    let requestInFlight = false
    let controller: AbortController | null = null
    let pollTimer: number | undefined
    const isVisible = () => document.visibilityState === "visible"

    async function loadFunnel() {
      if (!active || requestInFlight || !isVisible()) return
      window.clearTimeout(pollTimer)
      requestInFlight = true
      controller = new AbortController()
      const timeout = window.setTimeout(() => controller?.abort(), 55000)
      let nextDelay = 60000
      try {
        const response = await fetch("/api/dashboard/cart-recovery", { cache: "no-store", signal: controller.signal })
        if (!response.ok) throw new Error("verification_unavailable")
        const summary = parseCartRecoverySummary(await response.json())
        if (!active) return
        setData(summary)
        setUnavailable(false)
        // A request already spends up to 20s advancing a scan. Continue slices
        // promptly, but never overlap requests or restart the full history here.
        nextDelay = summary.coverage.inProgress ? 1000 : 60000
      } catch {
        if (active) setUnavailable(true)
      } finally {
        window.clearTimeout(timeout)
        requestInFlight = false
        if (active) {
          setLoading(false)
          if (isVisible()) pollTimer = window.setTimeout(() => void loadFunnel(), nextDelay)
        }
      }
    }

    void loadFunnel()
    const onVisibility = () => {
      window.clearTimeout(pollTimer)
      if (isVisible()) void loadFunnel()
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      active = false
      controller?.abort()
      window.clearTimeout(pollTimer)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  const partial = data?.status === "partial"
  const stale = data ? recoveryIsStale(data) : false
  const metrics = [
    {
      label: "Valor recuperado",
      value: recoveryMetricValue(data, data?.aggregate.productsCents, true, unavailable),
      detail: "Produtos pagos, sem frete e após descontos",
      icon: TrendingUp,
      featured: true
    },
    {
      label: "Compras recuperadas",
      value: recoveryMetricValue(data, data?.aggregate.confirmedOrders, false, unavailable),
      detail: "Pagas após o contato comprovado",
      icon: CheckCircle2
    },
    {
      label: "Carrinhos recuperados",
      value: recoveryMetricValue(data, data?.aggregate.recoveredCarts, false, unavailable),
      detail: "Vínculo exato com a compra paga",
      icon: ShoppingBag
    },
    {
      label: "Recuperações enviadas",
      value: recoveryMetricValue(data, data?.aggregate.sentCarts, false, unavailable),
      detail: "Carrinhos com envio no período",
      icon: ShoppingCart
    }
  ]

  return (
    <article className={styles.card} aria-busy={loading}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Vendas pelo WhatsApp</span>
          <h2>Recuperação de carrinhos · últimos 90 dias</h2>
        </div>
        <span className={styles.period}>Automático</span>
      </header>

      <p className={styles.window}>
        {data
          ? `${recoveryTimestamp(data.window.startInclusive)} até ${recoveryTimestamp(data.window.endExclusive)} (Brasília).`
          : "Período móvel de 90 dias, incluindo hoje, no horário de Brasília."}
      </p>

      <div className={styles.metrics}>
        {metrics.map((metric) => {
          const Icon = metric.icon
          return (
            <div key={metric.label} className={styles.metric + (metric.featured ? " " + styles.featured : "")}>
              <span className={styles.label}><Icon size={15} aria-hidden="true" />{metric.label}</span>
              <strong className={loading ? styles.loadingValue : undefined}>{loading ? "—" : metric.value}</strong>
              <small>{metric.detail}</small>
            </div>
          )
        })}
      </div>

      <footer className={styles.footer}>
        <p><ArrowUpRight size={14} aria-hidden="true" />Pagamento na Nuvemshop após envio comprovado. Sem cancelamentos ou reembolsos.</p>
        {data && <p>Conferência: {recoveryTimestamp(data.checkedAt)} (Brasília).</p>}
        <p>Atualiza automaticamente enquanto o painel estiver aberto e visível. Ao voltar à aba, confere novamente.</p>
      </footer>

      {data && !loading && data.coverage.unresolved > 0 && (
        <div className={styles.pending} aria-label="Pendências da conferência">
          <strong>Pendências fora do valor confirmado</strong>
          {data.coverage.missingPaymentTimestampCandidates > 0 && (
            <p>{data.coverage.missingPaymentTimestampCandidates.toLocaleString("pt-BR")} pedido(s) pago(s) sem data de pagamento comprovada.</p>
          )}
          {data.coverage.unresolved > data.coverage.missingPaymentTimestampCandidates && (
            <p>{(data.coverage.unresolved - data.coverage.missingPaymentTimestampCandidates).toLocaleString("pt-BR")} outro(s) registro(s) sem comprovação completa.</p>
          )}
          <p>Essas pendências não são somadas às compras recuperadas.</p>
        </div>
      )}

      <p className={styles.notice} role="status">
        {loading ? "Conferindo os pagamentos e os contatos de recuperação…"
          : unavailable ? data
            ? "A atualização falhou. Os valores exibidos são da conferência anterior, não do momento atual."
            : "Não foi possível conferir os resultados. Isso não significa zero recuperações. Tentaremos novamente."
          : data?.freshness?.state === "failed" ? data.freshness.lastCompletedAt !== null
            ? "A atualização automática falhou. Mantemos a conferência anterior e tentaremos novamente."
            : "A atualização automática não pôde ser concluída. Os resultados ainda não estão confirmados. Tentaremos novamente."
          : data?.freshness?.state === "running" && data.freshness.lastCompletedAt !== null ? "Atualizando automaticamente. Os valores exibidos são da última conferência concluída e podem mudar após a nova verificação."
          : stale ? "A última conferência está desatualizada. Os valores não representam uma consulta atual."
          : data?.limitations.includes("credentials_missing") ? "A conexão com a Nuvemshop está indisponível para conferência. Isso não significa zero recuperações."
          : data?.coverage.inProgress ? "Conferência em andamento: os valores com ≥ são o mínimo já comprovado. A consulta continuará automaticamente."
          : partial ? "Conferência parcial: os valores com ≥ são apenas o mínimo comprovado. O total real ainda não está confirmado."
          : "Conferência concluída para os contatos registrados. O período considera a data do pagamento, não a criação do carrinho."}
        {data?.limitations.includes("historical_coverage_unverified") && !loading && " O histórico pode conter contatos ou pagamentos sem registro suficiente."}
      </p>
    </article>
  )
}
