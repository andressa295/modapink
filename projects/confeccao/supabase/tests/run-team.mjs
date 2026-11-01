// Synthetic PostgreSQL tests only: no Auth API or email provider is called.
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PGlite();
process.on('uncaughtException', error => {
  console.error(JSON.stringify({ message: error.message, code: error.code, detail: error.detail, where: error.where }));
  process.exit(1);
});
await db.exec(`create role anon; create role authenticated; create role service_role;
  create schema auth; create schema storage;
  create table auth.users(id uuid primary key,email text unique,email_confirmed_at timestamptz,encrypted_password text,invited_at timestamptz,last_sign_in_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth,storage to authenticated,anon;
  grant execute on function auth.uid() to authenticated,anon;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets,name text,owner_id text);
  alter table storage.objects enable row level security;
  grant select,insert,update,delete on storage.objects to authenticated;
`);
await db.exec(await readFile(new URL('../schema.sql', import.meta.url), 'utf8'));
await db.exec(await readFile(new URL('../team-invites.sql', import.meta.url), 'utf8'));
const admin = '11111111-1111-4111-8111-111111111111';
const adminTwo = '22222222-2222-4222-8222-222222222222';
const manager = '33333333-3333-4333-8333-333333333333';
const production = '44444444-4444-4444-8444-444444444444';
const unapproved = '55555555-5555-4555-8555-555555555555';
const pending = '66666666-6666-4666-8666-666666666666';
const inactive = '77777777-7777-4777-8777-777777777777';
await db.query(`insert into auth.users(id,email,email_confirmed_at,encrypted_password) values
  ($1,'admin@example.test',now(),'DO-NOT-LEAK-HASH'),($2,'other-admin@example.test',now(),'DO-NOT-LEAK-HASH'),
  ($3,'manager@example.test',now(),'DO-NOT-LEAK-HASH'),($4,'production@example.test',now(),'DO-NOT-LEAK-HASH'),
  ($5,'existing-auth@example.test',now(),'DO-NOT-LEAK-HASH'),($6,'pending@example.test',null,''),
  ($7,'inactive@example.test',now(),'DO-NOT-LEAK-HASH')`, [admin, adminTwo, manager, production, unapproved, pending, inactive]);
await db.query(`insert into public.profiles(id,full_name,role,active) values
  ($1,'Admin Test','admin',true),($2,'Other Admin Test','admin',true),($3,'Manager Test','gestao',true),
  ($4,'Production Test','producao',true),($5,'Pending Test','qualidade',true),($6,'Inactive Test','admin',false)`, [admin, adminTwo, manager, production, pending, inactive]);
async function asAuth(id) {
  await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); await db.exec('set role authenticated');
}
async function asService() {
  await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub','',false)"); await db.exec('set role service_role');
}
async function scalar(sql, args = []) { return (await db.query(sql, args)).rows[0].value; }
async function list() { return scalar('select public.mf_team_list() value'); }
async function prepare({ actor = admin, request = crypto.randomUUID(), action = 'invite', email = null, name = null, role = null, userId = null }) {
  return scalar('select public.mf_team_prepare($1::uuid,$2::uuid,$3,$4,$5,$6,$7::uuid) value', [actor, request, action, email, name, role, userId]);
}
async function finish(actor, request, id) { return scalar('select public.mf_team_finish($1::uuid,$2::uuid,$3::uuid) value', [actor, request, id]); }
async function fail(actor, request, reason) { return scalar('select public.mf_team_fail($1::uuid,$2::uuid,$3) value', [actor, request, reason]); }
async function syntheticAuth(email, { confirmed = false, password = false, id = crypto.randomUUID() } = {}) {
  await db.exec('reset role');
  await db.query('insert into auth.users(id,email,email_confirmed_at,encrypted_password,invited_at) values($1,$2,case when $3 then now() else null end,$4,now())', [id, email, confirmed, password ? 'DO-NOT-LEAK-HASH' : '']);
  await asService(); return id;
}
async function ageRequests(email) {
  await db.exec('reset role'); await db.query("update mf_private.team_invite_requests set created_at=now()-interval '2 hours' where email=$1", [email]); await asService();
}

