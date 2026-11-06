import { z } from "zod";
const number = z.number().finite().nonnegative();
const image = z.string().optional().nullable().transform(value => value ?? undefined);
const snapshot = z.object({ consumption: number, notionsCost: number, sewingCost: number, finishingCost: number }).passthrough();
export const profileSchema = z.object({ id: z.string(), name: z.string(), role: z.enum(["admin", "gestao", "producao", "qualidade"]), active: z.boolean().optional() });
export const stateSchema = z.object({
  version: z.literal(1),
  materials: z.array(z.object({ id: z.string(), archived: z.boolean().default(false), name: z.string(), category: z.enum(["Tecido", "Aviamento"]), color: z.string(), hex: z.string(), lot: z.string(), supplier: z.string(), quantity: number, reserved: number, minimum: number, unit: z.enum(["kg", "m", "un"]), price: number })),
  models: z.array(z.object({ id: z.string(), archived: z.boolean().default(false), name: z.string(), reference: z.string(), materialId: z.string(), consumption: number, sizes: z.array(z.string()), notionsCost: number, sewingCost: number, finishingCost: number, notes: z.string(), image })),
  orders: z.array(z.object({ id: z.string(), modelId: z.string(), materialId: z.string(), quantity: number, variants: z.array(z.object({ size: z.string(), quantity: number })), stage: z.enum(["Planejado", "Corte", "Costura", "Acabamento", "Qualidade", "Concluído"]), due: z.string(), team: z.string(), priority: z.enum(["Normal", "Alta"]), reserved: number, actualConsumption: number.nullable(), materialPrice: number, approved: number, rework: number, lost: number, created: z.string(), consumptionPerPiece: number.optional(), modelSnapshot: snapshot.optional() })),
  inspections: z.array(z.object({ id: z.string(), orderId: z.string(), quantity: number, result: z.enum(["Aprovadas", "Retrabalho", "Perda"]), reason: z.string(), notes: z.string(), image, date: z.string(), resolved: z.boolean() })),
  activity: z.array(z.object({ id: z.string(), title: z.string(), detail: z.string(), date: z.string() })),
  dailyApprovals: z.array(z.object({ date: z.string(), quantity: number })).default([]),
});
export const envelopeSchema = z.object({ state: stateSchema, revision: z.number().int().nonnegative(), profile: profileSchema, canViewCosts: z.boolean() });
export type ProductionProfile = z.infer<typeof profileSchema>;
export type ProductionEnvelope = z.infer<typeof envelopeSchema>;
export interface ProductionCommand { type: "create_material" | "move_material" | "create_model" | "update_model_image" | "create_order" | "advance_order" | "inspect_order" | "resolve_inspection"; payload: Record<string, unknown>; }
export function requestUuid() {
  const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const hex = Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
