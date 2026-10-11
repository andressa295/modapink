"use client"

import { useEffect, useState } from "react"
import { ArrowUpRight, CheckCircle2, ShoppingBag, ShoppingCart, TrendingUp } from "lucide-react"
import styles from "./SalesFunnel.module.css"
import { createClient } from "@/lib/supabase/client"

type FunnelData = {
  cartsSent: number
  cartsRecovered: number
  confirmedSales: number
  recoveredValue: number
}

type SalesFunnelRpcRow = {
  carts_sent: number | string | null
  carts_recovered: number | string | null
  confirmed_sales: number | string | null
  recovered_value: number | string | null
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2
  }).format(value)
}

export default function SalesFunnel() {
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [data, setData] = useState<FunnelData | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let active = true
    let requestInFlight = false

    async function loadFunnel() {
      if (requestInFlight || document.visibilityState === "hidden") return
      requestInFlight = true

      try {
        const { data: result, error } = await supabase.rpc("get_sales_funnel_total")
        if (error) throw error
        const row = (Array.isArray(result) ? result[0] : result) as SalesFunnelRpcRow | undefined
        if (!row) throw new Error("Resumo comercial indisponível")
        if (!active) return

        setData({
          cartsSent: toNumber(row.carts_sent),
          cartsRecovered: toNumber(row.carts_recovered),
          confirmedSales: toNumber(row.confirmed_sales),
          recoveredValue: toNumber(row.recovered_value)
        })
        setUnavailable(false)
      } catch (error) {
        console.warn("Não foi possível carregar recuperação comercial:", error)
        if (active) setUnavailable(true)
      } finally {
        requestInFlight = false
        if (active) setLoading(false)
      }
    }

    void loadFunnel()
    const interval = window.setInterval(() => void loadFunnel(), 60000)
    const onVisibility = () => {
      if (document.visibilityState === "visible") void loadFunnel()
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      active = false
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  const recoveryRate = data && data.cartsSent > 0
    ? Math.round((data.cartsRecovered / data.cartsSent) * 100)
    : null

  const metrics = [
    {
      label: "Valor recuperado",
      value: data ? formatCurrency(data.recoveredValue) : "—",
      detail: "Receita dos carrinhos recuperados",
      icon: TrendingUp,
      featured: true
    },
    {
      label: "Compras recuperadas",
      value: data ? data.confirmedSales.toLocaleString("pt-BR") : "—",
      detail: "Vendas confirmadas na recuperação",
      icon: CheckCircle2
    },
    {
      label: "Carrinhos recuperados",
      value: data ? data.cartsRecovered.toLocaleString("pt-BR") : "—",
      detail: "Carrinhos que voltaram a comprar",
      icon: ShoppingBag
    },
    {
      label: "Recuperações enviadas",
      value: data ? data.cartsSent.toLocaleString("pt-BR") : "—",
      detail: "Contatos para recuperar carrinhos",
      icon: ShoppingCart
    }
  ]

  return (
    <article className={styles.card} aria-busy={loading}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Vendas pelo WhatsApp</span>
          <h2>Resultado da recuperação</h2>
        </div>
        <span className={styles.period}>Acumulado</span>
      </header>

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
        <p><ArrowUpRight size={14} aria-hidden="true" />Resultados das ações de recuperação de carrinhos.</p>
        <div className={styles.rate}>
          <span>Taxa de recuperação</span>
          <div className={styles.track} aria-hidden="true">
            <div style={{ width: (recoveryRate === null ? 0 : Math.min(100, Math.max(0, recoveryRate))) + "%" }} />
          </div>
          <strong>{loading || recoveryRate === null ? "—" : recoveryRate + "%"}</strong>
        </div>
      </footer>

      {unavailable && (
        <p className={styles.notice} role="status">
          {data ? "Atualização indisponível. Exibindo o último resultado carregado." : "Não foi possível carregar os resultados. Tentaremos novamente em instantes."}
        </p>
      )}
    </article>
  )
}
