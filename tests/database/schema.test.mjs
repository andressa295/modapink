import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const root = new URL('../../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('database/replication/source-schema-manifest.json', root), 'utf8'));
const migrationDir = new URL('supabase/migrations/', root);
const files = (await readdir(migrationDir)).filter(name => name.endsWith('.sql')).sort();
const sql = await Promise.all(files.map(name => readFile(new URL(name, migrationDir), 'utf8')));
const admin = '11111111-1111-4111-8111-111111111111';
const agent = '22222222-2222-4222-8222-222222222222';
const unprofiled = '33333333-3333-4333-8333-333333333333';

// Fixtures minimas de schemas/roles administrados pela plataforma, nunca migrations.
const platformFixture = `
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN BYPASSRLS;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
  CREATE SCHEMA storage;
  CREATE TABLE storage.buckets (
    id text PRIMARY KEY, name text NOT NULL, public boolean NOT NULL DEFAULT false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  CREATE TABLE storage.objects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text REFERENCES storage.buckets(id), name text
  );
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
  GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated, service_role;
  CREATE PUBLICATION supabase_realtime;
`;

const normalize = text => text?.replaceAll('\r', '').replace(/\s+/g, ' ').trim();
const by = (items, key) => [...items].sort((a, b) => a[key].localeCompare(b[key]));

async function apply(db, text) {
  try { await db.transaction(tx => tx.exec(text)); }
  catch (error) { throw new Error(`Migration: ${error.message} (SQLSTATE ${error.code || 'unknown'}, position ${error.position || 'unknown'})`); }
}
async function asUser(db, role, id, fn) {
  return db.transaction(async tx => {
    await tx.exec(`SET LOCAL ROLE ${role}`);
    await tx.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [id || '']);
    return fn(tx);
  });
}

