"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { CalendarDays, ChevronDown, MessageCircle, ReceiptText, ShoppingCart, CreditCard, RefreshCw } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  buildDailyActivity, getDateRange, listDays,
  type PeriodId, type MetricId, type MessageRow,
} from "@/lib/dashboard-activity"
import styles from "./ConversationsChart.module.css"

const periods: { id: PeriodId; label: string }[] = [
  { id: "7d", label: "Últimos 7 dias" },
  { id: "30d", label: "Últimos 30 dias" },
  { id: "month", label: "Este mês" },
  { id: "lastMonth", label: "Mês passado" },
]
const metrics = [
  { id: "conversations" as const, label: "Conversas", description: "Novas conversas no período", icon: MessageCircle },
  { id: "checkouts" as const, label: "Checkouts", description: "Mensagens de checkout enviadas", icon: ReceiptText },
  { id: "carts" as const, label: "Carrinhos", description: "Mensagens sobre carrinhos enviadas", icon: ShoppingCart },
  { id: "payments" as const, label: "Pagamentos", description: "Conversas com aviso de pagamento aprovado", icon: CreditCard },
]
const messageSelects = [
  "id, conversation_id, sender, created_at, text, content, body, message, caption, intent, flow, step",
  "id, conversation_id, sender, created_at, text, content, caption, intent, flow, step",
  "id, conversation_id, sender, created_at, content, intent, flow, step",
  "id, conversation_id, sender, created_at, text, content",
  "id, conversation_id, sender, created_at, content",
  "id, conversation_id, sender, created_at, text",
]

async function loadRows(supabase: ReturnType<typeof createClient>, metric: MetricId, start: string, end: string) {
  const table = metric === "conversations" ? "conversations" : "messages"
  const selects = metric === "conversations" ? ["id, created_at"] : messageSelects
  let lastError: unknown
  for (const select of selects) {
    const rows: MessageRow[] = []
    let failed = false
    // Range requests keep counts complete even when the Data API caps each page.
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from(table).select(select)
        .gte("created_at", start).lt("created_at", end)
        .order("created_at", { ascending: true }).order("id", { ascending: true })
        .range(offset, offset + 499)
      if (error) { lastError = error; failed = true; break }
      rows.push(...((data || []) as unknown as MessageRow[]))
      if (!data || data.length < 500) return rows
    }
    if (!failed) return rows
  }
  throw lastError || new Error("Dados do gráfico indisponíveis")
}

function formatNumber(value: number) { return new Intl.NumberFormat("pt-BR").format(value) }

