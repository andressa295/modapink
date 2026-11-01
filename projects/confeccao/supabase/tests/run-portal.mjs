// PostgreSQL authorization tests. Storage HTTP/header forwarding must also be tested against Supabase.
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const db = new PGlite();
process.on('uncaughtException', error => {
  console.error(JSON.stringify({ message: error.message, code: error.code, detail: error.detail, where: error.where }));
  process.exit(1);
});
await db.exec(`
  create role anon; create role authenticated; create schema auth; create schema storage;
  create table auth.users(id uuid primary key,email text unique);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth,storage to authenticated,anon;
  grant execute on function auth.uid() to authenticated,anon;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets,name text unique,owner_id text);
  alter table storage.objects enable row level security;
  grant select,insert,update,delete on storage.objects to authenticated;
  create function storage.allow_only_operation(op text) returns boolean language sql stable as $$
    select regexp_replace(coalesce(current_setting('storage.operation',true),''),'^storage\\.','')=regexp_replace(op,'^storage\\.','')
  $$;
`);
await db.exec(await readFile(new URL('../schema.sql', import.meta.url), 'utf8'));
await db.exec(await readFile(new URL('../partner-portal.sql', import.meta.url), 'utf8'));
const admin = '11111111-1111-4111-8111-111111111111';
const prod = '22222222-2222-4222-8222-222222222222';
const unknown = '33333333-3333-4333-8333-333333333333';
await db.query(`insert into auth.users values($1,'admin@example.test'),($2,'production@example.test'),($3,'unknown@example.test')`, [admin, prod, unknown]);
await db.query(`insert into public.profiles(id,full_name,role) values($1,'Admin Test','admin'),($2,'Production Test','producao')`, [admin, prod]);
async function asAuth(id) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.headers','{}',false),set_config('storage.operation','',false)", [id]);
  await db.exec('set role authenticated');
}
async function asAnon(token, op = 'storage.object.get_authenticated') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub','',false),set_config('request.headers',$1,false),set_config('storage.operation',$2,false)", [JSON.stringify(token ? { 'x-confeccao-portal': token } : {}), op]);
  await db.exec('set role anon');
}
async function scalar(sql, params = []) { return (await db.query(sql, params)).rows[0].value; }
async function owner() { return scalar('select public.mf_portal_owner_state() value'); }
async function manage(type, payload) { return scalar('select public.mf_portal_manage($1::jsonb) value', [JSON.stringify({ type, payload })]); }
async function guest(token) { return scalar('select public.mf_portal_get($1) value', [token]); }
async function submit(token, data, request = crypto.randomUUID()) {
  return scalar('select public.mf_portal_submit($1,$2::uuid,$3::jsonb) value', [token, request, JSON.stringify(data)]);
}
async function prepare(token, extension = 'webp') { return scalar('select public.mf_portal_prepare_upload($1,$2) value', [token, extension]); }
async function release(token, path) { return scalar('select public.mf_portal_release_upload($1,$2) value', [token, path]); }
async function insertObject(path, operation = 'storage.object.upload') {
  const before = await scalar("select current_setting('storage.operation',true) value");
  await db.query("select set_config('storage.operation',$1,false)", [operation]);
  try { return await db.query("insert into storage.objects(bucket_id,name) values('confeccao-images',$1)", [path]); }
  finally { await db.query("select set_config('storage.operation',$1,false)", [before]); }
}
async function readObject(path) { return scalar("select count(*)::integer value from storage.objects where name=$1", [path]); }
async function core(type, payload) {
  const state = await scalar('select public.mf_get_state() value');
  return scalar('select public.mf_apply_command($1::jsonb,$2::uuid) value', [JSON.stringify({ type, payload, expectedRevision: state.revision }), crypto.randomUUID()]);
}

