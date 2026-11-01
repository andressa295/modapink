import { getSupabase } from "./supabase-client";

export type RemovableEntity = "material" | "model" | "order" | "partner" | "member";

/** Removal is archived by the database; clients never delete dependent history or images. */
export async function removeRecord(entity: RemovableEntity, id: string): Promise<void> {
  const { data, error } = await getSupabase().rpc("mf_remove_record", { p_entity: entity, p_id: id });
  if (error) {
    if (error.code === "42501") throw new Error("Seu acesso não permite excluir este cadastro. Procure a administração.");
    if (["22023", "23503", "P0001"].includes(error.code ?? "") && typeof error.message === "string" && error.message.length < 350) throw new Error(error.message);
    throw new Error("Não foi possível confirmar a exclusão. Atualize os dados e tente novamente.");
  }
  if (!data || typeof data !== "object" || data.removed !== true || data.entity !== entity || data.id !== id) throw new Error("A exclusão ainda não pôde ser confirmada. Atualize os dados antes de tentar novamente.");
}
