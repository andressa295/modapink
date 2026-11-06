export const qualityResults = ["Aprovadas", "Retrabalho", "Perda"] as const;
export type QualityResult = (typeof qualityResults)[number];
export interface QualityLot { id: string; stage: string; quantity: number; approved: number; rework: number; lost: number; }
export interface QualityFields { result: QualityResult | null; quantity: string; reason: string; notes: string; image?: string; }
export interface InspectionDraft { orderId: string; result: QualityResult; quantity: number; reason: string; notes: string; image?: string; }
export function remainingQuality(lot: QualityLot): number { return Math.max(0, lot.quantity - lot.approved - lot.rework - lot.lost); }
export function qualityLotSnapshot(lot: QualityLot): string { return JSON.stringify([lot.id, lot.stage, lot.quantity, lot.approved, lot.rework, lot.lost]); }
export function prepareInspection(lot: QualityLot | undefined, fields: QualityFields): InspectionDraft {
  if (!lot || lot.stage !== "Qualidade" || remainingQuality(lot) <= 0) throw new Error("Escolha uma produção que ainda tenha peças para conferir.");
  if (!fields.result || !qualityResults.includes(fields.result)) throw new Error("Escolha o resultado das peças que você conferiu.");
  const quantity = Number(fields.quantity);
  if (!/^\d+$/.test(fields.quantity.trim()) || !Number.isSafeInteger(quantity) || quantity <= 0) throw new Error("Informe uma quantidade inteira de peças, como 10.");
  const remaining = remainingQuality(lot);
  if (quantity > remaining) throw new Error(`Este lote tem ${remaining.toLocaleString("pt-BR")} peças ainda não conferidas. Registre no máximo essa quantidade.`);
  const reason = fields.result === "Aprovadas" ? "Conferência aprovada" : fields.reason.trim();
  const notes = fields.notes.trim();
  if (!reason) throw new Error("Escolha o tipo de defeito encontrado.");
  if (reason.length > 500 || notes.length > 1200) throw new Error("Resuma o motivo e as observações antes de continuar.");
  if (fields.result !== "Aprovadas" && reason.startsWith("Outro") && !notes) throw new Error("Descreva nas observações qual foi o defeito encontrado.");
  return { orderId: lot.id, result: fields.result, quantity, reason, notes, ...(fields.image ? { image: fields.image } : {}) };
}
