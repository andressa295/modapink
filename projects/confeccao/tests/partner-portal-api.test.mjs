import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import ts from "typescript";
import * as contract from "../lib/partner-portal-contract.ts";

// Exercise the shipped adapter and real SDK. Only configuration and HTTP are fixtures.
const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../lib/partner-portal.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function adapter() {
  const module = { exports: {} };
  const resolve = name => name === "./supabase-client" ? { getSupabasePublicConfiguration: () => ({ url: "https://portal.example.invalid", publishableKey: "sb_publishable_test_fixture" }), getSupabase: () => { throw new Error("Guest must not initialize owner access"); } }
    : name === "./production-contract" ? { requestUuid: randomUUID }
    : name === "./partner-portal-contract" ? contract : require(name);
  new Function("require", "exports", "module", compiled)(resolve, module.exports, module);
  return module.exports;
}
const partnerId = "1093a45e-651f-44d9-a9d1-1f7822faec13";
const orderId = "871c853b-0f59-430e-bbf3-945d706b8716";
const image = "models/3effd41a-592f-4682-8cbb-80f77d29001b.webp";
const token = "0".repeat(64);
function state() { return { partner: { id: partnerId, name: "Test partner" }, expiresAt: "2099-12-01T10:00:00Z", orders: [{ id: orderId, code: "OP-1", model: { id: partnerId, name: "Test model", reference: "REF-1", image }, quantity: 100, variants: [{ size: "M", quantity: 100 }], stage: "Costura", due: "2099-12-10", priority: "Normal" }], updates: [], latestUpdates: [], historyLimit: 200 }; }
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
async function withHttp(stub, run) {
  const original = globalThis.fetch;
  const api = adapter();
  let connection;
  globalThis.fetch = async (input, init) => stub(new URL(String(input)), init);
  try { connection = api.createGuestPortalConnection(token); await run(api, connection); }
  finally { connection?.dispose(); globalThis.fetch = original; }
}

test("RPC401 without a PostgreSQL code remains an access error instead of a network error", async () => {
  await withHttp(() => json({ message: "Invalid API key" }, 401), async (_api, connection) => {
    await assert.rejects(connection.load(), cause => cause.kind === "denied" && !cause.message.includes("Invalid API key"));
  });
});

test("unavailable image keeps orders only after a new successful RPC access check", async () => {
  let rpcCalls = 0; let photoCalls = 0;
  await withHttp((url, init) => {
    assert.equal(new Headers(init.headers).get("x-confeccao-portal"), token);
    if (url.pathname.endsWith("/rpc/mf_portal_get")) { rpcCalls += 1; return json(state()); }
    if (url.pathname === `/storage/v1/object/confeccao-images/${image}`) { photoCalls += 1; return json({ statusCode: "404", error: "not_found", message: "Object not found" }, 400); }
    throw new Error("Unexpected HTTP request");
  }, async (api, connection) => {
    await connection.load();
    const result = await api.loadGuestPortalPhotos(connection, [image]);
    assert.equal(result.unavailable, true); assert.equal(result.state.orders[0].id, orderId); assert.deepEqual(result.urls, {});
    assert.equal(rpcCalls, 2); assert.equal(photoCalls, 1);
  });
});

test("revoked access during an image request clears access instead of becoming a media warning", async () => {
  let rpcCalls = 0;
  await withHttp(url => {
    if (url.pathname.endsWith("/rpc/mf_portal_get")) { rpcCalls += 1; return rpcCalls === 1 ? json(state()) : json({ code: "42501", message: "Link revoked" }, 401); }
    return json({ statusCode: "403", message: "Access denied" }, 403);
  }, async (api, connection) => {
    await connection.load();
    await assert.rejects(api.loadGuestPortalPhotos(connection, [image]), cause => cause.kind === "denied");
    await assert.rejects(connection.submit({ orderId, stage: "Costura", produced: 1, checked: 0, defects: 0, reporter: "Test" }, randomUUID()), cause => cause.kind === "denied");
    assert.equal(rpcCalls, 2);
  });
});

test("media recovery applies the new scope when a production was unlinked", async () => {
  let rpcCalls = 0;
  await withHttp(url => {
    if (url.pathname.endsWith("/rpc/mf_portal_get")) { rpcCalls += 1; const next = state(); if (rpcCalls > 1) next.orders = []; return json(next); }
    return json({ message: "Not found" }, 400);
  }, async (api, connection) => {
    await connection.load();
    const result = await api.loadGuestPortalPhotos(connection, [image]);
    assert.equal(result.unavailable, true); assert.deepEqual(result.state.orders, []);
    await assert.rejects(connection.submit({ orderId, stage: "Costura", produced: 1, checked: 0, defects: 0, reporter: "Test" }, randomUUID()), cause => cause.kind === "denied");
  });
});

test("a failed RPC revalidation cannot fall back to previously loaded orders", async () => {
  let rpcCalls = 0;
  await withHttp(url => {
    if (url.pathname.endsWith("/rpc/mf_portal_get")) { rpcCalls += 1; return rpcCalls === 1 ? json(state()) : json({ message: "Service unavailable" }, 503); }
    return json({ message: "Object not found" }, 400);
  }, async (api, connection) => {
    await connection.load();
    await assert.rejects(api.loadGuestPortalPhotos(connection, [image]), cause => cause.kind === "network");
    await assert.rejects(connection.submit({ orderId, stage: "Costura", produced: 1, checked: 0, defects: 0, reporter: "Test" }, randomUUID()), cause => cause.kind === "denied");
  });
});