await asAuth(admin);
let members = await list();
assert.equal(members.length, 6);
assert.equal(members.find(m => m.id === pending).status, 'invited');
assert.equal(members.find(m => m.id === inactive).status, 'inactive');
assert.equal(members.find(m => m.id === admin).status, 'active');
assert.equal(members.some(m => m.id === unapproved), false);
assert.equal(JSON.stringify(members).includes('DO-NOT-LEAK-HASH'), false);
for (const roleId of [production, unapproved, inactive]) { await asAuth(roleId); await assert.rejects(list(), /Sem acesso/); }
await asAuth(manager); assert.equal((await list()).length, 6);
for (const roleId of [admin, manager, production]) {
  await asAuth(roleId);
  await assert.rejects(prepare({ email: 'forbidden@example.test', name: 'Forbidden', role: 'admin' }), /permission denied/);
  await assert.rejects(finish(admin, crypto.randomUUID(), production), /permission denied/);
  await assert.rejects(fail(admin, crypto.randomUUID(), 'send_failed'), /permission denied/);
  await assert.rejects(db.query('select mf_private.team_profile_json($1)', [unapproved]), /permission denied/);
}
await db.exec('reset role; set role anon');
await assert.rejects(list(), /permission denied/);
await assert.rejects(prepare({ email: 'forbidden@example.test', name: 'Forbidden', role: 'admin' }), /permission denied/);
await asService();
await assert.rejects(db.query('select * from mf_private.team_invite_requests'), /permission denied/);
await assert.rejects(prepare({ actor: production, email: 'forbidden@example.test', name: 'Forbidden', role: 'admin' }), /administrador ativo/);
await assert.rejects(prepare({ actor: inactive, email: 'forbidden@example.test', name: 'Forbidden', role: 'admin' }), /administrador ativo/);
for (const invalid of [
  { email: 'broken' }, { email: 'a@b.test\nBcc:evil@example.test' }, { name: '' }, { name: 'x'.repeat(101) },
  { role: 'owner' }, { action: 'delete_user' }, { userId: production },
]) await assert.rejects(prepare({ email: 'valid@example.test', name: 'Valid', role: 'producao', ...invalid }));

const request = crypto.randomUUID();
const input = { request, email: ' NEW-MEMBER@EXAMPLE.TEST ', name: '  New Member Test  ', role: 'producao' };
let ticket = await prepare(input);
assert.equal(ticket.status, 'processing'); assert.equal(ticket.canSend, true); assert.equal(ticket.replayed, false);
assert.deepEqual(ticket.target, { id: null, email: 'new-member@example.test', fullName: 'New Member Test', role: 'producao', active: false, emailConfirmed: false, passwordSet: false, hasProfile: false });
assert.equal((await prepare(input)).canSend, false);
await assert.rejects(prepare({ ...input, role: 'admin' }), /Identificador/);
await assert.rejects(prepare({ ...input, actor: adminTwo }), /Identificador/);
const newId = await syntheticAuth('new-member@example.test');
ticket = await prepare(input);
assert.equal(ticket.target.id, newId); assert.equal(ticket.target.hasProfile, false); assert.equal(ticket.canSend, false);
await assert.rejects(finish(admin, request, production), /corresponde/);
const completed = await finish(admin, request, newId);
assert.equal(completed.status, 'completed'); assert.equal(completed.profile.role, 'producao');
assert.equal(completed.profile.active, true); assert.equal(completed.profile.status, 'invited');
assert.equal(completed.profile.email_confirmed, false); assert.equal(completed.profile.password_set, false);
assert.deepEqual(await finish(admin, request, newId), completed);
assert.equal((await fail(admin, request, 'finalization_failed')).status, 'completed');
assert.equal((await prepare(input)).status, 'completed');
await assert.rejects(prepare({ email: 'new-member@example.test', name: 'Promote by invitation', role: 'admin' }), /já tem perfil/);
await assert.rejects(prepare({ email: 'inactive@example.test', name: 'Reactivate by invitation', role: 'producao' }), /já tem perfil/);

// An existing Auth account without application membership is explicitly invited by the administrator.
const existingRequest = crypto.randomUUID();
const existing = await prepare({ request: existingRequest, email: 'existing-auth@example.test', name: 'Existing Auth Test', role: 'qualidade' });
assert.equal(existing.target.id, unapproved); assert.equal(existing.target.passwordSet, true); assert.equal(existing.target.emailConfirmed, true); assert.equal(existing.target.hasProfile, false);
assert.equal((await finish(admin, existingRequest, unapproved)).profile.role, 'qualidade');

// A profile created by another authorized operation between prepare/finish is preserved exactly.
const raceRequest = crypto.randomUUID();
await prepare({ request: raceRequest, email: 'race@example.test', name: 'Original Requested Name', role: 'admin' });
const raceId = await syntheticAuth('race@example.test');
await db.exec('reset role');
await db.query("insert into public.profiles(id,full_name,role,active) values($1,'Already Provisioned','qualidade',false)", [raceId]);
await asService();
const raceResult = await finish(admin, raceRequest, raceId);
assert.equal(raceResult.profile.role, 'qualidade'); assert.equal(raceResult.profile.active, false); assert.equal(raceResult.profile.full_name, 'Already Provisioned');

// Admin authority is checked again at finish, even after Auth created an invited identity.
const revokeRequest = crypto.randomUUID();
await prepare({ request: revokeRequest, email: 'revoked-actor@example.test', name: 'Revoked Actor Target', role: 'gestao' });
const revokedTarget = await syntheticAuth('revoked-actor@example.test');
await db.exec('reset role'); await db.query('update public.profiles set active=false where id=$1', [admin]); await asService();
await assert.rejects(finish(admin, revokeRequest, revokedTarget), /administrador ativo/);
await assert.rejects(prepare({ request: revokeRequest, email: 'revoked-actor@example.test', name: 'Revoked Actor Target', role: 'gestao' }), /administrador ativo/);
await db.exec('reset role'); assert.equal(await scalar('select count(*)::integer value from public.profiles where id=$1', [revokedTarget]), 0);
await db.query('update public.profiles set active=true where id=$1', [admin]); await asService();

