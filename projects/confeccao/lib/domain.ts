export const stages = ["Planejado", "Corte", "Costura", "Acabamento", "Qualidade", "Concluído"] as const;
export type Stage = (typeof stages)[number];
export type Unit = "kg" | "m" | "un";
export interface Material { id: string; archived?: boolean; name: string; category: "Tecido" | "Aviamento"; color: string; hex: string; lot: string; supplier: string; quantity: number; reserved: number; minimum: number; unit: Unit; price: number; }
export interface Model { id: string; archived?: boolean; name: string; reference: string; materialId: string; consumption: number; sizes: string[]; notionsCost: number; sewingCost: number; finishingCost: number; notes: string; image?: string; }
export interface Order { consumptionPerPiece?: number; modelSnapshot?: { consumption: number; notionsCost: number; sewingCost: number; finishingCost: number }; id: string; modelId: string; materialId: string; quantity: number; variants: { size: string; quantity: number }[]; stage: Stage; due: string; team: string; priority: "Normal" | "Alta"; reserved: number; actualConsumption: number | null; materialPrice: number; approved: number; rework: number; lost: number; created: string; }
export interface Inspection { id: string; orderId: string; quantity: number; result: "Aprovadas" | "Retrabalho" | "Perda"; reason: string; notes: string; image?: string; date: string; resolved: boolean; }
export interface Activity { id: string; title: string; detail: string; date: string; }
export interface DemoState { version: 1; materials: Material[]; models: Model[]; orders: Order[]; inspections: Inspection[]; activity: Activity[]; dailyApprovals?: {date: string; quantity: number}[]; }
export const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
export const uid = (prefix: string) => `${prefix}-${Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("")}`;
export const round = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;
export function available(m: Material) { return round(m.quantity - m.reserved); }
export function log(state: DemoState, title: string, detail: string): DemoState { return { ...state, activity: [{ id: uid("at"), title, detail, date: new Date().toISOString() }, ...state.activity].slice(0, 40) }; }
function positive(n: number, label: string) { if (!Number.isFinite(n) || n <= 0) throw new Error(`${label} deve ser maior que zero.`); }
function whole(n: number) { positive(n, "A quantidade"); if (!Number.isInteger(n)) throw new Error("Informe uma quantidade inteira de peças."); }
export function createOrder(state: DemoState, input: { modelId: string; materialId: string; variants: Order["variants"]; due: string; team: string; priority: Order["priority"] }): DemoState {
  const model = state.models.find(m => m.id === input.modelId);
  const material = state.materials.find(m => m.id === input.materialId);
  const baseMaterial = state.materials.find(m => m.id === model?.materialId);
  if (!model || !material || material.category !== "Tecido" || material.unit !== baseMaterial?.unit) throw new Error("Selecione um tecido compatível com a ficha técnica.");
  const variants = input.variants.filter(v => v.quantity > 0);
  if (!variants.length) throw new Error("Informe a quantidade por tamanho.");
  for (const variant of variants) { whole(variant.quantity); if (!model.sizes.includes(variant.size)) throw new Error("Tamanho indisponível na ficha técnica."); }
  if (new Set(variants.map(v => v.size)).size !== variants.length) throw new Error("Cada tamanho deve aparecer uma única vez.");
  const quantity = variants.reduce((sum, v) => sum + v.quantity, 0);
  const reserved = round(quantity * model.consumption);
  if (reserved > available(material)) throw new Error(`Tecido insuficiente: são necessários ${reserved.toLocaleString("pt-BR")} ${material.unit}, com ${available(material).toLocaleString("pt-BR")} ${material.unit} disponíveis.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.due) || !input.team.trim()) throw new Error("Informe o prazo e a equipe responsável.");
  const sequence = Math.max(1028, ...state.orders.map(o => Number(o.id.replace("OP-", "")) || 0)) + 1;
  const order: Order = { ...input, variants, team: input.team.trim(), id: `OP-${sequence}`, quantity, reserved, actualConsumption: null, materialPrice: material.price, approved: 0, rework: 0, lost: 0, stage: "Planejado", created: today() };
  return log({ ...state, orders: [order, ...state.orders], materials: state.materials.map(m => m.id === material.id ? { ...m, reserved: round(m.reserved + reserved) } : m) }, "Produção planejada", `${order.id} · ${quantity} unidades de ${model.name}`);
}
export function advanceOrder(state: DemoState, orderId: string, consumption?: number): DemoState {
  const order = state.orders.find(o => o.id === orderId);
  if (!order || order.stage === "Concluído") throw new Error("Essa produção já está concluída ou não foi encontrada.");
  let materials = state.materials;
  let changes: Partial<Order> = {};
  if (order.stage === "Corte") {
    const material = materials.find(m => m.id === order.materialId)!;
    positive(consumption ?? 0, "O consumo realizado");
    const actual = round(consumption!);
    if (actual > round(available(material) + order.reserved)) throw new Error("O consumo ultrapassa o tecido disponível para esta produção.");
    materials = materials.map(m => m.id === material.id ? { ...m, quantity: round(m.quantity - actual), reserved: round(m.reserved - order.reserved) } : m);
    changes = { actualConsumption: actual, reserved: 0 };
  }
  if (order.stage === "Qualidade" && (order.rework > 0 || order.approved + order.lost !== order.quantity)) throw new Error("Confira todas as peças e resolva os retrabalhos antes de concluir.");
  const nextStage = stages[stages.indexOf(order.stage) + 1];
  return log({ ...state, materials, orders: state.orders.map(o => o.id === orderId ? { ...o, ...changes, stage: nextStage } : o) }, "Etapa atualizada", `${order.id} · ${nextStage}`);
}
export function inspectOrder(state: DemoState, input: Omit<Inspection, "id" | "date" | "resolved">): DemoState {
  const order = state.orders.find(o => o.id === input.orderId);
  if (!order || order.stage !== "Qualidade") throw new Error("Selecione uma produção na etapa de qualidade.");
  whole(input.quantity);
  const remaining = order.quantity - order.approved - order.rework - order.lost;
  if (input.quantity > remaining) throw new Error(`Restam ${remaining} peças sem conferência neste lote.`);
  if (input.result !== "Aprovadas" && !input.reason.trim()) throw new Error("Informe o tipo de defeito.");
  const entry: Inspection = { ...input, id: uid("qc"), date: today(), resolved: false };
  const field = input.result === "Aprovadas" ? "approved" : input.result === "Retrabalho" ? "rework" : "lost";
  return log({ ...state, inspections: [entry, ...state.inspections], orders: state.orders.map(o => o.id === order.id ? { ...o, [field]: o[field] + input.quantity } : o) }, "Conferência registrada", `${order.id} · ${input.quantity} ${input.result.toLowerCase()}`);
}
export function resolveInspection(state: DemoState, id: string): DemoState {
  const entry = state.inspections.find(i => i.id === id);
  if (!entry || entry.result !== "Retrabalho" || entry.resolved) throw new Error("Este registro já está resolvido ou não é um retrabalho.");
  const order = state.orders.find(o => o.id === entry.orderId)!;
  if (order.rework < entry.quantity) throw new Error("A quantidade de retrabalho do lote é inconsistente.");
  return log({ ...state, inspections: state.inspections.map(i => i.id === id ? { ...i, resolved: true } : i), orders: state.orders.map(o => o.id === order.id ? { ...o, rework: o.rework - entry.quantity, approved: o.approved + entry.quantity } : o) }, "Retrabalho aprovado", `${entry.orderId} · ${entry.quantity} peças liberadas após reconferência`);
}
export function moveMaterial(state: DemoState, id: string, amount: number, kind: "Entrada" | "Perda", note: string): DemoState {
  positive(amount, "A quantidade");
  const material = state.materials.find(m => m.id === id);
  if (!material) throw new Error("Material não encontrado.");
  if (material.unit === "un" && !Number.isInteger(amount)) throw new Error("Informe uma quantidade inteira de unidades.");
  if (!note.trim()) throw new Error("Informe a origem ou o motivo da movimentação.");
  if (kind === "Perda" && amount > available(material)) throw new Error("A baixa ultrapassa o saldo livre. O material reservado está protegido.");
  return log({ ...state, materials: state.materials.map(m => m.id === id ? { ...m, quantity: round(m.quantity + (kind === "Entrada" ? amount : -amount)) } : m) }, `${kind} de material`, `${material.name} · ${amount.toLocaleString("pt-BR")} ${material.unit} · ${note.trim()}`);
}
export function directCost(state: DemoState, order: Order, actual = false): number {
  const model = order.modelSnapshot ?? state.models.find(m => m.id === order.modelId)!;
  const expected = order.quantity * (order.consumptionPerPiece ?? model.consumption);
  const consumption = actual ? (order.actualConsumption ?? expected) : expected;
  return consumption * order.materialPrice + order.quantity * (model.notionsCost + model.sewingCost + model.finishingCost);
}
export const formatNumber = (n: number, max = 1) => n.toLocaleString("pt-BR", { maximumFractionDigits: max });
export const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const formatDate = (s: string) => new Date(s.length === 10 ? `${s}T12:00:00-03:00` : s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" }).replace(".", "");
