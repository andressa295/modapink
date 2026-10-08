import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAdmin } from '../scripts/database/create-admin.mjs';
import { exportSchema } from '../scripts/database/export-schema.mjs';

const projectRef = 'abcdefghijklmnopqrst';
const userId = '11111111-1111-4111-8111-111111111111';
const config = () => ({
  PHAND_TARGET_SUPABASE_URL: `https://${projectRef}.supabase.co`,
  PHAND_TARGET_SUPABASE_SERVICE_ROLE_KEY: 'unit-test-server-key',
  PHAND_EXPECTED_PROJECT_REF: projectRef,
  PHAND_ADMIN_EMAIL: 'admin@example.test', PHAND_ADMIN_NAME: 'Administrador Teste',
  PHAND_ADMIN_PASSWORD: 'OnlyForUnitTests!123',
});
function mockFetch(responses, calls) {
  return async (url, options) => {
    calls.push({ url, ...options });
    const item = responses.shift();
    if (!item) throw new Error('Unexpected request');
    if (item instanceof Error) throw item;
    return item.status === 204 ? new Response(null, { status: 204 })
      : Response.json(item.body, { status: item.status || 200 });
  };
}

test('validacao padrao nao faz chamadas nem cria conta', async () => {
  let calls = 0;
  assert.equal((await createAdmin({ env: config(), fetchImpl: () => { calls++; } })).status, 'dry_run');
  assert.equal(calls, 0);
});

test('bloqueia a Moda Pink e o projeto de origem antes de qualquer chamada', async () => {
  for (const ref of ['wpzqnfvuczqnpuvuxdlx', projectRef]) {
    const env = { ...config(), PHAND_TARGET_SUPABASE_URL: `https://${ref}.supabase.co`,
      PHAND_EXPECTED_PROJECT_REF: ref, PHAND_SOURCE_PROJECT_REF: ref };
    await assert.rejects(createAdmin({ env, apply: true, fetchImpl: () => assert.fail('network') }), /origem\/Moda Pink/);
  }
});

test('bloqueia destino divergente, URL externa e senha curta', async () => {
  for (const patch of [
    { PHAND_EXPECTED_PROJECT_REF: 'another-project' },
    { PHAND_TARGET_SUPABASE_URL: 'https://external.example' },
    { PHAND_TARGET_SUPABASE_URL: `http://${projectRef}.supabase.co` },
    { PHAND_ADMIN_PASSWORD: 'short' },
  ]) await assert.rejects(createAdmin({ env: { ...config(), ...patch }, apply: true,
    fetchImpl: () => assert.fail('network') }));
});

test('recusa instalacao que ja possui perfis', async () => {
  const calls = [];
  await assert.rejects(createAdmin({ env: config(), apply: true,
    fetchImpl: mockFetch([{ body: [{ id: userId }] }], calls) }), /ja tem perfis/);
  assert.ok(calls.every(item => item.method === 'GET'));
});

test('recusa instalacao que ja possui contas Auth', async () => {
  const calls = [];
  await assert.rejects(createAdmin({ env: config(), apply: true,
    fetchImpl: mockFetch([{ body: [] }, { body: { users: [{ id: userId }] } }], calls) }), /ja tem contas/);
  assert.ok(calls.every(item => item.method === 'GET'));
});

test('cria Auth e confirma profiles como admin, inclusive com trigger de perfil', async () => {
  const calls = [];
  const result = await createAdmin({ env: config(), apply: true, fetchImpl: mockFetch([
    { body: [] }, { body: { users: [] } }, { body: { id: userId } },
    { body: [{ id: userId, role: 'admin' }] },
  ], calls) });
  assert.equal(result.status, 'created');
  assert.equal(result.userId, userId);
  assert.equal(calls[3].headers.Prefer, 'resolution=merge-duplicates,return=representation');
  assert.deepEqual(JSON.parse(calls[3].body), {
    id: userId, name: 'Administrador Teste', email: 'admin@example.test', role: 'admin',
  });
  assert.equal(JSON.stringify(result).includes(config().PHAND_ADMIN_PASSWORD), false);
  assert.equal(JSON.stringify(result).includes(config().PHAND_TARGET_SUPABASE_SERVICE_ROLE_KEY), false);
});

test('falha de perfil remove somente a conta criada nesta tentativa', async () => {
  const calls = [];
  await assert.rejects(createAdmin({ env: config(), apply: true, fetchImpl: mockFetch([
    { body: [] }, { body: { users: [] } }, { body: { id: userId } },
    { status: 500, body: { message: 'server failure' } }, { status: 204 }, { status: 204 },
  ], calls) }), /conta desta tentativa foi removida/);
  assert.equal(calls.at(-1).method, 'DELETE');
  assert.ok(calls.at(-1).url.endsWith(`/auth/v1/admin/users/${userId}`));
});

test('falha no Auth nunca tenta excluir conta existente', async () => {
  const calls = [];
  await assert.rejects(createAdmin({ env: config(), apply: true, fetchImpl: mockFetch([
    { body: [] }, { body: { users: [] } }, { status: 422, body: { message: 'existing account' } },
  ], calls) }), /HTTP 422/);
  assert.ok(calls.every(item => item.method !== 'DELETE'));
});

test('falha de limpeza informa estado pendente sem revelar senha/chave', async () => {
  const calls = [];
  await assert.rejects(createAdmin({ env: config(), apply: true, fetchImpl: mockFetch([
    { body: [] }, { body: { users: [] } }, { body: { id: userId } },
    { status: 500, body: {} }, { status: 204 }, { status: 500, body: {} },
  ], calls) }), error => /Conclua a limpeza/.test(error.message)
    && !error.message.includes(config().PHAND_ADMIN_PASSWORD)
    && !error.message.includes(config().PHAND_TARGET_SUPABASE_SERVICE_ROLE_KEY));
});

test('exporta somente estrutura, preserva grants e marca revisao do banco gerenciado', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'phand-schema-'));
  const calls = [];
  const env = { PGHOST: 'db.example.test', PGUSER: 'postgres', PGDATABASE: 'postgres', PGPASSWORD: 'unit-test-password' };
  try {
    await exportSchema({ env, outputDir: directory, run: async (program, args, childEnv) => {
      calls.push({ program, args, env: childEnv });
      return program === 'psql' ? JSON.stringify({ application_schemas: ['public'], triggers: [], policies: [], publications: [] })
        : '-- PostgreSQL database dump\nCREATE SCHEMA "public";\nGRANT SELECT ON TABLE "public"."profiles" TO "authenticated";\n';
    } });
    const sql = await readFile(join(directory, 'schema.sql'), 'utf8');
    assert.ok(sql.includes('CREATE SCHEMA IF NOT EXISTS "public";'));
    assert.ok(sql.includes('GRANT SELECT'));
    assert.ok(calls[1].args.includes('--schema-only'));
    assert.equal(calls[1].args.includes('--no-privileges'), false);
    assert.ok(calls.every(item => !JSON.stringify(item.args).includes(env.PGPASSWORD)));
    assert.ok(calls.every(item => item.env.PGOPTIONS.includes('default_transaction_read_only=on')));
    assert.equal(JSON.parse(await readFile(join(directory, 'capture-status.json'), 'utf8')).status, 'captured_not_restore_verified');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
