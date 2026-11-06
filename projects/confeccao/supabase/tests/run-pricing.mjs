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
await db.exec(await readFile(new URL('../migrations/20261101020350_create_pricing_sheets.sql', import.meta.url), 'utf8'));
const admin='11111111-1111-4111-8111-111111111111', manager='22222222-2222-4222-8222-222222222222', production='33333333-3333-4333-8333-333333333333', quality='44444444-4444-4444-8444-444444444444', inactive='55555555-5555-4555-8555-555555555555';
await db.query(`insert into auth.users(id,email) values($1,'admin@example.test'),($2,'manager@example.test'),($3,'production@example.test'),($4,'quality@example.test'),($5,'inactive@example.test')`,[admin,manager,production,quality,inactive]);
for(const [id,role,active] of [[admin,'admin',true],[manager,'gestao',true],[production,'producao',true],[quality,'qualidade',true],[inactive,'admin',false]]) await db.query('insert into public.profiles(id,full_name,role,active) values($1,$2,$3,$4)',[id,'Synthetic',role,active]);
async function asAuth(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');}
async function scalar(sql,args=[]){return(await db.query(sql,args)).rows[0].value;}
async function save(id,doc,revision){return scalar('select public.mf_pricing_save($1,$2::jsonb,$3) value',[id,JSON.stringify(doc),revision]);}
async function list(){return scalar('select public.mf_pricing_list() value');}
async function remove(id,revision){return scalar('select public.mf_pricing_remove($1,$2) value',[id,revision]);}
const document={version:1,name:'Synthetic price',sourceLabel:'Synthetic test',produced:100,sellable:90,monthlyVolume:1000,items:[{id:'fabric',label:'Fabric',group:'Materiais',basis:'batch',value:1000},{id:'rent',label:'Rent',group:'Estrutura',basis:'month',value:2000}],rates:[{id:'tax',label:'Tax',value:5}],margin:30,wholesalePrice:0,retailMargin:40,retailExpenses:10,retailFixed:1,notes:''};
const id=crypto.randomUUID();
await asAuth(admin);assert.deepEqual(await list(),[]);
let record=await save(id,document,0);assert.equal(record.revision,1);assert.deepEqual(record.document,document);
assert.equal((await save(id,document,0)).revision,1);assert.equal((await list()).length,1);
await asAuth(manager);assert.equal((await list())[0].id,id);
const edited={...document,name:'Updated price'};record=await save(id,edited,1);assert.equal(record.revision,2);
await assert.rejects(save(id,{...document,name:'Stale overwrite'},1),error=>error.code==='40001');
await assert.rejects(remove(id,1),error=>error.code==='40001');
assert.equal((await list())[0].document.name,'Updated price');
for(const who of [production,quality,inactive]){await asAuth(who);await assert.rejects(list(),error=>error.code==='42501');await assert.rejects(save(crypto.randomUUID(),document,0),error=>error.code==='42501');await assert.rejects(remove(id,2),error=>error.code==='42501');}
await asAuth(admin);
for(const bad of [{...document,sellable:101},{...document,sellable:0},{...document,monthlyVolume:0},{...document,margin:95},{...document,retailMargin:90},{...document,produced:1.5},{...document,items:[]},{...document,items:[{...document.items[0],value:-1}]},{...document,items:[document.items[0],document.items[0]]},{...document,items:[{...document.items[0],basis:null}]},{...document,rates:[{id:'x',label:'X',value:100}]},{...document,notes:null},{...document,version:2}]) await assert.rejects(save(crypto.randomUUID(),bad,0),error=>error.code==='22023');
await assert.rejects(db.query('select * from mf_private.pricing_sheets'),/permission denied/);
await assert.rejects(db.query('select mf_private.validate_pricing_document($1::jsonb)',[JSON.stringify(document)]),/permission denied/);
await remove(id,2);assert.deepEqual(await list(),[]);assert.equal((await remove(id,2)).removed,true);
await assert.rejects(save(id,edited,2),error=>error.code==='40001');
await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)");await db.exec('set role anon');
for(const query of ['select public.mf_pricing_list()','select public.mf_pricing_save(null,null,0)','select public.mf_pricing_remove(null,1)'])await assert.rejects(db.query(query),/permission denied/);
await db.exec('reset role');
assert.equal(await scalar("select relrowsecurity value from pg_class where oid='mf_private.pricing_sheets'::regclass"),true);
assert.equal(await scalar('select count(*)::int value from mf_private.pricing_sheets'),1);
assert.equal(await scalar('select count(*)::int value from mf_private.orders'),0);
assert.equal(await scalar('select count(*)::int value from mf_private.materials'),0);
console.log('Pricing PostgreSQL: CRUD, retry, revision conflicts, archived state, role isolation, validation, RLS and no stock mutations passed.');
await db.close();