await asAuth(admin);
assert.deepEqual((await owner()).partners, []);
let main = await core('create_material', { name: 'Synthetic fabric', category: 'Tecido', color: 'Pink', hex: '#e70289', lot: 'TEST', supplier: 'SUPPLIER-SECRET', quantity: 100, minimum: 1, unit: 'kg', price: 987.65 });
const materialId = main.state.materials[0].id;
const modelPhoto = `models/${crypto.randomUUID()}.webp`;
const unassignedModelPhoto = `models/${crypto.randomUUID()}.webp`;
await insertObject(modelPhoto);
await insertObject(unassignedModelPhoto);
await core('create_model', { name: 'Unassigned model', reference: 'PORTAL-UNASSIGNED', materialId, consumption: .1, sizes: ['P'], notionsCost: 0, sewingCost: 0, finishingCost: 0, notes: '', image: unassignedModelPhoto });
main = await core('create_model', { name: 'Test garment', reference: 'PORTAL-TEST', materialId, consumption: .1, sizes: ['P', 'M'], notionsCost: 123.45, sewingCost: 456.78, finishingCost: 90.12, notes: 'INTERNAL-SECRET', image: modelPhoto });
const modelId = main.state.models[0].id;
for (let n = 0; n < 3; n++) main = await core('create_order', { modelId, materialId, variants: [{ size: 'P', quantity: 10 }, { size: 'M', quantity: 10 }], due: '2026-12-15', team: 'Internal team', priority: 'Normal' });
let portal = await manage('save_partner', { name: 'Partner A Test', active: true });
const partnerA = portal.partners[0].id;
portal = await manage('save_partner', { name: 'Partner B Test', contact: 'Synthetic test contact', active: true });
const partnerB = portal.partners.find(p => p.id !== partnerA).id;
const [orderA, orderB, orderUnassigned] = portal.orders;
await manage('assign_order', { orderId: orderA.id, partnerId: partnerA });
await manage('assign_order', { orderId: orderB.id, partnerId: partnerB });
const linkA = (await manage('create_link', { partnerId: partnerA })).createdLink;
const linkB = (await manage('create_link', { partnerId: partnerB })).createdLink;
assert.match(linkA.token, /^[0-9a-f]{64}$/);
assert.equal(Object.hasOwn((await owner()), 'createdLink'), false);
assert.equal(JSON.stringify((await owner()).links).includes(linkA.token), false);
await db.exec('reset role');
assert.equal((await db.query('select octet_length(token_hash) bytes from mf_private.portal_links')).rows.every(r => r.bytes === 32), true);

await asAnon();
await assert.rejects(guest(null), /Link inválido/);
await assert.rejects(guest('a'.repeat(64)), /Link inválido/);
await assert.rejects(owner(), /permission denied/);
await assert.rejects(db.query('select * from mf_private.portal_links'), /permission denied/);
await assert.rejects(db.query('select * from mf_private.partner_updates'), /permission denied/);
assert.equal(await readObject(modelPhoto), 0);
await asAnon(linkA.token);
const guestA = await guest(linkA.token);
assert.equal(guestA.orders.length, 1);
assert.equal(guestA.orders[0].id, orderA.id);
assert.equal(guestA.orders.some(o => o.id === orderB.id || o.id === orderUnassigned.id), false);
for (const secret of ['SUPPLIER-SECRET', 'INTERNAL-SECRET', 'materialPrice', 'notionsCost', 'sewingCost', 'finishingCost', 'consumption', 'supplier', 'token_hash', 'contact']) assert.equal(JSON.stringify(guestA).includes(secret), false, secret);
assert.equal(await readObject(modelPhoto), 1);
assert.equal(await readObject(unassignedModelPhoto), 0);
for (const op of ['storage.object.list', 'storage.object.list_v2', 'storage.object.sign', 'storage.object.sign_many', '', 'storage.object.get_public']) {
  await asAnon(linkA.token, op);
  assert.equal(await readObject(modelPhoto), 0, op);
}
await asAnon(linkA.token);
await assert.rejects(insertObject(`portal/${partnerA}/${crypto.randomUUID()}.webp`), /row-level security/);
await assert.rejects(prepare(linkA.token, 'svg'), /Formato/);
const { path: photoA } = await prepare(linkA.token);
assert.match(photoA, new RegExp(`^portal/${partnerA}/`));
await asAnon();
await assert.rejects(insertObject(photoA), /row-level security/);
await db.query("select set_config('request.headers','malformed-json',false)");
assert.equal(await readObject(modelPhoto), 0);
await assert.rejects(insertObject(photoA), /row-level security/);
await asAnon(linkA.token);
for (const op of ['storage.object.sign_upload_url', 'storage.object.upload_signed', 'storage.object.upload_resumable', '']) {
  await assert.rejects(insertObject(photoA, op), /row-level security/);
}
await insertObject(photoA);
await assert.rejects(insertObject(photoA), /duplicate key/);
await asAnon(linkB.token);
await assert.rejects(release(linkB.token, photoA), /órfão/);
assert.equal(await readObject(photoA), 0);
await assert.rejects(insertObject(photoA), /row-level security/);
const payload = { orderId: orderA.id, stage: 'Costura', produced: 12, checked: 10, defects: 2, reporter: 'Partner reporter', notes: 'Synthetic update', defectDescription: 'Synthetic seam issue', photos: [photoA] };
await assert.rejects(submit(linkB.token, payload), /Ordem não disponível/);
await asAnon(linkA.token);
for (const changed of [
  { produced: -1 }, { produced: 1.5 }, { produced: '12' }, { produced: 21 },
  { checked: 13 }, { defects: 11 }, { defectDescription: '' }, { reporter: '' },
  { stage: 'Concluído' }, { notes: 'x'.repeat(4001) }, { extra: 'not allowed' },
  { stage: 'Pronto para retirada' }, { stage: 'Pronto para retirada', produced: 0, checked: 0, defects: 0 },
  { stage: 'Pronto para retirada', produced: 20, checked: 19 },
  { photos: [modelPhoto] }, { photos: [photoA, photoA] }, { photos: Array(7).fill(photoA) },
  { photos: [null] },
]) await assert.rejects(submit(linkA.token, { ...payload, ...changed }));
const request = crypto.randomUUID();
const accepted = await submit(linkA.token, payload, request);
assert.equal(accepted.replayed, false);
assert.equal(accepted.update.defects, 2);
assert.equal((await submit(linkA.token, payload, request)).replayed, true);
await assert.rejects(submit(linkA.token, { ...payload, produced: 13 }, request), /Identificador/);
await assert.rejects(release(linkA.token, photoA), /órfão/);
await assert.rejects(submit(linkA.token, payload), /Imagem não disponível/);
const ready = await submit(linkA.token, { ...payload, stage: 'Pronto para retirada', produced: 20, checked: 20, photos: [] });
assert.equal(ready.update.stage, 'Pronto para retirada');
assert.equal(ready.update.produced, orderA.quantity);
assert.equal(ready.update.checked, orderA.quantity);
assert.equal(ready.update.defects, 2);
assert.deepEqual(ready.update.photos, []);
assert.equal(await readObject(photoA), 1);
await asAnon(linkA.token, 'storage.object.delete');
assert.equal((await db.query('delete from storage.objects where name=$1 returning name', [photoA])).rows.length, 0);
const { path: orphan } = await prepare(linkA.token, 'png');
await insertObject(orphan);
assert.deepEqual(await release(linkA.token, orphan), { released: true });
await assert.rejects(submit(linkA.token, { ...payload, photos: [orphan] }), /Imagem não disponível/);
await asAnon(linkA.token, 'storage.object.delete_many');
assert.equal((await db.query('delete from storage.objects where name=$1 returning name', [orphan])).rows.length, 1);
await assert.rejects(insertObject(orphan), /row-level security/);

