import { createTeamAccessHandler, TeamFault, type TeamInput, type TeamReceipt } from "./handler.ts";

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };
const base = Deno.env.get("SUPABASE_URL") ?? "";
const serverKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const appOrigin = "https://modapink-confeccao.vercel.app";
// Uses only runtime-injected credentials. No SDK dependency, token logging or browser administrative key.
async function serverRequest(path: string, body?: unknown, userToken?: string): Promise<Record<string, unknown>> {
  if (!base || !serverKey) throw new TeamFault(503, "configuration", "O cadastro da equipe está temporariamente indisponível.");
  let response: Response;
  try { response = await fetch(`${base}${path}`, { method: body === undefined ? "GET" : "POST", headers: { apikey: serverKey, Authorization: `Bearer ${userToken ?? serverKey}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20_000) }); }
  catch { throw new TeamFault(503, "network_error", "Não foi possível confirmar o envio agora. Atualize a equipe antes de tentar novamente.", body !== undefined); }
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const code = typeof data.code === "string" ? data.code : "provider_error";
    if (path.startsWith("/rest/v1/rpc/")) {
      if (code === "42501") throw new TeamFault(403, "forbidden", "Somente a administração ativa pode cadastrar ou reenviar acessos.");
      if (["22023", "23505", "23514", "P0001"].includes(code)) {
        const message = typeof data.message === "string" && data.message.length < 300 ? data.message : "Confira o e-mail, o perfil e a situação da pessoa.";
        throw new TeamFault(/limite|aguarde|minuto/i.test(message) ? 429 : 400, "validation", message);
      }
    }
    if (response.status === 429) throw new TeamFault(429, "rate_limited", "Aguarde um minuto antes de solicitar outro e-mail.");
    if (path === "/auth/v1/user") throw new TeamFault(401, "unauthorized", "Entre novamente para gerenciar a equipe.");
    throw new TeamFault(response.status >= 500 ? 503 : 400, "send_failed", "Não foi possível enviar o e-mail agora. Confira os dados e tente novamente em alguns minutos.", response.status >= 500);
  }
  return data;
}
const rpc = (name: string, body: unknown) => serverRequest(`/rest/v1/rpc/${name}`, body);
Deno.serve(createTeamAccessHandler({
  async verifyUser(token) { const user = await serverRequest("/auth/v1/user", undefined, token); return typeof user.id === "string" ? { id: user.id } : null; },
  async prepare(actorId: string, input: TeamInput) { return await rpc("mf_team_prepare", { p_actor_id: actorId, p_request_id: input.requestId, p_action: input.action, p_email: input.email ?? null, p_full_name: input.fullName ?? null, p_role: input.role ?? null, p_user_id: input.userId ?? null }) as unknown as TeamReceipt; },
  async invite(email, fullName) { const user = await serverRequest(`/auth/v1/invite?redirect_to=${encodeURIComponent(`${appOrigin}/auth/confirm`)}`, { email, data: { full_name: fullName } }); return typeof user.id === "string" ? user.id : ""; },
  async recover(email) { await serverRequest(`/auth/v1/recover?redirect_to=${encodeURIComponent(`${appOrigin}/auth/recovery`)}`, { email }); },
  async finish(actorId, requestId, authUserId) { return rpc("mf_team_finish", { p_actor_id: actorId, p_request_id: requestId, p_auth_user_id: authUserId }); },
  async fail(actorId, requestId, reason) { await rpc("mf_team_fail", { p_actor_id: actorId, p_request_id: requestId, p_reason: reason }); },
}));
