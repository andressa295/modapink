import { test } from "node:test";
import assert from "node:assert/strict";
const actor = "00000000-0000-4000-8000-000000000011";
const member = "00000000-0000-4000-8000-000000000012";
const requestId = "00000000-0000-4000-8000-000000000013";
test("runtime de equipe separa JWT de usuário da chave administrativa e fixa o destino do convite", async () => {
  const originalFetch = globalThis.fetch; const originalDeno = globalThis.Deno; const calls = []; let serve;
  try {
    globalThis.Deno = { env: { get: name => name === "SUPABASE_URL" ? "https://project.example.test" : name === "SUPABASE_SERVICE_ROLE_KEY" ? "server-only-test-key" : undefined }, serve: handler => { serve = handler; } };
    globalThis.fetch = async (url, options) => {
      calls.push({ url, headers: options.headers, body: options.body ? JSON.parse(options.body) : null });
      const path = new URL(url).pathname;
      if (path === "/auth/v1/user") return Response.json({ id: actor });
      if (path.endsWith("mf_team_prepare")) return Response.json({ requestId, action: "invite", status: "processing", canSend: true, replayed: false, target: { id: null, email: "person@example.test", fullName: "Equipe", role: "producao", active: false, emailConfirmed: false, passwordSet: false, hasProfile: false } });
      if (path === "/auth/v1/invite") return Response.json({ id: member });
      if (path.endsWith("mf_team_finish")) return Response.json({ requestId, status: "completed" });
      throw new Error("Unexpected endpoint");
    };
    await import("../supabase/functions/team-access/index.ts");
    assert.equal(typeof serve, "function");
    const r = await serve(new Request("https://project.example.test/functions/v1/team-access", { method: "POST", headers: { Origin: "https://modapink-confeccao.vercel.app", Authorization: "Bearer fake.verified.user" }, body: JSON.stringify({ requestId, action: "invite", fullName: "Equipe", email: "person@example.test", role: "producao" }) }));
    assert.equal(r.status, 200);
    assert.equal(calls[0].headers.Authorization, "Bearer fake.verified.user");
    assert.equal(calls[0].headers.apikey, "server-only-test-key");
    assert.equal(calls[1].headers.Authorization, "Bearer server-only-test-key");
    assert.equal(calls[1].body.p_actor_id, actor);
    assert.equal(new URL(calls[2].url).searchParams.get("redirect_to"), "https://modapink-confeccao.vercel.app/auth/confirm");
    assert.deepEqual(calls[2].body, { email: "person@example.test", data: { full_name: "Equipe" } });
    assert.equal(calls[3].body.p_auth_user_id, member);
    const text = await r.text(); assert.equal(text.includes("server-only-test-key"), false); assert.equal(text.includes("fake.verified.user"), false);
  } finally { globalThis.fetch = originalFetch; if (originalDeno === undefined) delete globalThis.Deno; else globalThis.Deno = originalDeno; }
});
