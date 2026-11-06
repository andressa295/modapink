// Synthetic PostgreSQL tests only. No hosted database, Auth API or email is used.
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const db = new PGlite();
process.on('uncaughtException', error => {
  console.error(JSON.stringify({ message: error.message, code: error.code, detail: error.detail, where: error.where }));
  process.exit(1);
});
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth; create schema storage;
  create table auth.users(
    id uuid primary key,email text unique,email_confirmed_at timestamptz,
    encrypted_password text,invited_at timestamptz,last_sign_in_at timestamptz
  );
  create function auth.uid() returns uuid language sql stable as
    $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth,storage to authenticated,anon;
  grant execute on function auth.uid() to authenticated,anon;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets,name text,owner_id text);
  alter table storage.objects enable row level security;
  grant select,insert,update,delete on storage.objects to authenticated;
  create function storage.allow_only_operation(operation text) returns boolean language sql stable as
    $$select current_setting('storage.operation',true)=operation$$;
`);
for (const migration of ['schema.sql', 'partner-portal.sql', 'portal-image-fix.sql', 'team-invites.sql', 'record-removal.sql']) {
  await db.exec(await readFile(new URL(`../${migration}`, import.meta.url), 'utf8'));
}

const admin = '11111111-1111-4111-8111-111111111111';
const adminTwo = '22222222-2222-4222-8222-222222222222';
const manager = '33333333-3333-4333-8333-333333333333';
const production = '44444444-4444-4444-8444-444444444444';
const removed = '55555555-5555-4555-8555-555555555555';
const inactive = '66666666-6666-4666-8666-666666666666';
await db.query(`insert into auth.users(id,email,email_confirmed_at,encrypted_password,invited_at) values
  ($1,'admin@example.test',now(),'SYNTHETIC-HASH-NOT-FOR-CLIENT',now()),
  ($2,'second-admin@example.test',now(),'SYNTHETIC-HASH-NOT-FOR-CLIENT',now()),
  ($3,'manager@example.test',now(),'SYNTHETIC-HASH-NOT-FOR-CLIENT',now()),
  ($4,'production@example.test',now(),'SYNTHETIC-HASH-NOT-FOR-CLIENT',now()),
  ($5,'removed@example.test',now(),'SYNTHETIC-HASH-NOT-FOR-CLIENT',now()),
  ($6,'inactive@example.test',now(),'SYNTHETIC-HASH-NOT-FOR-CLIENT',now())`,
[admin, adminTwo, manager, production, removed, inactive]);
await db.query(`insert into public.profiles(id,full_name,role,active) values
  ($1,'Admin Test','admin',true),($2,'Second Admin Test','admin',true),
  ($3,'Manager Test','gestao',true),($4,'Production Test','producao',true),
  ($5,'Inactive Test','qualidade',false)`, [admin, adminTwo, manager, production, inactive]);

async function scalar(sql, args = []) { return (await db.query(sql, args)).rows[0].value; }
async function asAuth(id) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec('set role authenticated');
}
async function asService() {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub','',false)");
  await db.exec('set role service_role');
}
async function prepare({ request = crypto.randomUUID(), action = 'invite', email = null, name = null, role = null, userId = null } = {}) {
  return scalar('select public.mf_team_prepare($1::uuid,$2::uuid,$3,$4,$5,$6,$7::uuid) value',
    [admin, request, action, email, name, role, userId]);
}
async function finish(request, id = removed) {
  return scalar('select public.mf_team_finish($1::uuid,$2::uuid,$3::uuid) value', [admin, request, id]);
}
async function removeMember(id) {
  return scalar("select public.mf_remove_record('member',$1) value", [id]);
}
async function list() { return scalar('select public.mf_team_list() value'); }
async function profile(id = removed) {
  await db.exec('reset role');
  return (await db.query('select id,full_name,role,active,archived_at,archived_by from public.profiles where id=$1', [id])).rows[0];
}
async function ageRequests(email = 'removed@example.test') {
  await db.exec('reset role');
  await db.query("update mf_private.team_invite_requests set created_at=now()-interval '2 hours' where email=$1", [email]);
  await asService();
}
async function assertArchived(id = removed) {
  const row = await profile(id);
  assert.equal(row.active, false);
  assert.ok(row.archived_at);
  assert.equal(row.archived_by, admin);
  await asAuth(admin);
  assert.equal((await list()).some(member => member.id === id), false);
  await asAuth(id);
  await assert.rejects(scalar('select public.mf_get_profile() value'), /ativo|removid|arquivad/);
  await assert.rejects(scalar('select public.mf_get_state() value'), /ativo|removid|arquivad/);
}

// A processing invitation created before membership/removal is not restoration consent.
await asService();
const oldRequest = crypto.randomUUID();
const oldInput = { request: oldRequest, email: 'removed@example.test', name: 'Old Invite Name', role: 'admin' };
assert.equal((await prepare(oldInput)).canSend, true);
await db.exec('reset role');
assert.equal(await scalar('select restore_archived value from mf_private.team_invite_requests where request_id=$1', [oldRequest]), false);
// Simulate an independent authorized provisioning that wins before the old callback.
await db.query("insert into public.profiles(id,full_name,role,active) values($1,'Existing Quality Member','qualidade',true)", [removed]);
await asAuth(admin);
assert.deepEqual(await removeMember(removed), { entity: 'member', id: removed, removed: true });
await assertArchived();
await asService();
const oldReplay = await prepare(oldInput);
assert.equal(oldReplay.canSend, false);
assert.equal(oldReplay.target.archived, true);
assert.equal(oldReplay.target.hasProfile, true);
await assert.rejects(finish(oldRequest), /removida após|novo convite/);
assert.equal((await profile()).role, 'qualidade');

// Existing non-archived inactive accounts remain blocked; an invite cannot reactivate them.
await asService();
await assert.rejects(prepare({ email: 'inactive@example.test', name: 'Invite Must Not Promote', role: 'admin' }), /já tem perfil/);
for (const action of ['resend', 'recovery']) {
  await assert.rejects(prepare({ action, userId: removed }), /removida|inativo/);
}
await asAuth(admin);
await assert.rejects(db.query('select public.mf_set_profile($1,$2,$3,$4)', [removed, 'Bypass archive', 'admin', true]), /removid|arquivad/);

// Only a fresh explicit invite freezes permission to restore an archived membership.
await ageRequests();
const restoreRequest = crypto.randomUUID();
const restoreInput = { request: restoreRequest, email: ' REMOVED@EXAMPLE.TEST ', name: ' Readded Manager ', role: 'gestao' };
const ticket = await prepare(restoreInput);
assert.equal(ticket.canSend, true);
assert.equal(ticket.target.archived, true);
assert.equal(ticket.target.role, 'gestao');
assert.equal(ticket.target.fullName, 'Readded Manager');
await db.exec('reset role');
assert.equal(await scalar('select restore_archived value from mf_private.team_invite_requests where request_id=$1', [restoreRequest]), true);
assert.equal(await scalar('select r.restore_archived_at is not distinct from p.archived_at value from mf_private.team_invite_requests r join public.profiles p on p.id=r.target_user_id where r.request_id=$1', [restoreRequest]), true);
await asService();
assert.equal((await prepare(restoreInput)).canSend, false);
await assert.rejects(prepare({ ...restoreInput, role: 'admin' }), /Identificador/);
const restored = await finish(restoreRequest);
assert.equal(restored.profile.role, 'gestao');
assert.equal(restored.profile.full_name, 'Readded Manager');
assert.equal(restored.profile.active, true);
assert.equal(restored.profile.archived, false);
assert.equal(restored.profile.status, 'active');
const restoredRow = await profile();
assert.equal(restoredRow.archived_at, null);
assert.equal(restoredRow.archived_by, null);
await asAuth(admin);
assert.equal((await list()).some(member => member.id === removed), true);
assert.equal(JSON.stringify(await list()).includes('SYNTHETIC-HASH-NOT-FOR-CLIENT'), false);
await asAuth(removed);
assert.equal((await scalar('select public.mf_get_profile() value')).role, 'gestao');

// A completed request replay cannot undo a subsequent removal.
await asAuth(admin);
await removeMember(removed);
await asService();
await assert.rejects(finish(restoreRequest), /removido após|novo convite/);
assert.equal((await prepare(restoreInput)).canSend, false);
await assertArchived();

// Nor may an uncompleted restoration ticket override a later removal epoch.
await ageRequests();
const staleRestore = crypto.randomUUID();
await prepare({ request: staleRestore, email: 'removed@example.test', name: 'Stale Admin Intent', role: 'admin' });
await ageRequests();
const currentRestore = crypto.randomUUID();
await prepare({ request: currentRestore, email: 'removed@example.test', name: 'Current Production Intent', role: 'producao' });
assert.equal((await finish(currentRestore)).profile.role, 'producao');
await asAuth(admin);
await removeMember(removed);
await asService();
await assert.rejects(finish(staleRestore), /removida após|novo convite/);
assert.equal((await profile()).role, 'producao');
await assertArchived();

// Removal is admin-only and cannot remove the caller or leave no active administrator.
for (const actor of [manager, production]) {
  await asAuth(actor);
  await assert.rejects(removeMember(inactive), /administrador|administração|permissão|permissões/);
}
await db.exec('reset role; set role anon');
await assert.rejects(removeMember(production), /permission denied/);
await asAuth(admin);
await assert.rejects(removeMember(admin), /própri|administrador|remover.*acesso|si mesmo/);
await removeMember(adminTwo);
await assert.rejects(removeMember(admin), /própri|administrador|remover.*acesso|si mesmo/);
await assert.rejects(db.query('select public.mf_set_profile($1,$2,$3,$4)', [admin, 'Admin Test', 'producao', true]), /administrador ativo/);
await db.exec('reset role');
assert.equal(await scalar("select count(*)::integer value from public.profiles where active and role='admin' and archived_at is null"), 1);
assert.equal(await scalar('select count(*)::integer value from auth.users'), 6);
assert.equal(await scalar('select count(*)::integer value from public.profiles'), 6);

// Replacing helpers preserves service-only provisioning and guarded sensitive listing.
for (const actor of [admin, manager, production]) {
  await asAuth(actor);
  await assert.rejects(prepare({ email: 'forbidden@example.test', name: 'Forbidden', role: 'admin' }), /permission denied/);
  await assert.rejects(db.query('select mf_private.team_profile_json($1)', [removed]), /permission denied/);
}
await asAuth(production);
await assert.rejects(list(), /Sem acesso/);
await asAuth(manager);
assert.equal((await list()).some(member => member.id === removed || member.id === adminTwo), false);
console.log('PASS removal/team: archived membership hidden and denied, self/last-admin preservation, explicit frozen restoration, no resurrection by old/completed/stale tickets, inactive preservation, service-only ACLs');
await db.close();
