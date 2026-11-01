import { z } from "zod";
import { getSupabase } from "./supabase-client";
import type { PricingDocument } from "./pricing";
const value = z.number().finite().min(0).max(1e9);
export const pricingDocumentSchema = z.object({
  version: z.literal(1), name: z.string().trim().min(1).max(120), sourceLabel: z.string().max(200),
  produced: z.number().int().min(1).max(1e6), sellable: z.number().int().min(1).max(1e6), monthlyVolume: z.number().int().min(0).max(1e6),
  items: z.array(z.object({ id: z.string().min(1).max(100), label: z.string().trim().min(1).max(120), group: z.enum(["Materiais", "Desenvolvimento", "Produção", "Logística", "Estrutura"]), basis: z.enum(["piece", "batch", "month"]), value })).min(1).max(100),
  rates: z.array(z.object({ id: z.string().min(1).max(100), label: z.string().trim().min(1).max(120), value: value.lt(100) })).max(30),
  margin: value.lt(100), wholesalePrice: value, retailMargin: value.lt(100), retailExpenses: value.lt(100), retailFixed: value, notes: z.string().max(4000),
});
export const pricingRecordSchema = z.object({ id: z.string().uuid(), revision: z.number().int().positive(), updatedAt: z.string(), document: pricingDocumentSchema });
export type PricingRecord = z.infer<typeof pricingRecordSchema>;
export async function listPricing(): Promise<PricingRecord[]> {
  const { data, error } = await getSupabase().rpc("mf_pricing_list"); if (error) throw error;
  return z.array(pricingRecordSchema).parse(data);
}
export async function savePricing(id: string, document: PricingDocument, revision: number): Promise<PricingRecord> {
  const { data, error } = await getSupabase().rpc("mf_pricing_save", { p_id: id, p_document: pricingDocumentSchema.parse(document), p_expected_revision: revision });
  if (error) throw error; return pricingRecordSchema.parse(data);
}
export async function removePricing(id: string, revision: number): Promise<void> {
  const { error } = await getSupabase().rpc("mf_pricing_remove", { p_id: id, p_expected_revision: revision }); if (error) throw error;
}
