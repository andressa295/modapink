export type CostGroup = "Materiais" | "Desenvolvimento" | "Produção" | "Logística" | "Estrutura";
export type CostBasis = "piece" | "batch" | "month";
export interface CostLine { id: string; label: string; group: CostGroup; basis: CostBasis; value: number; }
export interface SaleRate { id: string; label: string; value: number; }
export interface PricingDocument {
  version: 1; name: string; sourceLabel: string; produced: number; sellable: number; monthlyVolume: number;
  items: CostLine[]; rates: SaleRate[]; margin: number; wholesalePrice: number;
  retailMargin: number; retailExpenses: number; retailFixed: number; notes: string;
}
export const costGroups: CostGroup[] = ["Materiais", "Desenvolvimento", "Produção", "Logística", "Estrutura"];
const catalog: Record<CostGroup, string[]> = {
  Materiais: ["Tecido principal", "Forro e tecido complementar", "Entretela e reforços", "Bojo e enchimento", "Elásticos e fitas", "Linha de costura", "Aviamentos (botões, zíperes, metais)", "Etiquetas de marca e composição", "Tags e lacres", "Embalagem da peça"],
  Desenvolvimento: ["Criação e desenvolvimento", "Modelagem", "Peça piloto e ajustes", "Graduação de tamanhos", "Encaixe e risco", "Testes de tecido e lavagem"],
  Produção: ["Corte", "Costura / facção", "Acabamento", "Estamparia / sublimação", "Bordado e aplicações", "Lavanderia / tingimento", "Passadoria", "Conferência de qualidade", "Conserto e retrabalho", "Mão de obra interna não incluída nos serviços"],
  Logística: ["Frete de compra dos insumos", "Transporte entre oficinas", "Frete de venda pago pela Moda Pink", "Caixas e embalagem de transporte", "Armazenagem e manuseio"],
  Estrutura: ["Aluguel", "Condomínio / IPTU", "Energia elétrica", "Água", "Internet e telefone", "Salários administrativos", "Encargos e benefícios", "Pró-labore", "Contabilidade", "Sistemas e assinaturas", "Manutenção de máquinas", "Depreciação de máquinas e equipamentos", "Seguro", "Limpeza e materiais de apoio", "Marketing e conteúdo", "Juros e despesas bancárias fixas", "Serviços e despesas administrativas"],
};
export function blankPricing(): PricingDocument {
  return { version: 1, name: "", sourceLabel: "Preenchimento manual", produced: 0, sellable: 0, monthlyVolume: 0,
    items: costGroups.flatMap((group, g) => catalog[group].map((label, i) => ({ id: `cost-${g}-${i}`, label, group, basis: group === "Estrutura" ? "month" : group === "Desenvolvimento" || group === "Logística" ? "batch" : "piece", value: 0 }))),
    rates: ["Impostos sobre a venda", "Taxa de cartão / pagamento", "Antecipação de recebíveis", "Comissão de venda", "Marketplace / plataforma", "Publicidade variável", "Reserva para devoluções / inadimplência", "Outras taxas sobre a venda"].map((label, i) => ({ id: `rate-${i}`, label, value: 0 })),
    margin: 0, wholesalePrice: 0, retailMargin: 0, retailExpenses: 0, retailFixed: 0, notes: "" };
}
export function parsePricingNumber(text: string, decimals = 4): number | null {
  if (!text.trim()) return 0;
  const pattern = new RegExp(`^(?:\\d+|\\d{1,3}(?:\\.\\d{3})+)(?:,\\d{1,${decimals}})?$`);
  if (!pattern.test(text.trim())) return null;
  const value = Number(text.trim().replaceAll(".", "").replace(",", "."));
  return Number.isFinite(value) && value >= 0 && value <= 1e9 ? value : null;
}
export const priceCeil = (n: number) => Math.ceil((n - 1e-9) * 100) / 100;
export function calculatePricing(doc: PricingDocument) {
  const errors: string[] = [];
  if (!Number.isSafeInteger(doc.produced) || doc.produced < 1 || doc.produced > 1e6) errors.push("Informe quantas peças serão produzidas (número inteiro maior que zero).");
  if (!Number.isSafeInteger(doc.sellable) || doc.sellable < 1 || doc.sellable > doc.produced) errors.push("As peças vendáveis devem ficar entre 1 e a quantidade produzida.");
  if (!Number.isSafeInteger(doc.monthlyVolume) || doc.monthlyVolume < 0 || doc.monthlyVolume > 1e6) errors.push("Informe uma quantidade mensal inteira válida.");
  if (!doc.items.length || doc.items.length > 100 || doc.items.some(item => !item.label.trim())) errors.push("Mantenha ao menos um gasto e preencha a descrição de cada linha.");
  if (doc.items.some(item => !Number.isFinite(item.value) || item.value < 0 || item.value > 1e9)) errors.push("Os custos precisam ser valores positivos ou zero.");
  if (doc.items.some(item => item.basis === "month" && item.value > 0) && doc.monthlyVolume < 1) errors.push("Para ratear despesas mensais, informe quantas peças vendáveis a fábrica prevê no mês.");
  const percentages = [...doc.rates.map(item => item.value), doc.margin, doc.retailMargin, doc.retailExpenses];
  if (percentages.some(value => !Number.isFinite(value) || value < 0 || value >= 100)) errors.push("Cada percentual deve ser de 0 até menos de 100%.");
  const rate = doc.rates.reduce((sum, item) => sum + item.value, 0);
  if (rate + doc.margin >= 100) errors.push("Taxas de venda e margem de atacado precisam somar menos de 100%.");
  if (doc.retailMargin + doc.retailExpenses >= 100) errors.push("Despesas e margem da lojista precisam somar menos de 100%.");
  if ([doc.wholesalePrice, doc.retailFixed].some(value => !Number.isFinite(value) || value < 0 || value > 1e9)) errors.push("Revise os valores de venda e os gastos por peça da lojista.");
  const costs = doc.items.map(item => ({ ...item, total: item.basis === "piece" ? item.value * doc.produced : item.basis === "month" ? (doc.monthlyVolume > 0 ? item.value / doc.monthlyVolume * doc.sellable : 0) : item.value }));
  const total = costs.reduce((sum, item) => sum + item.total, 0);
  if (total > 1e12) errors.push("O total ultrapassa o limite da simulação.");
  const unit = doc.sellable > 0 ? total / doc.sellable : 0;
  const valid = errors.length === 0;
  const minimum = valid && unit > 0 ? priceCeil(unit / (1 - rate / 100)) : null;
  const suggested = valid && unit > 0 ? priceCeil(unit / (1 - (rate + doc.margin) / 100)) : null;
  const wholesale = doc.wholesalePrice > 0 ? doc.wholesalePrice : suggested;
  const result = valid && wholesale !== null ? wholesale * (1 - rate / 100) - unit : null;
  const achievedMargin = result !== null && wholesale && wholesale > 0 ? result / wholesale * 100 : null;
  const retail = valid && wholesale !== null && wholesale > 0 ? priceCeil((wholesale + doc.retailFixed) / (1 - (doc.retailMargin + doc.retailExpenses) / 100)) : null;
  const retailResult = retail !== null && wholesale !== null ? retail * (1 - doc.retailExpenses / 100) - wholesale - doc.retailFixed : null;
  return { errors, valid, costs, total, unit, rate, minimum, suggested, wholesale, result, achievedMargin, retail, retailResult };
}