const resendRequest = crypto.randomUUID();
const resendTicket = await prepare({ request: resendRequest, action: 'resend', userId: pending });
assert.equal(resendTicket.target.email, 'pending@example.test'); assert.equal(resendTicket.target.role, 'qualidade');
await assert.rejects(prepare({ action: 'resend', userId: pending }), error => error.code === 'P0001' && error.detail === 'team_cooldown');
assert.equal((await prepare({ request: resendRequest, action: 'resend', userId: pending })).canSend, false);
assert.equal((await finish(admin, resendRequest, pending)).profile.role, 'qualidade');
await assert.rejects(prepare({ action: 'recovery', userId: pending }), /primeiro acesso/);
await assert.rejects(prepare({ action: 'resend', userId: production }), /já definiu senha/);
await assert.rejects(prepare({ action: 'recovery', userId: inactive }), /inativo/);
await db.exec('reset role'); await db.query('update auth.users set email_confirmed_at=now() where id=$1', [pending]);
await asAuth(admin); assert.equal((await list()).find(m => m.id === pending).status, 'awaiting_password');
await db.exec('reset role'); await db.query("update auth.users set encrypted_password='DO-NOT-LEAK-HASH' where id=$1", [pending]); await asService();
await ageRequests('pending@example.test');
const recoveryRequest = crypto.randomUUID();
assert.equal((await prepare({ request: recoveryRequest, action: 'recovery', userId: pending })).canSend, true);
assert.equal((await finish(admin, recoveryRequest, pending)).profile.status, 'active');

// Unknown delivery never allows a second automatic send of the same request.
const uncertainRequest = crypto.randomUUID();
const uncertainInput = { request: uncertainRequest, email: 'uncertain@example.test', name: 'Uncertain Test', role: 'producao' };
await prepare(uncertainInput);
assert.equal((await fail(admin, uncertainRequest, 'send_uncertain')).status, 'uncertain');
assert.equal((await prepare(uncertainInput)).canSend, false);
assert.equal((await fail(admin, uncertainRequest, 'finalization_failed')).status, 'uncertain');
const uncertainId = await syntheticAuth('uncertain@example.test');
assert.equal((await finish(admin, uncertainRequest, uncertainId)).profile.role, 'producao');
const failedRequest = crypto.randomUUID();
const failedInput = { request: failedRequest, email: 'failed@example.test', name: 'Failed Test', role: 'producao' };
await prepare(failedInput); assert.equal((await fail(admin, failedRequest, 'send_failed')).status, 'failed');
assert.equal((await prepare(failedInput)).canSend, false);
const failedId = await syntheticAuth('failed@example.test');
await assert.rejects(finish(admin, failedRequest, failedId), /não pode ser finalizada/);
await assert.rejects(fail(admin, failedRequest, 'raw provider secret'), /Motivo/);

await asAuth(admin);
await db.query('select public.mf_set_profile($1,$2,$3,$4)', [adminTwo, 'Other Admin Test', 'admin', false]);
await assert.rejects(db.query('select public.mf_set_profile($1,$2,$3,$4)', [admin, 'Admin Test', 'producao', true]), /administrador ativo/);
await asAuth(adminTwo);
await assert.rejects(db.query('select public.mf_set_profile($1,$2,$3,$4)', [production, 'Production Test', 'admin', true]), /administrador/);

// Quotas reserve attempts before any provider call; request replay does not consume another slot.
await db.exec('reset role'); await db.exec("update mf_private.team_invite_requests set created_at=now()-interval '2 hours'"); await asService();
let firstRateInput;
for (let n = 0; n < 20; n++) {
  const data = { request: crypto.randomUUID(), email: `rate-${n}@example.test`, name: `Rate Test ${n}`, role: 'producao' };
  if (n === 0) firstRateInput = data;
  assert.equal((await prepare(data)).canSend, true);
}
await assert.rejects(prepare({ email: 'rate-over@example.test', name: 'Over rate', role: 'producao' }), error => error.code === 'P0001' && error.detail === 'team_rate_limit');
assert.equal((await prepare(firstRateInput)).canSend, false);
await db.exec('reset role');
const requests = await db.query('select action,status,failure_reason,request_input from mf_private.team_invite_requests');
assert.equal(JSON.stringify(requests.rows).includes('DO-NOT-LEAK-HASH'), false);
assert.equal((await db.query("select count(*)::integer n from public.profiles where role='admin' and active")).rows[0].n, 1);
console.log('PASS team: service-only provisioning, authorized email/status list, frozen intent, no duplicate send authorization, email/identity binding, insert-only profiles, inactive/admin revocation, resend/recovery eligibility, no approval step, failure ambiguity, cooldown/rate limits, last-admin preservation');
await db.close();
