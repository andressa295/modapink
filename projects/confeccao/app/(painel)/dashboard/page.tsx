"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Plus, Download, Scissors, CircleCheck, RotateCcw, Layers, CalendarDays, ChevronRight, Clock3 } from "lucide-react";
import { useDemo } from "../../../lib/demo-store";
import { available, formatNumber, stages, today } from "../../../lib/domain";
import { Empty, Metric, PageHeading, PanelTitle, exportCsv } from "../../../components/ui";
import { NewOrder, OrderDetail, OrdersTable } from "../../../components/orders";
import { PartnerDashboardSummary } from "../../../components/partner-summary";

export default function Dashboard() {
  const { state, profile, canViewCosts, busy } = useDemo();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [period, setPeriod] = useState("week");
  const [hovered, setHovered] = useState<number | null>(null);
  const [productionStage, setProductionStage] = useState("Todas");
  const canProduce = ["admin", "gestao", "producao"].includes(profile?.role ?? "");
  const active = state.orders.filter(o => o.stage !== "Concluído" && o.stage !== "Planejado");
  const quantity = active.reduce((n, o) => n + o.quantity, 0);
  const approved = state.orders.reduce((n, o) => n + o.approved, 0);
  const rework = state.orders.reduce((n, o) => n + o.rework, 0);
  const fabrics = state.materials.filter(m => !m.archived && m.category === "Tecido" && m.unit === "kg");
  const low = state.materials.filter(m => !m.archived && available(m) < m.minimum);
  const late = state.orders.filter(o => o.stage !== "Concluído" && o.due < today());
  const total = state.orders.reduce((n, o) => n + o.quantity, 0);
  const overviewOrders = state.orders.filter(order => productionStage === "Todas" || order.stage === productionStage).sort((a, b) => Number(a.stage === "Concluído") - Number(b.stage === "Concluído") || a.due.localeCompare(b.due) || a.id.localeCompare(b.id));
  const daily = (state as typeof state & { dailyApprovals?: { date: string; quantity: number }[] }).dailyApprovals ?? [];
  const days = period === "week" ? 7 : 30;
  const groupSize = period === "week" ? 1 : 5;
  const end = new Date(`${today()}T12:00:00Z`);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - days + 1);
  const points = Array.from({ length: days / groupSize }, (_, i) => {
    const from = new Date(start); from.setUTCDate(from.getUTCDate() + i * groupSize);
    const to = new Date(from); to.setUTCDate(to.getUTCDate() + groupSize - 1);
    const fromKey = from.toISOString().slice(0, 10); const toKey = to.toISOString().slice(0, 10);
    const value = daily.filter(d => d.date >= fromKey && d.date <= toKey).reduce((sum, d) => sum + d.quantity, 0);
    const shortDate = (date: Date) => date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
    return { value, label: groupSize === 1 ? shortDate(from) : `${from.getUTCDate()}–${shortDate(to)}`, detail: groupSize === 1 ? shortDate(from) : `${shortDate(from)} a ${shortDate(to)}` };
  });
  const chartTotal = points.reduce((sum, point) => sum + point.value, 0);
  const chartMax = Math.max(4, Math.ceil(Math.max(0, ...points.map(point => point.value)) / 4) * 4);
  function download() {
    exportCsv("modapink-resumo-producao.csv", ["Produção", "Modelo", "Quantidade", "Etapa", "Prazo", "Aprovadas", "Retrabalho", "Perdas"], state.orders.map(o => [o.id, state.models.find(m => m.id === o.modelId)?.name ?? o.modelId, o.quantity, o.stage, o.due, o.approved, o.rework, o.lost]));
  }
  return <>
    <PageHeading eyebrow="VISÃO GERAL" title="Sua confecção, em movimento." description="Um olhar completo sobre cada etapa da sua produção.">
      <button className="button secondary" onClick={download} disabled={!state.orders.length}><Download size={15} /> Exportar</button>
      {canProduce && <button className="button primary" disabled={busy} onClick={() => setCreating(true)}><Plus size={17} /> Nova produção</button>}
    </PageHeading>
    <div className="dashboard-date"><span><CalendarDays size={14} />{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" })}</span><span><i /> Indicadores dos registros da sua confecção</span></div>
    <section className="metrics-grid" aria-label="Indicadores da confecção">
      <Metric label="Peças em produção" value={formatNumber(quantity)} note={`${active.length} lotes em andamento`} icon={<Scissors size={18} />} tag="Em movimento" />
      <Metric label="Peças aprovadas" value={formatNumber(approved)} note="aprovadas nas conferências dos lotes" icon={<CircleCheck size={18} />} tone="green" tag="Qualidade" />
      <Metric label="Em retrabalho" value={formatNumber(rework)} note="peças aguardando reconferência" icon={<RotateCcw size={18} />} tone="amber" />
      <Metric label="Tecido disponível" value={<>{formatNumber(fabrics.reduce((n, m) => n + available(m), 0))}<small>kg</small></>} note={`${low.length} materiais pedem atenção`} icon={<Layers size={18} />} tone="purple" />
    </section>
    <div className="dashboard-main-grid">
      <section className="panel chart-panel">
        <PanelTitle title="Aprovações da produção" subtitle="Conferências e reconferências registradas" action={<select className="compact-select" aria-label="Período do gráfico" value={period} onChange={e => setPeriod(e.target.value)}><option value="week">Últimos 7 dias</option><option value="month">Últimos 30 dias</option></select>} />
        <div className="chart-total"><strong>{formatNumber(chartTotal)}</strong><span>peças aprovadas no período</span><span className="chart-legend"><i /> Aprovadas</span></div>
        {chartTotal > 0 ? <div className="bar-chart"><div className="chart-y">{[1, .75, .5, .25, 0].map(r => <span key={r}>{formatNumber(chartMax * r, 0)}</span>)}</div><div className="chart-plot"><div className="chart-grid">{[1, 2, 3, 4, 5].map(n => <i key={n} />)}</div><div className="chart-bars">{points.map((point, i) => <button key={`${period}-${i}`} className={`bar-column ${i === points.length - 1 ? "current" : ""}`} aria-label={`${point.detail}: ${point.value} peças aprovadas`} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(i)} onBlur={() => setHovered(null)}><span className="bar-area"><span className={`bar-tooltip ${hovered === i ? "show" : ""}`}>{formatNumber(point.value)} peças</span><span className="bar" style={{ height: `${point.value / chartMax * 100}%`, minHeight: point.value ? undefined : 0 }} /></span><span className="bar-label">{point.label}</span></button>)}</div></div></div> : <Empty title="Sem aprovações neste período" text="O gráfico será preenchido conforme as peças forem conferidas." />}
        <div className="chart-foot"><span>Visibilidade para planejar a próxima coleção.</span>{canViewCosts && <Link href="/custos">Ver resultados <ArrowUpRight size={13} /></Link>}</div>
      </section>
      <section className="panel flow-panel"><PanelTitle title="Fluxo da produção" subtitle="Onde cada lote está agora" action={<span className="subtle-icon"><Scissors size={17} /></span>} /><div className="flow-list">{stages.map((stage, i) => { const orders = state.orders.filter(o => o.stage === stage); const count = orders.reduce((n, o) => n + o.quantity, 0); return <Link key={stage} href={`/producao?etapa=${encodeURIComponent(stage)}`} className={`flow-row flow-${i}`}><span className="flow-dot" /><div><span>{stage}<small>{orders.length} {orders.length === 1 ? "lote" : "lotes"}</small></span><div className="flow-track"><i style={{ width: `${total ? count / total * 100 : 0}%` }} /></div></div><strong>{formatNumber(count)}</strong></Link>; })}</div><Link href="/producao" className="panel-footer-link">Acompanhar produções <ArrowRight size={14} /></Link></section>
    </div>
    <div className="dashboard-bottom-grid"><section className="panel orders-panel production-overview-panel"><PanelTitle title="Etapa de cada produção" subtitle="Abra um lote para ver o próximo passo." action={<select className="compact-select" aria-label="Filtrar produções por etapa" value={productionStage} onChange={event => setProductionStage(event.target.value)}><option value="Todas">Todas as etapas</option>{stages.map(stage => <option key={stage} value={stage}>{stage}</option>)}</select>} />{overviewOrders.length ? <OrdersTable orders={overviewOrders} onSelect={setSelected} compact /> : <Empty title={state.orders.length ? "Nenhum lote nesta etapa" : "Sua primeira produção começa aqui."} text={state.orders.length ? "Escolha outra etapa para acompanhar os lotes." : "Ao criar uma produção, a etapa e o próximo passo aparecem aqui."} action={state.orders.length ? <button className="button secondary" onClick={() => setProductionStage("Todas")}>Mostrar todas as etapas</button> : canProduce ? <button className="button secondary" disabled={busy} onClick={() => setCreating(true)}><Plus size={15} /> Nova produção</button> : undefined} />}<Link href="/producao" className="panel-footer-link">Abrir ordens de produção <ArrowRight size={14} /></Link></section><section className="panel attention-panel"><PanelTitle title="Precisa do seu olhar" subtitle="Pequenos ajustes fazem a diferença." action={<span className="attention-count">{low.length + (late.length ? 1 : 0) + (rework ? 1 : 0)}</span>} /><div className="attention-list">{low.slice(0, 2).map(m => <Link key={m.id} href={`/materiais?busca=${m.lot}`}><span className="attention-icon amber"><Layers size={16} /></span><div><strong>{m.name} · {m.color}</strong><p>{formatNumber(available(m))} {m.unit} livres · mínimo {m.minimum} {m.unit}</p><span>Repor material</span></div><ChevronRight size={15} /></Link>)}{late.length > 0 && <Link href="/producao?atrasadas=1"><span className="attention-icon red"><Clock3 size={16} /></span><div><strong>{late.length} {late.length === 1 ? "produção com prazo vencido" : "produções com prazo vencido"}</strong><p>Confira os lotes e os próximos passos.</p><span>Acompanhar prazo</span></div><ChevronRight size={15} /></Link>}{rework > 0 && <Link href="/qualidade"><span className="attention-icon pink"><RotateCcw size={16} /></span><div><strong>{rework} peças para reconferir</strong><p>O próximo passo é liberar o retrabalho.</p><span>Revisar qualidade</span></div><ChevronRight size={15} /></Link>}{!low.length && !late.length && !rework && <p className="muted pad">Tudo em dia por aqui.</p>}</div></section></div>
    <PartnerDashboardSummary />
    <div className="dashboard-note"><span className="note-mark">MP</span><div><strong>Grandes resultados começam em cada detalhe.</strong><p>Ficha técnica, matéria-prima e produção caminhando juntas.</p></div><Link href="/modelos">Conhecer as fichas <ArrowUpRight size={15} /></Link></div>
    {creating && <NewOrder onClose={() => setCreating(false)} />}{selected && <OrderDetail orderId={selected} onClose={() => setSelected(null)} />}
  </>;
}
