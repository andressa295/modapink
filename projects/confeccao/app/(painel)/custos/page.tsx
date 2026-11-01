"use client";
import { useState } from "react";
import Link from "next/link";
import { Download, Wallet, Coins, Info, Search, ArrowLeftRight, Layers, Scissors, CircleCheck, ChevronRight } from "lucide-react";
import { useDemo } from "../../../lib/demo-store";
import { directCost, formatNumber, money, type Order } from "../../../lib/domain";
import { Empty, Metric, PageHeading, PanelTitle, Status, exportCsv } from "../../../components/ui";
import { OrderDetail } from "../../../components/orders";
import "../../../components/costs.css";

type CostFilter = "Concluídos" | "Em andamento" | "Todos os lotes";
const signedMoney = (value: number) => { const displayed = Math.abs(value) < .005 ? 0 : value; return `${displayed > 0 ? "+" : ""}${money(displayed)}`; };
const lotCount = (value: number) => `${value} ${value === 1 ? "lote" : "lotes"}`;

export default function Costs() {
  const { state, canViewCosts } = useDemo();
  const [filter, setFilter] = useState<CostFilter>("Concluídos");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  if (!canViewCosts) return <><PageHeading eyebrow="ACESSO RESTRITO" title="Custos e resultados" description="Esta área está disponível para os perfis de administração e gestão." /><section className="panel"><Empty title="Seu perfil não acessa dados financeiros" text="Fale com a administração se suas responsabilidades exigirem este acesso." /></section></>;

  // The snapshot preserves the rates and model description from the order's opening.
  const modelFor = (order: Order) => ({ ...state.models.find(model => model.id === order.modelId), ...order.modelSnapshot });
  const needle = query.trim().toLocaleLowerCase("pt-BR");
  const orders = state.orders.filter(order => {
    const matchesStatus = filter === "Todos os lotes" || (filter === "Concluídos" ? order.stage === "Concluído" : order.stage !== "Concluído");
    return matchesStatus && `${order.id} ${modelFor(order).name ?? ""} ${order.team}`.toLocaleLowerCase("pt-BR").includes(needle);
  });
  const rows = orders.map(order => {
    const model = modelFor(order);
    const notions = order.quantity * (model.notionsCost ?? 0);
    const sewing = order.quantity * (model.sewingCost ?? 0);
    const finishing = order.quantity * (model.finishingCost ?? 0);
    const services = notions + sewing + finishing;
    const expected = directCost(state, order);
    const expectedFabric = order.quantity * (order.consumptionPerPiece ?? model.consumption ?? 0) * order.materialPrice;
    // directCost(..., true) falls back to the forecast when consumption is null.
    // Keep that case visibly pending instead of presenting a forecast as a recorded cost.
    const calculated = order.actualConsumption === null ? null : directCost(state, order, true);
    const actualFabric = order.actualConsumption === null ? null : order.actualConsumption * order.materialPrice;
    const perApproved = order.stage === "Concluído" && calculated !== null && order.approved > 0 ? calculated / order.approved : null;
    return { order, model, expected, expectedFabric, notions, sewing, finishing, services, calculated, actualFabric, perApproved };
  });
  const recorded = rows.filter(row => row.calculated !== null);
  const completed = rows.filter(row => row.order.stage === "Concluído");
  const completedRecorded = recorded.filter(row => row.order.stage === "Concluído");
  const expectedTotal = rows.reduce((sum, row) => sum + row.expected, 0);
  const calculatedTotal = recorded.reduce((sum, row) => sum + row.calculated!, 0);
  const comparedExpected = recorded.reduce((sum, row) => sum + row.expected, 0);
  const difference = calculatedTotal - comparedExpected;
  const partialCount = recorded.filter(row => row.order.stage !== "Concluído").length;
  const pendingCount = rows.length - recorded.length;
  const completedCost = completedRecorded.reduce((sum, row) => sum + row.calculated!, 0);
  const costedApproved = completedRecorded.reduce((sum, row) => sum + row.order.approved, 0);
  const completedQuantity = completed.reduce((sum, row) => sum + row.order.quantity, 0);
  const approved = completed.reduce((sum, row) => sum + row.order.approved, 0);
  const lost = completed.reduce((sum, row) => sum + row.order.lost, 0);
  const yieldRate = completedQuantity > 0 ? approved / completedQuantity * 100 : null;
  const lossRate = completedQuantity > 0 ? lost / completedQuantity * 100 : null;
  const composition = [
    { name: "Tecido", detail: "Consumo previsto × custo do tecido", value: rows.reduce((sum, row) => sum + row.expectedFabric, 0), color: "#e70289", icon: Layers },
    { name: "Costura", detail: "Tarifa por peça × peças do lote", value: rows.reduce((sum, row) => sum + row.sewing, 0), color: "#a77ac1", icon: Scissors },
    { name: "Aviamentos", detail: "Valor da ficha × peças do lote", value: rows.reduce((sum, row) => sum + row.notions, 0), color: "#db9aba", icon: Coins },
    { name: "Acabamento", detail: "Tarifa por peça × peças do lote", value: rows.reduce((sum, row) => sum + row.finishing, 0), color: "#a5b3c8", icon: CircleCheck },
  ];
  const scope = filter === "Concluídos" ? "Lotes concluídos" : filter === "Em andamento" ? "Lotes em andamento, incluindo planejados" : "Todos os lotes";

  function download() {
    exportCsv("modapink-custos-diretos.csv", ["Ordem", "Modelo", "Etapa", "Peças do lote", "Aprovadas", "Perdas", "Custo direto previsto", "Tecido previsto", "Aviamentos e serviços da ficha", "Tecido apurado", "Custo direto calculado", "Situação do cálculo", "Diferença para o previsto", "Custo por aprovada - somente concluídos"], rows.map(row => [row.order.id, row.model.name ?? row.order.modelId, row.order.stage, row.order.quantity, row.order.approved, row.order.lost, row.expected.toFixed(2), row.expectedFabric.toFixed(2), row.services.toFixed(2), row.actualFabric === null ? "Aguardando consumo" : row.actualFabric.toFixed(2), row.calculated === null ? "Aguardando consumo" : row.calculated.toFixed(2), row.calculated === null ? "Sem consumo registrado" : row.order.stage === "Concluído" ? "Tecido apurado + aviamentos e serviços da ficha" : "Parcial: tecido apurado + aviamentos e serviços previstos", row.calculated === null ? "Em apuração" : (row.calculated - row.expected).toFixed(2), row.perApproved === null ? row.order.stage === "Concluído" && !row.order.approved ? "Nenhuma peça aprovada" : "Em apuração" : row.perApproved.toFixed(2)]));
  }

  return <div className="costs-page">
    <PageHeading eyebrow="CUSTOS E RESULTADOS" title="O custo de cada produção." description="Compare a previsão com o custo direto calculado e veja como as peças aprovadas compõem o resultado do lote.">
      <Link className="button primary" href="/precificacao">Formar preço de venda <ChevronRight size={15} /></Link><button className="button secondary" onClick={download} disabled={!rows.length}><Download size={16} /> Exportar esta visão</button>
    </PageHeading>

    <section className="costs-view-bar" aria-label="Filtros dos custos">
      <label className="costs-view-select">Quais produções você quer ver?<select value={filter} onChange={event => setFilter(event.target.value as CostFilter)}><option>Concluídos</option><option>Em andamento</option><option>Todos os lotes</option></select></label>
      <div className="search-input"><Search size={16} /><input aria-label="Buscar custos por ordem, modelo ou equipe" maxLength={100} placeholder="Buscar ordem, modelo ou equipe…" value={query} onChange={event => setQuery(event.target.value)} />{query && <button className="clear-input" aria-label="Limpar busca" onClick={() => setQuery("")}>×</button>}</div>
      <span className="costs-view-count">{lotCount(rows.length)}</span>
    </section>
    <p className="costs-scope"><span />{scope}{needle ? " · busca aplicada" : ""}. Os indicadores e a exportação acompanham esta visão.</p>

    <section className="metrics-grid costs-metrics" aria-label="Custos das produções filtradas">
      <Metric label="Custo previsto" value={money(expectedTotal)} note={`Tecido, aviamentos e serviços de ${lotCount(rows.length)}`} icon={<Wallet size={18} />} />
      <Metric label="Custo direto calculado" value={recorded.length ? money(calculatedTotal) : "—"} note={recorded.length ? `${lotCount(recorded.length)} com corte registrado${partialCount ? ` · ${partialCount} parciais` : ""}` : "Aguardando o consumo do corte"} icon={<Layers size={18} />} tone="purple" />
      <Metric label="Diferença para o previsto" value={recorded.length ? <span className={`costs-difference ${difference > .005 ? "is-higher" : difference < -.005 ? "is-lower" : ""}`}>{signedMoney(difference)}</span> : "—"} note={recorded.length ? `Comparação dos mesmos ${lotCount(recorded.length)} com corte` : "Disponível após registrar o corte"} icon={<ArrowLeftRight size={18} />} tone="amber" />
      <Metric label="Custo por peça aprovada" value={costedApproved > 0 ? money(completedCost / costedApproved) : "—"} note={completedRecorded.length ? costedApproved ? `Somente ${lotCount(completedRecorded.length)} concluídos com corte registrado` : "Nenhuma aprovada nos lotes calculados" : "Disponível nos lotes concluídos"} icon={<Coins size={18} />} tone="green" />
    </section>

    <div className="costs-explanation"><Info size={17} /><p><strong>O que significa “calculado”?</strong> É o tecido consumido no corte mais os valores de aviamentos, costura e acabamento da ficha. O preço do tecido e as tarifas são preservados na abertura da ordem. Em andamento, o valor é parcial.</p></div>

    <div className="costs-overview">
      <section className="panel costs-composition"><PanelTitle title="De onde vem o custo previsto" subtitle={`${lotCount(rows.length)} desta visão · valores da abertura de cada ordem`} action={<span className="costs-composition-total">{money(expectedTotal)}</span>} />
        <div className="costs-composition-bar" aria-hidden="true">{composition.map(item => <span key={item.name} style={{ width: `${expectedTotal > 0 ? item.value / expectedTotal * 100 : 0}%`, background: item.color }} />)}</div>
        <div className="costs-composition-list">{composition.map(item => <div key={item.name}><span className="costs-component-mark" style={{ color: item.color }}><item.icon size={16} /></span><span className="costs-component-name"><strong>{item.name}</strong><small>{item.detail}</small></span><strong className="costs-component-value">{money(item.value)}</strong><span className="costs-component-percent">{formatNumber(expectedTotal > 0 ? item.value / expectedTotal * 100 : 0)}%</span></div>)}</div>
      </section>
      <section className="costs-yield-card" aria-label="Aproveitamento final dos lotes concluídos desta visão">
        <span className="costs-yield-eyebrow">APROVEITAMENTO DAS PEÇAS</span><h2>{yieldRate === null ? "—" : <>{formatNumber(yieldRate)}<small>%</small></>}</h2><p>{completed.length ? `Peças aprovadas nos ${lotCount(completed.length)} concluídos desta visão.` : "O aproveitamento final aparece quando houver lotes concluídos nesta visão."}</p>
        {yieldRate !== null && <div className="costs-yield-track" aria-hidden="true"><span style={{ width: `${yieldRate}%` }} /></div>}
        <div className="costs-yield-counts"><div><strong>{formatNumber(approved)}</strong><span>Aprovadas</span></div><div><strong>{formatNumber(lost)}</strong><span>Perdas {lossRate === null ? "" : `· ${formatNumber(lossRate)}%`}</span></div><div><strong>{formatNumber(completedQuantity)}</strong><span>Peças concluídas</span></div></div>
        <div className="costs-yield-note"><Coins size={16} /><p>O custo do lote é dividido pelas peças aprovadas. Com perdas, menos peças absorvem esse custo.</p></div>
      </section>
    </div>

    <section className="panel costs-lots-panel"><PanelTitle title="Compare os custos de cada lote" subtitle="Abra os detalhes para conferir a etapa, o consumo e a qualidade." action={<span className="costs-lots-count">{lotCount(rows.length)}</span>} />
      <div className="costs-table-guide"><span><i className="costs-guide-expected" /><strong>Previsto:</strong> consumo e valores da ficha</span><span><i className="costs-guide-calculated" /><strong>Calculado:</strong> tecido apurado + aviamentos e serviços da ficha</span></div>
      {pendingCount > 0 && <p className="costs-pending-note"><Info size={14} />{lotCount(pendingCount)} ainda sem consumo registrado. Esses lotes entram no previsto e aguardam apuração.</p>}
      {rows.length ? <div className="table-scroll costs-table-scroll"><table className="data-table costs-table"><thead><tr><th>Produção / modelo</th><th>Etapa</th><th>Custo previsto</th><th>Custo direto calculado</th><th>Por aprovada</th><th><span className="sr-only">Detalhes</span></th></tr></thead><tbody>{rows.map(row => {
        const delta = row.calculated === null ? null : row.calculated - row.expected;
        return <tr key={row.order.id}><td data-label="Produção"><button className="costs-lot-name" onClick={() => setSelected(row.order.id)}><strong>{row.model.name ?? row.order.modelId}</strong><small>{row.order.id} · {formatNumber(row.order.quantity)} peças</small></button></td><td data-label="Etapa"><Status stage={row.order.stage} /></td><td data-label="Previsto"><strong className="costs-cell-value">{money(row.expected)}</strong><span className="costs-cell-breakdown">Tecido {money(row.expectedFabric)}<br />Aviamentos e serviços {money(row.services)}</span></td><td data-label="Calculado">{row.calculated === null ? <><span className="costs-awaiting">Aguardando consumo</span><small className="costs-cell-note">Registre o tecido usado ao finalizar o corte.</small></> : <><strong className="costs-cell-value">{money(row.calculated)}{row.order.stage !== "Concluído" && <em>Parcial</em>}</strong><span className="costs-cell-breakdown">Tecido {money(row.actualFabric!)}<br />Aviamentos e serviços {money(row.services)}</span><small className={`costs-row-delta ${delta! > .005 ? "is-higher" : delta! < -.005 ? "is-lower" : ""}`}>{signedMoney(delta!)} em relação ao previsto</small></>}</td><td data-label="Por aprovada">{row.perApproved !== null ? <><strong className="costs-cell-value">{money(row.perApproved)}</strong><small className="costs-cell-note">{formatNumber(row.order.approved)} aprovadas · {formatNumber(row.order.lost)} perdas</small></> : <span className="costs-awaiting">{row.order.stage === "Concluído" && !row.order.approved ? "Nenhuma aprovada" : row.order.stage === "Concluído" ? "Aguardando consumo" : "Após concluir o lote"}</span>}</td><td className="costs-table-action"><button className="text-link" aria-label={`Abrir detalhes da produção ${row.order.id}`} onClick={() => setSelected(row.order.id)}>Abrir lote <ChevronRight size={14} /></button></td></tr>;
      })}</tbody></table></div> : <Empty title="Nenhuma produção nesta visão" text={state.orders.length ? "Mude a situação ou limpe a busca para consultar outros lotes." : "Os custos aparecerão quando as ordens de produção forem criadas."} action={state.orders.length ? <button className="button secondary" onClick={() => { setFilter("Todos os lotes"); setQuery(""); }}>Mostrar todos os lotes</button> : undefined} />}
      <div className="table-footer"><span>{lotCount(rows.length)} nesta visão</span><span>Diferença de consumo e peças perdidas são registros distintos.</span></div>
    </section>

    <section className="costs-reading-guide" aria-label="Como ler os custos"><div><Info size={17} /><h2>Como ler estes valores</h2></div><p><strong>Previsto:</strong> orçamento direto do lote com o consumo e as tarifas preservados na abertura da ordem.</p><p><strong>Calculado:</strong> usa o consumo de tecido registrado no corte. Aviamentos e serviços continuam com as tarifas da ficha.</p><p><strong>Por aprovada:</strong> custo direto calculado dos lotes concluídos dividido pelas peças aprovadas desses mesmos lotes. Sem aprovadas, o valor fica em aberto.</p><small>Escopo: tecido, aviamentos, costura e acabamento. Despesas fixas, impostos, frete, preço de venda e lucro ficam fora deste cálculo.</small></section>
    {selected && <OrderDetail orderId={selected} onClose={() => setSelected(null)} />}
  </div>;
}