export default function ConversationsChart() {
  const chartId = useId().replace(/:/g, "")
  const requestSequence = useRef(0)
  const [period, setPeriod] = useState<PeriodId>("7d")
  const [metric, setMetric] = useState<MetricId>("conversations")
  const [refreshKey, setRefreshKey] = useState(0)
  const [data, setData] = useState<ReturnType<typeof listDays>>([])
  const [loading, setLoading] = useState(true)
  const [hasData, setHasData] = useState(false)
  const [error, setError] = useState(false)
  const [hovered, setHovered] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)
  const selected = metrics.find(item => item.id === metric) || metrics[0]

  useEffect(() => {
    const supabase = createClient()
    let active = true
    let inFlight = false
    const sequence = ++requestSequence.current
    setHasData(false)
    setData([])
    setHovered(null)
    setError(false)
    async function load(initial = false) {
      if (inFlight) return
      inFlight = true
      if (initial) setLoading(true)
      try {
        const range = getDateRange(period)
        const rows = await loadRows(supabase, metric, range.start.toISOString(), range.endExclusive.toISOString())
        if (!active || sequence !== requestSequence.current) return
        setData(buildDailyActivity(listDays(period), rows, metric))
        setHasData(true)
        setError(false)
      } catch (error) {
        console.warn("Não foi possível atualizar o gráfico:", error)
        if (active && sequence === requestSequence.current) setError(true)
      } finally {
        inFlight = false
        if (active && sequence === requestSequence.current) setLoading(false)
      }
    }
    load(true)
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") load() }, 60000)
    return () => { active = false; window.clearInterval(timer) }
  }, [period, metric, refreshKey])

  const total = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data])
  const bestDay = useMemo(() => data.length && total > 0 ? data.reduce((best, item) => item.value > best.value ? item : best, data[0]) : null, [data, total])
  const maximum = Math.max(1, ...data.map(item => item.value))
  const scale = Math.max(4, Math.ceil(maximum / 4) * 4)
  const width = 680, height = 180, left = 42, right = 16, top = 14, bottom = 14
  const plotHeight = height - top - bottom
  const points = data.map((item, index) => ({
    x: left + index / Math.max(1, data.length - 1) * (width - left - right),
    y: top + (1 - item.value / scale) * plotHeight,
  }))
  const linePath = points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ")
  const areaPath = points.length ? `${linePath} L ${points[points.length - 1].x} ${height - bottom} L ${points[0].x} ${height - bottom} Z` : ""
  const activeIndex = hovered !== null && data[hovered] ? hovered : null
  const tickStep = Math.max(1, Math.ceil((data.length - 1) / 6))

  return (
    <section className={styles.card} aria-label="Atividade comercial pelo WhatsApp" aria-busy={loading}>
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>DO PRIMEIRO CONTATO AO PAGAMENTO</span><h2>Jornada de compra</h2></div>
        <label className={styles.period}>
          <CalendarDays size={14} aria-hidden="true" />
          <span className={styles.srOnly}>Período do gráfico</span>
          <select value={period} onChange={event => setPeriod(event.target.value as PeriodId)}>
            {periods.map(option => <option value={option.id} key={option.id}>{option.label}</option>)}
          </select>
          <ChevronDown size={13} aria-hidden="true" />
        </label>
      </header>
      <div className={styles.tabs} aria-label="Indicador do gráfico">
        {metrics.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" aria-pressed={id === metric} className={id === metric ? styles.activeTab : styles.tab} onClick={() => setMetric(id)}>
            <Icon size={14} aria-hidden="true" />{label}
          </button>
        ))}
      </div>
      <div className={styles.summary}>
        <div className={styles.total}>
          <strong>{loading || !hasData ? "—" : formatNumber(total)}</strong>
          <span>{selected.description}</span>
        </div>
        <div className={styles.summaryDetail}>
          <span>Média por dia<strong>{loading || !hasData ? "—" : formatNumber(Math.round(total / Math.max(1, data.length)))}</strong></span>
          <span>Maior movimento<strong>{loading || !bestDay ? "—" : bestDay.label}</strong></span>
        </div>
      </div>
      {error && <div className={styles.error} role="status"><span>{hasData ? "Atualização indisponível. Exibindo a última consulta." : "Não foi possível carregar este indicador."}</span><button type="button" onClick={() => setRefreshKey(key => key + 1)}><RefreshCw size={12} aria-hidden="true" />Tentar novamente</button></div>}
      <div className={styles.graph}>
        {loading ? <div className={styles.loading} role="status">Carregando atividade…</div> : !hasData ? <div className={styles.empty}>O gráfico estará disponível quando a consulta for concluída.</div> : (
          <>
            <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${chartId}-title ${chartId}-description`} preserveAspectRatio="none" className={styles.svg}>
              <title id={`${chartId}-title`}>{selected.description}</title>
              <desc id={`${chartId}-description`}>{total} no período. Os valores de cada dia estão disponíveis abaixo do gráfico.</desc>
              {[0, 1, 2, 3, 4].map(step => {
                const y = top + step / 4 * plotHeight
                return <g key={step}><line x1={left} x2={width - right} y1={y} y2={y} className={styles.gridLine} /><text x={left - 10} y={y + 4} textAnchor="end" className={styles.axisText}>{formatNumber(scale * (1 - step / 4))}</text></g>
              })}
              <path d={areaPath} className={styles.area} />
              <path d={linePath} className={styles.line} />
              {activeIndex !== null && <line x1={points[activeIndex].x} x2={points[activeIndex].x} y1={top} y2={height - bottom} className={styles.crosshair} />}
              {points.map((point, index) => <circle key={data[index].date} cx={point.x} cy={point.y} r={activeIndex === index ? 5 : data.length <= 7 ? 3 : 0} className={styles.point} />)}
            </svg>
            <div className={styles.hitAreas} style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
              {data.map((item, index) => <button key={item.date} type="button" aria-label={`${item.fullLabel}: ${item.value} ${selected.label.toLowerCase()}`} onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(index)} onBlur={() => setHovered(null)} onClick={() => setHovered(index)} />)}
            </div>
            {activeIndex !== null && <div className={styles.tooltip} style={{ left: `${Math.min(85, Math.max(15, points[activeIndex].x / width * 100))}%` }} role="status"><span>{data[activeIndex].fullLabel}</span><strong>{formatNumber(data[activeIndex].value)} {selected.label.toLowerCase()}</strong></div>}
            <div className={styles.xAxis} aria-hidden="true">
              {data.map((item, index) => <span key={item.date} style={{ left: `${points[index].x / width * 100}%` }}>{index === 0 || index === data.length - 1 || (index % tickStep === 0 && index < data.length - 2) ? item.label : ""}</span>)}
            </div>
            {total === 0 && <span className={styles.zeroLabel}>Sem atividade neste indicador no período.</span>}
          </>
        )}
      </div>
      <footer className={styles.footer}>
        <span><i aria-hidden="true" />{metric === "conversations" ? "Conversas novas · horário de Brasília" : "Atividade nas mensagens · não representa receita"}</span>
        <button type="button" aria-expanded={showTable} onClick={() => setShowTable(value => !value)}>{showTable ? "Ocultar valores" : "Ver valores"}<ChevronDown size={12} aria-hidden="true" /></button>
      </footer>
      {showTable && <div className={styles.tableWrap}><table><caption>{selected.description} por dia</caption><thead><tr><th scope="col">Data</th><th scope="col">Quantidade</th></tr></thead><tbody>{data.map(item => <tr key={item.date}><td>{item.fullLabel}</td><td>{formatNumber(item.value)}</td></tr>)}</tbody></table></div>}
    </section>
  )
}
