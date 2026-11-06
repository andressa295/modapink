import { test } from "node:test";
import assert from "node:assert/strict";
import { createTeamAccessHandler, TeamFault } from "../supabase/functions/team-access/handler.ts";

const actor = "00000000-0000-4000-8000-000000000001";
const member = "00000000-0000-4000-8000-000000000002";
const requestId = "00000000-0000-4000-8000-000000000003";
const origin = "https://modapink-confeccao.vercel.app";
const input = { requestId, action: "invite", email: "person@example.test", fullName: "Pessoa da equipe", role: "producao" };
function setup(overrides = {}) {
  const calls = [];
  const receipt = { requestId, action: "invite", status: "processing", canSend: true, replayed: false, target: { id: null, email: "person@example.test", fullName: "Pessoa da equipe", role: "producao", active: true, emailConfirmed: false, passwordSet: false, hasProfile: false } };
  const backend = {
    verifyUser: async token => { calls.push(["verify", token]); return { id: actor }; },
    prepare: async (id, data) => { calls.push(["prepare", id, data]); return receipt; },
    invite: async (email, name) => { calls.push(["invite", email, name]); return member; },
    recover: async email => { calls.push(["recover", email]); },
    finish: async (...data) => { calls.push(["finish", ...data]); return {}; },
    fail: async (...data) => { calls.push(["fail", ...data]); }, ...overrides,
  };
  const handler = createTeamAccessHandler(backend);
  const send = (body = input, headers = {}) => handler(new Request(origin + "/functions/v1/team-access", { method: "POST", headers: { Origin: origin, Authorization: "Bearer fake.user.jwt", "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) }));
  return { calls, receipt, backend, handler, send };
}
test("equipe: convite usa ator verificado, destinatário validado e não retorna senha ou link", async () => {
  const s = setup(); const r = await s.send({ ...input, email: " PERSON@EXAMPLE.TEST " });
  assert.equal(r.status, 200); const body = await r.json(); assert.equal(body.ok, true);
  assert.deepEqual(s.calls.map(c => c[0]), ["verify", "prepare", "invite", "finish"]);
  assert.equal(s.calls[1][1], actor); assert.equal(s.calls[1][2].email, input.email);
  assert.deepEqual(s.calls[3], ["finish", actor, requestId, member]);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.equal("password" in body, false); assert.equal("token" in body, false); assert.equal("link" in body, false);
});
test("equipe: falta de sessão, origem externa e corpo com ator forjado falham antes do envio", async () => {
  const s = setup();
  assert.equal((await s.send(input, { Authorization: "" })).status, 401);
  assert.equal((await s.send(input, { Origin: "https://other.example" })).status, 403);
  assert.equal((await s.send({ ...input, actorId: actor })).status, 400);
  assert.equal((await s.send({ ...input, role: "superadmin" })).status, 400);
  assert.equal(s.calls.some(c => c[0] === "invite" || c[0] === "prepare"), false);
});
test("equipe: JWT não verificado ou administrador revogado não dispara Auth Admin", async () => {
  let s = setup({ verifyUser: async () => null }); assert.equal((await s.send()).status, 401); assert.equal(s.calls.length, 0);
  s = setup({ prepare: async () => { throw new TeamFault(403, "forbidden", "Somente administração."); } });
  assert.equal((await s.send()).status, 403); assert.equal(s.calls.some(c => c[0] === "invite" || c[0] === "finish"), false);
});
test("equipe: replay concluído e solicitação em curso nunca reenviam automaticamente", async () => {
  const s = setup(); s.receipt.canSend = false; s.receipt.status = "completed";
  let r = await s.send(); assert.equal(r.status, 200); assert.equal((await r.json()).replayed, true);
  s.receipt.status = "processing"; r = await s.send(); assert.equal(r.status, 409); assert.equal((await r.json()).uncertain, true);
  assert.equal(s.calls.some(c => c[0] === "invite" || c[0] === "recover"), false);
});
test("equipe: recuperação deriva e-mail da identidade no banco, sem dados de permissão no corpo", async () => {
  const s = setup(); Object.assign(s.receipt, { action: "recovery" }); Object.assign(s.receipt.target, { id: member, hasProfile: true, emailConfirmed: true, passwordSet: true });
  const r = await s.send({ requestId, action: "recovery", userId: member }); assert.equal(r.status, 200);
  assert.deepEqual(s.calls.find(c => c[0] === "recover"), ["recover", input.email]);
  assert.equal((await s.send({ requestId, action: "recovery", userId: member, email: "other@example.test" })).status, 400);
});
test("equipe: falha após envio preserva estado incerto e não vaza erro de provedor", async () => {
  const s = setup({ finish: async () => { throw new Error("private-provider-token"); } });
  const r = await s.send(); const body = await r.json(); assert.equal(r.status, 503); assert.equal(body.uncertain, true);
  assert.equal(JSON.stringify(body).includes("private-provider-token"), false);
  assert.deepEqual(s.calls.find(c => c[0] === "fail"), ["fail", actor, requestId, "finalization_failed"]);
});
test("equipe: retomada finaliza identidade criada sem reenviar; CORS é restrito", async () => {
  const s = setup(); Object.assign(s.receipt, { status: "uncertain", canSend: false }); s.receipt.target.id = member;
  const r = await s.send(); assert.equal(r.status, 200); assert.equal(s.calls.some(c => c[0] === "invite"), false); assert.equal(s.calls.some(c => c[0] === "finish"), true);
  const preflight = await s.handler(new Request(origin, { method: "OPTIONS", headers: { Origin: origin } }));
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get("access-control-allow-origin"), origin);
});
test("equipe: novo convite explícito pode retomar restauração de perfil removido sem outro e-mail", async () => {
  const s = setup(); Object.assign(s.receipt, { status: "uncertain", canSend: false }); Object.assign(s.receipt.target, { id: member, hasProfile: true, archived: true, active: false });
  const r = await s.send(); assert.equal(r.status, 200); assert.equal(s.calls.some(c => c[0] === "invite" || c[0] === "recover"), false); assert.deepEqual(s.calls.find(c => c[0] === "finish"), ["finish", actor, requestId, member]);
});
test("equipe: confirmação de convite antigo não apresenta como ativo um acesso removido", async () => {
  const s = setup(); Object.assign(s.receipt, { status: "completed", canSend: false }); Object.assign(s.receipt.target, { id: member, hasProfile: true, archived: true, active: false });
  const r = await s.send(); assert.equal(r.status, 409); assert.equal((await r.json()).uncertain, false); assert.equal(s.calls.some(c => ["invite", "recover", "finish"].includes(c[0])), false);
});