test('instala e verifica o Phand Core em PostgreSQL 17 isolado', async t => {
  const db = new PGlite({ extensions: { uuid_ossp, pgcrypto } });
  try {
    await db.exec(platformFixture);
    assert.match((await db.query('SHOW server_version')).rows[0].server_version, /^17\./);

    await t.test('snapshot reproduz tabelas, colunas, constraints, indices, funcoes e policies reais', async () => {
      await apply(db, sql[0]);
      const catalogQuery = await readFile(new URL('database/replication/catalog.sql', root), 'utf8');
      const results = await db.exec(catalogQuery);
      const catalog = results.find(r => r.rows?.[0]?.jsonb_build_object)?.rows[0].jsonb_build_object;
      assert.ok(catalog);
      assert.equal(catalog.relations.filter(r => r.kind === 'r').length, 27);
      assert.equal(catalog.relations.filter(r => r.kind === 'v').length, 1);
      assert.equal(catalog.relations.reduce((sum, r) => sum + r.columns.length, 0), 354);
      for (const expected of manifest.relations) {
        const actual = catalog.relations.find(r => r.name === expected.name);
        assert.ok(actual, expected.name);
        assert.deepEqual(actual.columns, expected.columns, expected.name);
        assert.equal(actual.kind, expected.kind, expected.name);
        assert.equal(actual.row_level_security, expected.row_level_security, expected.name);
        assert.equal(actual.force_row_level_security, expected.force_row_level_security, expected.name);
        assert.equal(normalize(actual.view_definition), normalize(expected.view_definition), expected.name);
      }
      assert.equal(catalog.constraints.length, 70);
      const constraints = (await db.query(`SELECT c.relname AS "table", co.conname AS name,
        pg_get_constraintdef(co.oid, false) AS definition
        FROM pg_constraint co JOIN pg_class c ON c.oid=co.conrelid
        JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'`)).rows;
      for (const expected of manifest.constraints) {
        const actual = constraints.find(c => c.table === expected.table && c.name === expected.name);
        assert.ok(actual, expected.name);
        assert.equal(normalize(actual.definition), normalize(expected.definition), expected.name);
      }
      assert.equal(catalog.indexes.length, 83);
      for (const expected of manifest.indexes) {
        const actual = catalog.indexes.find(i => i.name === expected.name);
        assert.ok(actual, expected.name);
        assert.equal(normalize(actual.definition), normalize(expected.definition), expected.name);
        assert.equal(actual.valid, expected.valid);
      }
      assert.equal(catalog.functions.length, 3);
      for (const expected of manifest.functions) {
        const actual = catalog.functions.find(f => f.name === expected.name && f.arguments === expected.arguments);
        assert.ok(actual, expected.name);
        assert.equal(normalize(actual.definition), normalize(expected.definition), expected.name);
      }
      assert.deepEqual(by(catalog.policies, 'policyname'), by(manifest.policies.filter(p => p.schemaname === 'public'), 'policyname'));
      for (const [name, acl] of Object.entries(manifest.relation_acl)) {
        const actual = catalog.relations.find(r => r.name === name).acl;
        assert.deepEqual([...actual].sort(), [...acl].sort(), `grants ${name}`);
      }
    });

    await t.test('protege bancos existentes antes de qualquer mudanca da baseline', async () => {
      await assert.rejects(apply(db, sql[0]), /novo e vazio/);
      assert.equal((await db.query("SELECT count(*)::int AS total FROM pg_tables WHERE schemaname='public'")).rows[0].total, 27);
    });

    await t.test('complementa runtime, mantem todas as tabelas vazias e configura buckets/Realtime', async () => {
      await apply(db, sql[1]);
      await apply(db, sql[2]);
      await apply(db, await readFile(new URL('supabase/seed.sql', root), 'utf8'));
      const tables = (await db.query("SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
      assert.equal(tables.length, 29);
      assert.ok(tables.every(row => row.rowsecurity));
      for (const row of tables) assert.equal((await db.query(`SELECT count(*)::int AS total FROM public.${row.tablename}`)).rows[0].total, 0, row.tablename);
      assert.deepEqual((await db.query('SELECT id, name, public, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY id')).rows,
        by(manifest.bucket_settings, 'id'));
      assert.deepEqual((await db.query("SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname='supabase_realtime'")).rows,
        [{ schemaname: 'public', tablename: 'messages' }]);
      assert.equal((await db.query("SELECT reloptions FROM pg_class WHERE oid='public.conversation_review_stats'::regclass")).rows[0].reloptions.includes('security_invoker=true'), true);
    });

    await t.test('cria perfil ligado ao Auth e impede promocao ou exclusao por atendentes', async () => {
      await db.query('INSERT INTO auth.users(id) VALUES ($1), ($2), ($3)', [admin, agent, unprofiled]);
      await asUser(db, 'service_role', '', async tx => {
        await tx.query("INSERT INTO public.profiles(id,name,email,role) VALUES ($1,'Admin teste','admin@example.test','admin'), ($2,'Agent teste','agent@example.test','agent')", [admin, agent]);
      });
      await asUser(db, 'authenticated', agent, async tx => {
        assert.deepEqual((await tx.query('SELECT id,role FROM public.profiles')).rows, [{ id: agent, role: 'agent' }]);
        assert.equal((await tx.query("UPDATE public.profiles SET role='admin' WHERE id=$1 RETURNING id", [agent])).rows.length, 0);
        assert.equal((await tx.query('DELETE FROM public.profiles WHERE id=$1 RETURNING id', [admin])).rows.length, 0);
      });
      await assert.rejects(asUser(db, 'authenticated', agent, tx => tx.query("INSERT INTO public.profiles(id,role) VALUES ($1,'admin')", [unprofiled])), error => error.code === '42501');
      await asUser(db, 'authenticated', admin, async tx => {
        assert.equal((await tx.query('SELECT id FROM public.profiles')).rows.length, 2);
      });
      await assert.rejects(db.query("INSERT INTO public.profiles(id,role) VALUES (gen_random_uuid(),'agent')"), error => error.code === '23503');
    });

    await t.test('anonimo nao acessa tabelas da loja e somente admin altera configuracoes', async () => {
      for (const table of ['profiles', 'stores', 'whatsapp_sessions', 'messages']) {
        await assert.rejects(asUser(db, 'anon', '', tx => tx.query(`SELECT * FROM public.${table}`)), error => error.code === '42501');
      }
      await asUser(db, 'authenticated', admin, async tx => {
        await tx.query("INSERT INTO public.store_settings(store_key,settings) VALUES ('default',$1) ON CONFLICT(store_key) DO UPDATE SET settings=EXCLUDED.settings", [{ store_name: 'Loja de teste' }]);
        await tx.query("INSERT INTO public.store_settings(store_key,settings) VALUES ('default',$1) ON CONFLICT(store_key) DO UPDATE SET settings=EXCLUDED.settings", [{ store_name: 'Outra configuracao de teste' }]);
        assert.equal((await tx.query('SELECT settings FROM public.store_settings')).rows[0].settings.store_name, 'Outra configuracao de teste');
      });
      await asUser(db, 'authenticated', agent, async tx => {
        assert.equal((await tx.query('SELECT * FROM public.store_settings')).rows.length, 0);
        assert.equal((await tx.query("UPDATE public.store_settings SET settings='{}' RETURNING id")).rows.length, 0);
      });
      await assert.rejects(asUser(db, 'authenticated', agent, tx => tx.query("INSERT INTO public.store_settings(store_key) VALUES ('another')")), error => error.code === '42501');
    });

    await t.test('backend grava conversas/mensagens; somente perfis autorizados leem o chat', async () => {
      await asUser(db, 'service_role', '', async tx => {
        const conversation = (await tx.query("INSERT INTO public.conversations(phone) VALUES ('synthetic') RETURNING id")).rows[0].id;
        await tx.query("INSERT INTO public.messages(conversation_id,sender,content,session_key) VALUES ($1,'user','Teste sintetico','principal')", [conversation]);
        await tx.query("INSERT INTO public.meta_whatsapp_events(event_id,event_type) VALUES ('synthetic-event','test')");
      });
      await asUser(db, 'authenticated', agent, async tx => {
        assert.equal((await tx.query('SELECT * FROM public.messages')).rows.length, 1);
        assert.equal((await tx.query('SELECT * FROM public.conversation_review_stats')).rows.length, 1);
      });
      await asUser(db, 'authenticated', unprofiled, async tx => {
        assert.equal((await tx.query('SELECT * FROM public.messages')).rows.length, 0);
      });
      await assert.rejects(asUser(db, 'authenticated', agent, tx => tx.query('SELECT * FROM public.meta_whatsapp_events')), error => error.code === '42501');
      assert.equal((await db.query("SELECT proconfig FROM pg_proc WHERE oid='public.increment_automation_usage(uuid)'::regprocedure")).rows[0].proconfig.includes('search_path=public'), true);
      assert.equal((await db.query("SELECT prosecdef FROM pg_proc WHERE oid='public.get_sales_funnel_total()'::regprocedure")).rows[0].prosecdef, false);
      await assert.rejects(asUser(db, 'anon', '', tx => tx.query('SELECT public.get_sales_funnel_total()')), error => error.code === '42501');
    });

    await t.test('midias de campanhas so recebem escrita de admin', async () => {
      await asUser(db, 'authenticated', admin, async tx => {
        await tx.query("INSERT INTO storage.objects(bucket_id,name) VALUES ('broadcast-media','synthetic.jpg')");
        assert.equal((await tx.query('SELECT * FROM storage.objects')).rows.length, 1);
      });
      await assert.rejects(asUser(db, 'authenticated', agent, tx => tx.query("INSERT INTO storage.objects(bucket_id,name) VALUES ('broadcast-media','blocked.jpg')")), error => error.code === '42501');
      await asUser(db, 'authenticated', agent, async tx => {
        assert.equal((await tx.query('DELETE FROM storage.objects RETURNING id')).rows.length, 0);
      });
    });

    await t.test('tabelas futuras recebem RLS automatico e nao recebem grants anonimos', async () => {
      await db.exec('CREATE TABLE public.verification_new_table(id uuid)');
      assert.equal((await db.query("SELECT relrowsecurity FROM pg_class WHERE oid='public.verification_new_table'::regclass")).rows[0].relrowsecurity, true);
      await assert.rejects(asUser(db, 'anon', '', tx => tx.query('SELECT * FROM public.verification_new_table')), error => error.code === '42501');
      await db.exec('DROP TABLE public.verification_new_table');
    });
  } finally { await db.close(); }
});
