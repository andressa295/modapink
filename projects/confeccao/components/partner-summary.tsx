"use client";
import Link from "next/link";
import { ArrowUpRight, ChevronRight, ClipboardCheck, Info, LoaderCircle, RefreshCw } from "lucide-react";
import { usePartnerPortal } from "./partner-portal-context";
import { PanelTitle } from "./ui";
import { formatNumber } from "../lib/domain";
import type { OwnerPortalState, PortalAssignment, PortalUpdate } from "../lib/partner-portal";
import "./partner-portal.css";

const disclaimer = "Apontamentos externos aguardam conferência interna e não alteram o estoque, a qualidade ou as quantidades oficiais da Moda Pink.";
function dateTime(value: string | Date) {
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}
function newest(updates: PortalUpdate[]) {
  return [...updates].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id));
}
function forAssignment(state: OwnerPortalState, assignment: PortalAssignment) {
  return newest(state.latestUpdates.filter(update => update.orderId === assignment.orderId && update.partnerId === assignment.partnerId));
}
function SourceNotice() { return <p className="partner-data-disclaimer"><Info size={14} /><span>{disclaimer}</span></p>; }
function SyncState({ compact = false }: { compact?: boolean }) {
  const { state, loading, refreshing, error, refresh, refreshedAt } = usePartnerPortal();
  if (!state && (loading || refreshing)) return <div className="partner-loading" role="status" style={compact ? { minHeight: 80 } : undefined}><LoaderCircle size={17} />Carregando apontamentos das confecções…</div>;
  if (!state) return <div className={error ? "partner-error" : "partner-no-updates"} role={error ? "alert" : "status"}><p>{error || "Os apontamentos das confecções ainda não foram carregados."}</p><button className="partner-sync-button" type="button" disabled={loading || refreshing} onClick={() => void refresh()}><RefreshCw size={13} />Tentar atualizar</button></div>;
  if (error) return <div className="partner-error" role="alert"><p>Não foi possível atualizar. {refreshedAt ? `Exibindo a leitura de ${dateTime(refreshedAt)}.` : "Exibindo a última leitura disponível."} {error}</p><button type="button" disabled={refreshing} onClick={() => void refresh()}>Tentar novamente</button></div>;
  return <div className="partner-synced" role="status"><i />{refreshing ? "Atualizando apontamentos…" : refreshedAt ? `Leitura de ${dateTime(refreshedAt)}` : "Apontamentos carregados"}</div>;
}
export function PartnerDashboardSummary() {
  const { state, loading, refreshing, refresh } = usePartnerPortal();
  const latest = state ? state.assignments.map(assignment => forAssignment(state, assignment)[0]).filter((update): update is PortalUpdate => !!update) : [];
  const recentUpdates = state ? [...new Map([...state.updates, ...state.latestUpdates].map(update => [update.id, update])).values()] : [];
  const latestUpdates = state ? newest(recentUpdates.filter(update => state.assignments.some(assignment => assignment.orderId === update.orderId && assignment.partnerId === update.partnerId))).slice(0, 3) : [];
  const produced = latest.reduce((sum, update) => sum + update.produced, 0);
  const checked = latest.reduce((sum, update) => sum + update.checked, 0);
  const defects = latest.reduce((sum, update) => sum + update.defects, 0);
  return <section className="panel partner-summary" aria-label="Apontamentos das confecções parceiras">
    <PanelTitle title="Direto das confecções" subtitle="Últimos relatos das parceiras vinculadas às suas ordens." action={<Link href="/confeccoes" className="text-link">Acompanhar <ArrowUpRight size={14} /></Link>} />
    <div style={{ padding: "0 20px 14px" }}><SyncState /></div>
    {state && <>
      {latest.length > 0 && <div className="partner-mini-metrics" style={{ margin: "0 20px 14px" }} aria-label="Últimos totais informados por ordem"><div><strong>{formatNumber(produced)}</strong><span>Produzidas informadas</span></div><div><strong>{formatNumber(checked)}</strong><span>Conferidas informadas</span></div><div><strong>{formatNumber(defects)}</strong><span>Defeitos informados</span></div></div>}
      <div className="partner-summary-list">{latestUpdates.length ? latestUpdates.map(update => {
        const order = state.orders.find(item => item.id === update.orderId);
        const partner = state.partners.find(item => item.id === update.partnerId);
        return <Link key={update.id} href={`/confeccoes?order=${encodeURIComponent(update.orderId)}`} className="partner-summary-item"><span className="partner-mark"><ClipboardCheck size={16} /></span><div><strong>{order?.code ?? "Ordem vinculada"} · {partner?.name ?? "Confecção vinculada"}</strong><p>{update.stage} · {formatNumber(update.produced)} produzidas · {formatNumber(update.checked)} conferidas · {formatNumber(update.defects)} com defeito</p><small>{update.reporter} · {dateTime(update.createdAt)}</small></div><ChevronRight size={14} /></Link>;
      }) : <p className="partner-no-updates">{state.assignments.length ? "As ordens vinculadas ainda aguardam o primeiro apontamento da confecção." : "Vincule uma ordem a uma confecção para acompanhar os relatos da parceira aqui."}</p>}</div>
      <div className="partner-summary-footer"><span>Totais: último relato de cada ordem vinculada. Histórico recente: até {state.historyLimit} apontamentos.</span><button className="partner-sync-button" type="button" disabled={loading || refreshing} onClick={() => void refresh()}><RefreshCw size={12} />Atualizar</button></div>
    </>}
    <SourceNotice />
  </section>;
}
export function PartnerOrderSummary({ orderCode, onNavigate }: { orderCode: string; onNavigate?: () => void }) {
  const { state } = usePartnerPortal();
  const order = state?.orders.find(item => item.code === orderCode);
  const assignment = state?.assignments.find(item => item.orderId === order?.id);
  const partner = state?.partners.find(item => item.id === assignment?.partnerId);
  const latest = state && assignment ? forAssignment(state, assignment)[0] : undefined;
  const destination = order ? `/confeccoes?order=${encodeURIComponent(order.id)}` : "/confeccoes";
  return <section className="partner-order-external" aria-label="Relato externo desta produção">
    <h3>Apontamento da confecção</h3>
    <div style={{ marginTop: 10 }}><SyncState compact /></div>
    {state && <>
      {assignment ? <><p><strong>{partner?.name ?? "Confecção vinculada"}</strong>{partner && !partner.active ? " · parceria inativa" : ""}</p>{latest ? <>
        <p><span className="partner-source">Etapa relatada: {latest.stage}</span></p>
        <div className="partner-mini-metrics"><div><strong>{formatNumber(latest.produced)}</strong><span>Produzidas informadas</span></div><div><strong>{formatNumber(latest.checked)}</strong><span>Conferidas informadas</span></div><div><strong>{formatNumber(latest.defects)}</strong><span>Defeitos informados</span></div></div>
        <p>Último relato de {latest.reporter}, em {dateTime(latest.createdAt)}. As quantidades são cumulativas para esta ordem.</p>
        {latest.defects > 0 && <p><strong>Defeitos relatados:</strong> {latest.defectDescription || "Consulte o histórico para conferir os detalhes."}</p>}
      </> : <p>A confecção ainda não enviou apontamentos para esta ordem.</p>}</> : <p>{order ? "Esta ordem ainda não está vinculada a uma confecção parceira." : "Esta produção ainda não aparece na leitura do portal. Atualize os apontamentos para conferir o vínculo."}</p>}
      <Link href={destination} className="text-link" onClick={onNavigate}>Ver histórico da confecção <ArrowUpRight size={14} /></Link>
    </>}
    <p><Info size={12} style={{ display: "inline", marginRight: 6, verticalAlign: "text-bottom" }} />{disclaimer}</p>
  </section>;
}