await asAuth(admin);
const ownerAfter = await owner();
assert.equal(ownerAfter.updates.length, 2);
assert.equal(ownerAfter.updates[0].orderId, orderA.id);
main = await scalar('select public.mf_get_state() value');
assert.equal(main.state.materials[0].quantity, 100);
assert.equal(main.state.orders.every(o => o.stage === 'Planejado' && o.approved === 0 && o.rework === 0 && o.lost === 0), true);
assert.equal(main.state.inspections.length, 0);
assert.equal(await readObject(photoA), 1);
await asAuth(prod);
assert.equal((await owner()).partners.length, 2);
for (const [type, data] of [['save_partner', { name: 'Forbidden', active: true }], ['assign_order', { orderId: orderA.id, partnerId: partnerB }], ['create_link', { partnerId: partnerA }], ['revoke_link', { partnerId: partnerA }]]) await assert.rejects(manage(type, data), /Apenas administração/);
await asAuth(unknown);
await assert.rejects(owner(), /não está ativo/);

await asAuth(admin);
await manage('assign_order', { orderId: orderA.id, partnerId: partnerB });
await asAnon(linkA.token);
assert.equal((await guest(linkA.token)).orders.length, 0);
assert.equal((await guest(linkA.token)).updates.length, 0);
assert.equal(await readObject(photoA), 0);
await asAnon(linkB.token);
assert.equal((await guest(linkB.token)).orders.length, 2);
assert.equal((await guest(linkB.token)).updates.length, 0);
assert.equal(await readObject(photoA), 0);
await asAuth(admin);
await manage('assign_order', { orderId: orderA.id, partnerId: partnerA });
const newA = (await manage('create_link', { partnerId: partnerA })).createdLink;
await asAnon(linkA.token);
await assert.rejects(guest(linkA.token), /Link inválido/);
assert.equal(await readObject(modelPhoto), 0);
await asAnon(newA.token);
assert.equal((await guest(newA.token)).updates.length, 2);
assert.equal(await readObject(photoA), 1);
await assert.rejects(release(newA.token, photoA), /órfão/);

