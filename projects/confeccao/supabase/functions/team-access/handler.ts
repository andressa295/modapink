export type TeamAction = "invite" | "resend" | "recovery";
export type TeamInput = { requestId: string; action: TeamAction; email?: string; fullName?: string; role?: string; userId?: string };
export type TeamReceipt = {
  requestId: string; action: TeamAction; status: string; canSend: boolean; replayed: boolean;
  target: { id: string | null; email: string; fullName: string; role: string; active: boolean; emailConfirmed: boolean; passwordSet: boolean; hasProfile: boolean; archived?: boolean };
};
export interface TeamBackend {
  verifyUser: (token: string) => Promise<{ id: string } | null>;
  prepare: (actorId: string, input: TeamInput) => Promise<TeamReceipt>;
  invite: (email: string, fullName: string) => Promise<string>;
  recover: (email: string) => Promise<void>;
  finish: (actorId: string, requestId: string, authUserId: string) => Promise<unknown>;
  fail: (actorId: string, requestId: string, reason: string) => Promise<void>;
}
export class TeamFault extends Error {
  status: number; code: string; uncertain: boolean;
  constructor(status: number, code: string, message: string, uncertain = false) { super(message); this.name = "TeamFault"; this.status = status; this.code = code; this.uncertain = uncertain; }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const roles = ["admin", "gestao", "producao", "qualidade"];
const productionOrigin = "https://modapink-confeccao.vercel.app";
function readInput(value: unknown): TeamInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TeamFault(400, "invalid_input", "Confira os dados do convite.");
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some(key => !["requestId", "action", "email", "fullName", "role", "userId"].includes(key)) || typeof data.requestId !== "string" || !uuid.test(data.requestId) || !["invite", "resend", "recovery"].includes(String(data.action))) throw new TeamFault(400, "invalid_input", "Confira os dados do convite.");
  if (data.action === "invite") {
    if (typeof data.email !== "string" || typeof data.fullName !== "string" || typeof data.role !== "string" || data.userId !== undefined) throw new TeamFault(400, "invalid_input", "Informe nome, e-mail e perfil de acesso.");
    const email = data.email.trim().toLowerCase(); const fullName = data.fullName.trim();
    if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || !fullName || fullName.length > 100 || /[\u0000-\u001f\u007f]/.test(fullName) || !roles.includes(data.role)) throw new TeamFault(400, "invalid_input", "Informe nome, e-mail e perfil de acesso válidos.");
    return { requestId: data.requestId, action: "invite", email, fullName, role: data.role };
  }
  if (typeof data.userId !== "string" || !uuid.test(data.userId) || data.email !== undefined || data.fullName !== undefined || data.role !== undefined) throw new TeamFault(400, "invalid_input", "Selecione uma pessoa da equipe.");
  return { requestId: data.requestId, action: data.action as TeamAction, userId: data.userId };
}
/** No password or sign-in link is returned to the administrator. Auth sends it to the recipient. */
export function createTeamAccessHandler(backend: TeamBackend) {
  return async (request: Request): Promise<Response> => {
    const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Access-Control-Allow-Origin": productionOrigin, "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info", "Access-Control-Allow-Methods": "POST,OPTIONS", "Vary": "Origin" };
    const reply = (status: number, value: unknown) => new Response(JSON.stringify(value), { status, headers });
    const origin = request.headers.get("Origin");
    if (origin && origin !== productionOrigin) return reply(403, { ok: false, code: "origin_denied", message: "Abra o sistema pelo endereço oficial da Moda Pink." });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return reply(405, { ok: false, code: "method_denied", message: "Use o formulário de equipe do sistema." });
    let actorId = ""; let receipt: TeamReceipt | null = null; let sent = false;
    try {
      const bearer = request.headers.get("Authorization")?.match(/^Bearer ([A-Za-z0-9._-]+)$/i)?.[1];
      if (!bearer || bearer.length > 8192 || bearer.startsWith("sb_")) throw new TeamFault(401, "unauthorized", "Entre novamente para gerenciar a equipe.");
      const user = await backend.verifyUser(bearer);
      if (!user || !uuid.test(user.id)) throw new TeamFault(401, "unauthorized", "Entre novamente para gerenciar a equipe.");
      actorId = user.id;
      if (Number(request.headers.get("Content-Length") ?? 0) > 4096) throw new TeamFault(400, "invalid_input", "Os dados do convite ultrapassam o limite.");
      const text = await request.text();
      if (text.length > 4096) throw new TeamFault(400, "invalid_input", "Os dados do convite ultrapassam o limite.");
      let raw: unknown; try { raw = JSON.parse(text); } catch { throw new TeamFault(400, "invalid_input", "Confira os dados do convite."); }
      const input = readInput(raw);
      receipt = await backend.prepare(actorId, input);
      if (receipt.requestId !== input.requestId || receipt.action !== input.action) throw new TeamFault(503, "incomplete_response", "Não foi possível confirmar esta solicitação.");
      if (receipt.status === "completed" && receipt.target.archived) throw new TeamFault(409, "member_removed", "Esse acesso foi excluído depois do convite. Cadastre a pessoa novamente para autorizar um novo acesso.");
      if (receipt.status === "completed") return reply(200, { ok: true, status: "completed", requestId: input.requestId, replayed: true, message: "Esta solicitação já foi concluída. Nenhum e-mail adicional foi enviado." });
      if (!receipt.canSend) {
        // A retry can finish provisioning an identity created by the first invocation, without sending twice.
        if (input.action === "invite" && receipt.target.id && (!receipt.target.hasProfile || receipt.target.archived) && receipt.status !== "failed") {
          await backend.finish(actorId, input.requestId, receipt.target.id);
          return reply(200, { ok: true, status: "completed", requestId: input.requestId, replayed: true, message: "O cadastro foi confirmado. Confira o acesso na lista da equipe." });
        }
        throw new TeamFault(409, "request_pending", "O envio anterior ainda precisa de confirmação. Atualize a lista da equipe; se necessário, aguarde um minuto antes de solicitar um novo envio.", receipt.status !== "failed");
      }
      let authUserId = receipt.target.id;
      if (input.action === "recovery" || receipt.target.emailConfirmed || receipt.target.passwordSet) {
        if (!authUserId) throw new TeamFault(503, "incomplete_response", "Não foi possível confirmar a identidade da pessoa.");
        await backend.recover(receipt.target.email);
      } else {
        authUserId = await backend.invite(receipt.target.email, receipt.target.fullName);
      }
      sent = true;
      if (!authUserId || !uuid.test(authUserId)) throw new TeamFault(503, "incomplete_response", "O envio não pôde ser confirmado.", true);
      await backend.finish(actorId, input.requestId, authUserId);
      return reply(200, { ok: true, status: "completed", requestId: input.requestId, replayed: false, message: input.action === "recovery" ? "Instruções de recuperação enviadas para o e-mail da pessoa." : "Convite enviado. A pessoa receberá um link para definir a própria senha." });
    } catch (cause) {
      const fault = cause instanceof TeamFault ? cause : new TeamFault(503, "network_error", "Não foi possível confirmar o envio agora. Atualize a equipe antes de tentar novamente.", !!receipt);
      const uncertain = sent || fault.uncertain;
      if (receipt?.canSend && receipt.status !== "completed") {
        try { await backend.fail(actorId, receipt.requestId, sent ? "finalization_failed" : uncertain ? "send_uncertain" : "send_failed"); } catch { /* Never expose provider errors or credentials. */ }
      }
      return reply(fault.status, { ok: false, code: fault.code, message: sent ? "O e-mail pode ter sido enviado, mas a liberação do acesso ainda precisa ser confirmada. Atualize a equipe antes de solicitar outro convite." : fault.message, uncertain });
    }
  };
}
