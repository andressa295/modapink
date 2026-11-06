import { z } from "zod";
import { getSupabase } from "./supabase-client";

export const teamRoles = ["admin", "gestao", "producao", "qualidade"] as const;
const timestamp = z.string().datetime({ offset: true }).nullable();
export const teamMemberSchema = z.object({ id: z.string().uuid(), full_name: z.string().max(120), email: z.string().max(254).nullable().transform(value => value ?? ""), role: z.enum(teamRoles), active: z.boolean(), status: z.enum(["active", "invited", "awaiting_password", "inactive"]), email_confirmed: z.boolean(), password_set: z.boolean(), invited_at: timestamp, last_sign_in_at: timestamp });
const requestId = z.string().uuid();
export const teamAccessRequestSchema = z.discriminatedUnion("action", [
  z.object({ requestId, action: z.literal("invite"), email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(254), fullName: z.string().trim().min(1, "Informe o nome da pessoa.").max(100), role: z.enum(teamRoles) }).strict(),
  z.object({ requestId, action: z.literal("resend"), userId: z.string().uuid() }).strict(),
  z.object({ requestId, action: z.literal("recovery"), userId: z.string().uuid() }).strict(),
]);
const resultSchema = z.object({ ok: z.literal(true), status: z.literal("completed"), requestId: z.string().uuid(), message: z.string().max(600).optional() });
const errorSchema = z.object({ ok: z.literal(false).optional(), code: z.string().max(100).optional(), message: z.string().max(600).optional(), uncertain: z.boolean().optional() });
export type TeamMember = z.infer<typeof teamMemberSchema>;
export type TeamAccessRequest = z.infer<typeof teamAccessRequestSchema>;
export type TeamAccessAction = TeamAccessRequest["action"];
export class TeamAccessError extends Error {
  readonly uncertain: boolean;
  readonly code: string;
  constructor(message: string, options: { uncertain?: boolean; code?: string } = {}) { super(message); this.name = "TeamAccessError"; this.uncertain = options.uncertain ?? false; this.code = options.code ?? "TEAM_ACCESS_ERROR"; }
}
export async function listTeamMembers(): Promise<TeamMember[]> {
  const { data, error } = await getSupabase().rpc("mf_team_list");
  if (error) throw new TeamAccessError("Não foi possível carregar a equipe. Atualize a lista para tentar novamente.");
  const result = z.array(teamMemberSchema).safeParse(data);
  if (!result.success) throw new TeamAccessError("A lista da equipe está incompleta. Atualize a página e tente novamente.");
  return result.data;
}
export async function sendTeamAccess(input: TeamAccessRequest): Promise<{ message?: string }> {
  const parsed = teamAccessRequestSchema.safeParse(input);
  if (!parsed.success) throw new TeamAccessError(parsed.error.issues[0]?.message ?? "Confira os dados do convite.");
  let client: ReturnType<typeof getSupabase>;
  try { client = getSupabase(); }
  catch { throw new TeamAccessError("A conexão da equipe ainda não está disponível. Atualize a página e tente novamente."); }
  let data: unknown; let error: unknown;
  try { const response = await client.functions.invoke("team-access", { body: parsed.data }); data = response.data; error = response.error; }
  catch { throw new TeamAccessError("A confirmação não chegou. Reconfirme o mesmo envio para consultar o resultado sem criar outro convite.", { uncertain: true }); }
  if (error) {
    const context = typeof error === "object" && error !== null && "context" in error ? (error as { context: unknown }).context : null;
    let payload: unknown = null; let status: number | undefined;
    if (context instanceof Response) { status = context.status; try { payload = await context.clone().json(); } catch { /* A gateway error may lack the application envelope. */ } }
    const failure = errorSchema.safeParse(payload);
    if (failure.success && (failure.data.message || failure.data.code)) throw new TeamAccessError(failure.data.message ?? "Não foi possível concluir esse envio.", { code: failure.data.code, uncertain: failure.data.uncertain ?? (status === undefined || status >= 500) });
    if (status === 401 || status === 403) throw new TeamAccessError("Seu acesso não permite enviar convites. Entre novamente com uma conta da administração.", { code: "ACCESS_DENIED" });
    if (status === 429) throw new TeamAccessError("Aguarde um pouco antes de enviar outra mensagem para essa pessoa.", { code: "RATE_LIMIT" });
    if (status !== undefined && status >= 400 && status < 500) throw new TeamAccessError("Não foi possível enviar. Confira o cadastro da pessoa e tente novamente.");
    throw new TeamAccessError("A confirmação não chegou. Reconfirme o mesmo envio para verificar o resultado sem duplicar a solicitação.", { uncertain: true });
  }
  const result = resultSchema.safeParse(data);
  if (result.success && result.data.requestId === parsed.data.requestId) return { message: result.data.message };
  const failure = errorSchema.safeParse(data);
  if (failure.success && (failure.data.message || failure.data.code)) throw new TeamAccessError(failure.data.message ?? "Não foi possível concluir esse envio.", { code: failure.data.code, uncertain: failure.data.uncertain ?? true });
  throw new TeamAccessError("O resultado ainda não pôde ser confirmado. Reconfirme o mesmo envio antes de tentar um novo convite.", { uncertain: true });
}
