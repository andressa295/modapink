// Synthetic PostgreSQL + RLS coverage; no hosted data, Auth API, files or emails are changed.
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PGlite();
process.on('uncaughtException', error => { console.error(JSON.stringify({ message: error.message, code: error.code, detail: error.detail, where: error.where })); process.exit(1); });
await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;
  create table auth.users(id uuid primary key,email text unique,email_confirmed_at timestamptz,encrypted_password text,invited_at timestamptz,last_sign_in_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth,storage to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets,name text unique,owner_id text);
  alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to authenticated;
  create function storage.allow_only_operation(op text) returns boolean language sql stable as $$select current_setting('storage.operation',true)=op$$;
`);
for (const migration of ['schema.sql', 'partner-portal.sql', 'portal-image-fix.sql', 'team-invites.sql', 'record-removal.sql']) await db.exec(await readFile(new URL(`../${migration}`, import.meta.url), 'utf8'));
const admin='11111111-1111-4111-8111-111111111111', manager='22222222-2222-4222-8222-222222222222', production='33333333-3333-4333-8333-333333333333', quality='44444444-4444-4444-8444-444444444444';
await db.query(`insert into auth.users(id,email) values($1,'admin@example.test'),($2,'manager@example.test'),($3,'production@example.test'),($4,'quality@example.test')`,[admin,manager,production,quality]);
await db.query(`insert into public.profiles(id,full_name,role) values($1,'Admin Test','admin'),($2,'Manager Test','gestao'),($3,'Production Test','producao'),($4,'Quality Test','qualidade')`,[admin,manager,production,quality]);
async function asAuth(id=admin){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.headers','{}',false),set_config('storage.operation','',false)",[id]);await db.exec('set role authenticated');}
async function asAnon(token,op='storage.object.get_authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false),set_config('request.headers',$1,false),set_config('storage.operation',$2,false)",[JSON.stringify(token?{'x-confeccao-portal':token}:{}),op]);await db.exec('set role anon');}
async function scalar(sql,args=[]){return(await db.query(sql,args)).rows[0].value;}
async function state(){return scalar('select public.mf_get_state() value');}
async function core(type,payload){const s=await state();return scalar('select public.mf_apply_command($1::jsonb,$2::uuid) value',[JSON.stringify({type,payload,expectedRevision:s.revision}),crypto.randomUUID()]);}
async function remove(entity,id){return scalar('select public.mf_remove_record($1,$2) value',[entity,id]);}
async function owner(){return scalar('select public.mf_portal_owner_state() value');}
async function manage(type,payload){return scalar('select public.mf_portal_manage($1::jsonb) value',[JSON.stringify({type,payload})]);}
async function guest(token){return scalar('select public.mf_portal_get($1) value',[token]);}
async function insertObject(path){const op=await scalar("select current_setting('storage.operation',true) value");await db.query("select set_config('storage.operation','storage.object.upload',false)");try{return await db.query("insert into storage.objects(bucket_id,name) values('confeccao-images',$1)",[path]);}finally{await db.query("select set_config('storage.operation',$1,false)",[op]);}}
async function visibleObject(path){return scalar('select count(*)::integer value from storage.objects where name=$1',[path]);}

await asAuth();
const materialInput={name:'Synthetic fabric',category:'Tecido',color:'Pink',hex:'#e70289',lot:'TEST-REMOVAL',supplier:'Synthetic supplier',quantity:100,minimum:2,unit:'kg',price:40};
let s=await core('create_material',materialInput);const materialId=s.state.materials[0].id;
s=await core('create_material',{...materialInput,name:'Alternative fabric',lot:'ALT'});const altMaterialId=s.state.materials.find(m=>m.name==='Alternative fabric').id;
const photo=`models/${crypto.randomUUID()}.webp`;await insertObject(photo);
const modelInput={name:'Synthetic garment',reference:'TEST-REMOVE-MODEL',materialId,consumption:.1,sizes:['U'],notionsCost:1,sewingCost:2,finishingCost:1,notes:'',image:photo};
s=await core('create_model',modelInput);const modelId=s.state.models[0].id;
s=await core('create_model',{...modelInput,name:'Other active model',reference:'TEST-OTHER-MODEL'});const otherModelId=s.state.models.find(m=>m.reference==='TEST-OTHER-MODEL').id;
const codes=[];
for(const quantity of [10,10,10,5]){s=await core('create_order',{modelId,materialId,variants:[{size:'U',quantity}],due:'2026-12-20',team:'Synthetic factory',priority:'Normal'});codes.push(s.state.orders[0].id);}
let p=await manage('save_partner',{name:'Synthetic sewing partner',active:true});const partnerId=p.partners[0].id;
for(const code of codes){const order=p.orders.find(o=>o.code===code);p=await manage('assign_order',{orderId:order.id,partnerId});}
const linkedOrders=p.orders;const orderA=linkedOrders.find(o=>o.code===codes[0]);
const link=(await manage('create_link',{partnerId})).createdLink;
await asAnon(link.token);
assert.equal(await visibleObject(photo),1);
await asAnon(link.token,'storage.object.get_authenticated_info');assert.equal(await visibleObject(photo),1);
for(const operation of ['storage.object.sign','storage.object.sign_many','storage.object.list','storage.object.list_v2']){await asAnon(link.token,operation);assert.equal(await visibleObject(photo),0);}
await asAnon(link.token);
const {path:partnerPhoto}=await scalar('select public.mf_portal_prepare_upload($1,$2) value',[link.token,'webp']);await insertObject(partnerPhoto);
const portalInput={orderId:orderA.id,stage:'Costura',produced:5,checked:4,defects:1,reporter:'Synthetic reporter',defectDescription:'Synthetic seam issue',photos:[partnerPhoto]};
const reportRequest=crypto.randomUUID();await scalar('select public.mf_portal_submit($1,$2::uuid,$3::jsonb) value',[link.token,reportRequest,JSON.stringify(portalInput)]);
await asAuth();
await core('advance_order',{orderId:codes[1]});await core('advance_order',{orderId:codes[1],consumption:1.5});
await core('advance_order',{orderId:codes[2]});await core('advance_order',{orderId:codes[2],consumption:1});
await core('advance_order',{orderId:codes[2]});await core('advance_order',{orderId:codes[2]});
await core('inspect_order',{orderId:codes[2],quantity:10,result:'Aprovadas'});await core('advance_order',{orderId:codes[2]});
s=await state();assert.equal(s.state.dailyApprovals.reduce((n,a)=>n+a.quantity,0),10);

// Removing materials/models hides normal lists while dependencies remain available to active orders.
assert.deepEqual(await remove('material',materialId),{entity:'material',id:materialId,removed:true});
s=await state();assert.equal(s.state.materials.find(m=>m.id===materialId).archived,true);
assert.equal(s.state.materials.filter(m=>!m.archived).some(m=>m.id===materialId),false);
await assert.rejects(core('move_material',{id:materialId,amount:1,kind:'Entrada',note:'Should fail'}),/excluído/);
await assert.rejects(core('create_model',{...modelInput,reference:'SHOULD-NOT-CREATE'}),/material ativo/);
await assert.rejects(core('create_order',{modelId,materialId:altMaterialId,variants:[{size:'U',quantity:1}],due:'2026-12-20',team:'Test',priority:'Normal'}),/material ativo/);
// Already assigned work may consume the archived material; no new production may use it.
await core('advance_order',{orderId:codes[3]});await core('advance_order',{orderId:codes[3],consumption:.5});
await remove('model',modelId);s=await state();assert.equal(s.state.models.find(m=>m.id===modelId).archived,true);
await assert.rejects(core('update_model_image',{id:modelId,image:null}),/excluída/);
await asAuth(production);s=await state();assert.equal(s.state.materials.find(m=>m.id===materialId).price,0);assert.equal(s.state.models.find(m=>m.id===modelId).sewingCost,0);
for(const who of [production,quality]){await asAuth(who);for(const [entity,id]of[['material',materialId],['model',modelId],['order',codes[0]],['partner',partnerId],['member',manager]])await assert.rejects(remove(entity,id),/Sem permissão/);}
await asAuth(manager);await assert.rejects(remove('member',production),/Sem permissão/);
await assert.rejects(db.query('select mf_private.pre_remove_get_state()'),/permission denied/);
await assert.rejects(db.query('select mf_private.pre_remove_apply_command($1::jsonb,$2::uuid)',[JSON.stringify({type:'move_material'}),crypto.randomUUID()]),/permission denied/);

await asAuth();s=await state();const beforePhysical=s.state.materials.find(m=>m.id===materialId).quantity;
assert.equal(beforePhysical,97);assert.equal(s.state.materials.find(m=>m.id===materialId).reserved,1);
await remove('order',codes[0]);s=await state();assert.equal(s.state.orders.some(o=>o.id===codes[0]),false);assert.equal(s.state.materials.find(m=>m.id===materialId).quantity,beforePhysical);assert.equal(s.state.materials.find(m=>m.id===materialId).reserved,0);
const afterRevision=s.revision;await remove('order',codes[0]);assert.equal((await state()).revision,afterRevision);
await assert.rejects(core('advance_order',{orderId:codes[0]}),/excluída/);
await asAnon(link.token,'storage.object.get_authenticated_info');assert.equal(await visibleObject(partnerPhoto),0);assert.equal(await visibleObject(photo),1);
const portalAfter=await guest(link.token);assert.equal(portalAfter.orders.some(o=>o.id===orderA.id),false);assert.equal(portalAfter.updates.some(u=>u.orderId===orderA.id),false);assert.equal(portalAfter.latestUpdates.some(u=>u.orderId===orderA.id),false);
await assert.rejects(scalar('select public.mf_portal_submit($1,$2::uuid,$3::jsonb) value',[link.token,reportRequest,JSON.stringify(portalInput)]),/excluída/);
await asAuth();
await remove('order',codes[1]);s=await state();assert.equal(s.state.materials.find(m=>m.id===materialId).quantity,beforePhysical);
await remove('order',codes[2]);s=await state();assert.equal(s.state.dailyApprovals.length,0);assert.equal(s.state.inspections.length,0);
await remove('order',codes[3]);s=await state();assert.equal(s.state.orders.length,0);assert.equal(s.state.models.some(m=>m.id===modelId),false);
assert.equal(s.state.materials.find(m=>m.id===materialId).archived,true); // The other active model still needs its material lookup.
await remove('model',otherModelId);s=await state();assert.equal(s.state.materials.some(m=>m.id===materialId),false);
await asAnon(link.token,'storage.object.get_authenticated_info');assert.equal(await visibleObject(photo),0);
await assert.rejects(scalar('select public.mf_portal_prepare_upload($1,$2) value',[link.token,'webp']),/Não há ordem aberta/);

await asAuth();
await remove('partner',partnerId);p=await owner();assert.equal(p.partners.some(x=>x.id===partnerId),false);assert.equal(p.assignments.length,0);assert.equal(p.links.some(x=>x.partnerId===partnerId),false);assert.equal(p.updates.length,0);
await assert.rejects(manage('save_partner',{id:partnerId,name:'Restore without a new partner',active:true}),/excluída/);
await assert.rejects(manage('create_link',{partnerId}),/excluída/);
await asAnon(link.token);await assert.rejects(guest(link.token),/Link inválido/);await assert.rejects(remove('partner',partnerId),/permission denied/);

// Mistyped registrations can be recreated with the same business identity and fresh IDs.
await asAuth();s=await core('create_material',materialInput);const recreatedMaterial=s.state.materials.find(m=>!m.archived&&m.name===materialInput.name);assert.notEqual(recreatedMaterial.id,materialId);
s=await core('create_model',{...modelInput,materialId:recreatedMaterial.id});const recreatedModel=s.state.models.find(m=>!m.archived&&m.reference===modelInput.reference);assert.notEqual(recreatedModel.id,modelId);
p=await manage('save_partner',{name:'Synthetic sewing partner',active:true});assert.notEqual(p.partners[0].id,partnerId);
await asAuth(manager);await remove('partner',p.partners[0].id); // Management can remove operational entities.
await asAuth();
await assert.rejects(remove('unknown',materialId),/Registro inválido/);
await db.exec('reset role');
const rawOrders=await db.query('select archived_at,reserved,actual_consumption from mf_private.orders');assert.equal(rawOrders.rows.length,4);assert.equal(rawOrders.rows.every(o=>o.archived_at!==null),true);
assert.equal(await scalar("select count(*)::integer value from mf_private.movements where order_id=$1 and kind='Liberação'",[orderA.id]),1);
assert.equal(await scalar("select count(*)::integer value from mf_private.movements where kind='Consumo'"),3);
assert.equal(await scalar('select count(*)::integer value from mf_private.inspections'),1);
assert.equal(await scalar('select count(*)::integer value from mf_private.partner_updates'),1);
assert.equal(await scalar('select count(*)::integer value from mf_private.partner_assignments'),4);
assert.equal(Number(await scalar('select quantity value from mf_private.materials where id=$1',[materialId])),beforePhysical);
assert.equal(await scalar("select public value from storage.buckets where id='confeccao-images'"),false);
console.log('PASS removal: role isolation, idempotent removal, single reservation release, consumed stock/history retained, hidden metrics/portal/photos, archived lookup dependencies, recreation of business keys, private helper ACLs, metadata-info photo policy');
await db.close();
