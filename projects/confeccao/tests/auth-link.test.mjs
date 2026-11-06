import { test } from "node:test";
import assert from "node:assert/strict";
import { readPasswordLink, passwordLinkDestination, callbackAuthFlow } from "../lib/auth-link.ts";
test("convite implicit no root abre definição de senha e escolhe o fluxo compatível", () => {
  const url = new URL("https://factory.example/#access_token=fake-test-token&refresh_token=fake-test-refresh&expires_in=3600&token_type=bearer&type=invite");
  assert.deepEqual(readPasswordLink(url), { kind: "invite", mechanism: "implicit" });
  assert.equal(callbackAuthFlow(url), "implicit");
  assert.match(passwordLinkDestination(url), /^\/auth\/recovery#/);
});
test("convite com token_hash é validado pelo tipo invite sem precisar de PKCE", () => {
  const url = new URL("https://factory.example/auth/confirm?token_hash=fake-hash&type=invite");
  assert.deepEqual(readPasswordLink(url), { kind: "invite", mechanism: "token_hash", tokenHash: "fake-hash" });
  assert.equal(callbackAuthFlow(url), "pkce");
});
test("recuperação por code mantém PKCE e seu identificador de fluxo", () => {
  const url = new URL("https://factory.example/login?code=fake-code&sb_flow_id=fake-flow");
  assert.deepEqual(readPasswordLink(url), { kind: "recovery", mechanism: "pkce" });
  assert.equal(callbackAuthFlow(url), "pkce");
  assert.equal(passwordLinkDestination(url), "/auth/recovery?code=fake-code&sb_flow_id=fake-flow");
});
test("destino externo fornecido em next não é propagado", () => {
  const url = new URL("https://factory.example/?token_hash=fake-hash&type=invite&next=https://attacker.example");
  assert.equal(passwordLinkDestination(url), "/auth/recovery?token_hash=fake-hash&type=invite");
});
test("link expirado e token parcial falham fechados", () => {
  assert.equal(readPasswordLink(new URL("https://factory.example/#error=access_denied&error_code=otp_expired"))?.mechanism, "invalid");
  assert.equal(readPasswordLink(new URL("https://factory.example/#access_token=fake&type=invite"))?.mechanism, "invalid");
});
test("visita normal ao login e tipos de OTP fora do fluxo de senha não viram convite", () => {
  assert.equal(readPasswordLink(new URL("https://factory.example/login")), null);
  assert.equal(readPasswordLink(new URL("https://factory.example/?token_hash=fake&type=magiclink"))?.mechanism, "invalid");
});