await db.exec('reset role');
await db.query("update mf_private.portal_links set created_at=now()-interval '31 days',expires_at=now()-interval '1 day' where id=$1", [linkB.id]);
await asAnon(linkB.token);
await assert.rejects(guest(linkB.token), /Link inválido/);
await assert.rejects(prepare(linkB.token), /Link inválido/);
await assert.rejects(submit(linkB.token, { ...payload, orderId: orderB.id, photos: [] }), /Link inválido/);
assert.equal(await readObject(modelPhoto), 0);

await asAuth(admin);
await manage('revoke_link', { partnerId: partnerA });
await asAnon(newA.token);
await assert.rejects(guest(newA.token), /Link inválido/);
await assert.rejects(submit(newA.token, { ...payload, photos: [] }), /Link inválido/);
await asAuth(admin);
const finalA = (await manage('create_link', { partnerId: partnerA })).createdLink;
await db.exec('reset role');
await db.query("update mf_private.orders set stage='Concluído',approved=quantity,actual_consumption=2,reserved=0 where id=$1", [orderA.id]);
await asAnon(finalA.token);
assert.equal((await guest(finalA.token)).orders[0].stage, 'Concluído');
await assert.rejects(submit(finalA.token, { ...payload, photos: [] }), /concluída/);
await assert.rejects(prepare(finalA.token), /Não há ordem aberta/);
await asAuth(admin);
await manage('save_partner', { id: partnerA, name: 'Partner A Test', active: false });
await asAnon(finalA.token);
await assert.rejects(guest(finalA.token), /Link inválido/);
await db.exec('reset role');
await assert.rejects(db.query("update mf_private.partner_updates set produced=0"), /imutáveis/);
assert.equal((await db.query("select public from storage.buckets where id='confeccao-images'")).rows[0].public, false);
assert.equal((await db.query("select count(*)::integer n from mf_private.partner_updates")).rows[0].n, 2);
const events = (await db.query('select title,detail from mf_private.events')).rows;
assert.equal(events.some(event => ['save_partner','assign_order','create_link','revoke_link'].includes(event.detail)), false);
assert.equal(events.some(event => event.title === 'Confecção cadastrada' && event.detail.includes('Partner A Test')), true);
assert.equal(events.some(event => event.title === 'Produção atribuída à confecção' && event.detail.includes(orderA.code)), true);
assert.equal(events.some(event => event.detail.includes(linkA.token) || event.detail.includes(linkB.token)), false);
// Bounded history does not discard each order's latest cumulative snapshot.
await db.query(`insert into mf_private.partner_updates(request_id,partner_id,link_id,order_id,stage,produced,checked,defects,reporter,request_payload,created_at)
  select gen_random_uuid(),$1,$2,$3,'Recebido',1,0,0,'Synthetic history','{}'::jsonb,now()-interval '2 hours'-(n*interval '1 second')
  from generate_series(1,205) n`, [partnerB, linkB.id, orderB.id]);
await asAuth(admin);
const history = await owner();
assert.equal(history.historyLimit, 200);
assert.equal(history.updates.length, 200);
assert.equal(history.latestUpdates.length, 2);
// Independent partner with an open order for rate and upload-reservation bounds.
await manage('save_partner', { id: partnerB, name: 'Partner B Test', active: true });
const rateLink = (await manage('create_link', { partnerId: partnerB })).createdLink;
await asAnon(rateLink.token);
const ratePayload = { orderId: orderB.id, stage: 'Recebido', produced: 1, checked: 0, defects: 0, reporter: 'Synthetic rate check' };
const rateRequest = crypto.randomUUID();
await submit(rateLink.token, ratePayload, rateRequest);
for (let n = 1; n < 120; n++) await submit(rateLink.token, ratePayload);
await assert.rejects(submit(rateLink.token, ratePayload), /Limite de atualizações/);
assert.equal((await submit(rateLink.token, ratePayload, rateRequest)).replayed, true);
for (let n = 0; n < 24; n++) await prepare(rateLink.token);
await assert.rejects(prepare(rateLink.token), /Limite de imagens/);
const boundedGuest = await guest(rateLink.token);
assert.equal(boundedGuest.updates.length, 200);
assert.equal(boundedGuest.latestUpdates.length, 1);
console.log('PASS portal: partner isolation, no capability/no profile, cost redaction, roles, immutable/idempotent updates, cumulative counts, closed orders, hash-only tokens, rotation/revocation/expiry, reserved photo scope, no guest signing/listing, orphan release/attachment exclusion, official stock/quality unchanged');
await db.close();
