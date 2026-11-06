-- Confecção Moda Pink. Apply only to its dedicated Supabase project.
-- No Auth users, passwords, personal information or demonstration records are seeded.
begin;
create schema if not exists mf_private;
revoke all on schema mf_private from public, anon;
grant usage on schema mf_private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 100),
  role text not null check (role in ('admin','gestao','producao','qualidade')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;

create function mf_private.current_role() returns text language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = (select auth.uid()) and p.active and auth.uid() is not null
$$;
revoke all on function mf_private.current_role() from public, anon, authenticated;
grant execute on function mf_private.current_role() to authenticated;
create policy mf_profiles_read on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select mf_private.current_role()) in ('admin','gestao'));

create table mf_private.factory (
  singleton boolean primary key default true check(singleton),
  revision bigint not null default 0 check(revision >= 0)
);
insert into mf_private.factory(singleton) values(true);
create table mf_private.materials (
  id uuid primary key default gen_random_uuid(),
  name text not null check(char_length(btrim(name)) between 1 and 120),
  category text not null check(category in ('Tecido','Aviamento')),
  color text not null check(char_length(btrim(color)) between 1 and 80),
  hex text not null check(hex ~ '^#[0-9A-Fa-f]{6}$'),
  lot text not null check(char_length(btrim(lot)) between 1 and 80),
  supplier text not null check(char_length(btrim(supplier)) between 1 and 120),
  quantity numeric(16,3) not null check(quantity >= 0),
  reserved numeric(16,3) not null default 0 check(reserved >= 0 and reserved <= quantity),
  minimum numeric(16,3) not null default 0 check(minimum >= 0),
  unit text not null check(unit in ('kg','m','un')),
  price numeric(16,4) not null check(price >= 0),
  created_at timestamptz not null default now(),
  check(unit <> 'un' or (quantity = trunc(quantity) and minimum = trunc(minimum))),
  constraint mf_materials_quantity_finite check(quantity is null or quantity <> 'NaN'::numeric),
  constraint mf_materials_reserved_finite check(reserved is null or reserved <> 'NaN'::numeric),
  constraint mf_materials_minimum_finite check(minimum is null or minimum <> 'NaN'::numeric),
  constraint mf_materials_price_finite check(price is null or price <> 'NaN'::numeric)
);
create unique index mf_material_identity on mf_private.materials(lower(name), lower(color), lower(lot));
create table mf_private.models (
  id uuid primary key default gen_random_uuid(),
  name text not null check(char_length(btrim(name)) between 1 and 120),
  reference text not null check(char_length(btrim(reference)) between 1 and 60),
  material_id uuid not null references mf_private.materials(id),
  unit text not null check(unit in ('kg','m')),
  consumption numeric(16,3) not null check(consumption > 0),
  notions_cost numeric(16,4) not null default 0 check(notions_cost >= 0),
  sewing_cost numeric(16,4) not null default 0 check(sewing_cost >= 0),
  finishing_cost numeric(16,4) not null default 0 check(finishing_cost >= 0),
  notes text not null default '' check(char_length(notes) <= 4000),
  image_path text,
  created_at timestamptz not null default now(),
  constraint mf_models_consumption_finite check(consumption is null or consumption <> 'NaN'::numeric),
  constraint mf_models_notions_cost_finite check(notions_cost is null or notions_cost <> 'NaN'::numeric),
  constraint mf_models_sewing_cost_finite check(sewing_cost is null or sewing_cost <> 'NaN'::numeric),
  constraint mf_models_finishing_cost_finite check(finishing_cost is null or finishing_cost <> 'NaN'::numeric)
);
create unique index mf_model_reference on mf_private.models(lower(reference));
create index mf_models_material on mf_private.models(material_id);
create table mf_private.model_sizes (
  model_id uuid not null references mf_private.models(id),
  size text not null check(size in ('P','M','G','GG','U')),
  position integer not null check(position >= 0),
  primary key(model_id,size)
);
create table mf_private.orders (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  code text generated always as ('OP-' || lpad(number::text,6,'0')) stored unique,
  model_id uuid not null references mf_private.models(id),
  material_id uuid not null references mf_private.materials(id),
  model_snapshot jsonb not null,
  consumption_per_piece numeric(16,3) not null check(consumption_per_piece > 0),
  quantity integer not null check(quantity > 0),
  stage text not null default 'Planejado' check(stage in ('Planejado','Corte','Costura','Acabamento','Qualidade','Concluído')),
  due date not null,
  team text not null check(char_length(btrim(team)) between 1 and 120),
  priority text not null check(priority in ('Normal','Alta')),
  reserved numeric(16,3) not null check(reserved >= 0),
  actual_consumption numeric(16,3) check(actual_consumption > 0),
  material_price numeric(16,4) not null check(material_price >= 0),
  approved integer not null default 0 check(approved >= 0),
  rework integer not null default 0 check(rework >= 0),
  lost integer not null default 0 check(lost >= 0),
  created date not null default (now() at time zone 'America/Sao_Paulo')::date,
  created_by uuid not null references auth.users(id),
  check(approved + rework + lost <= quantity),
  check(stage <> 'Concluído' or (rework = 0 and approved + lost = quantity)),
  check((stage in ('Planejado','Corte') and actual_consumption is null) or (stage not in ('Planejado','Corte') and actual_consumption is not null and reserved = 0)),
  constraint mf_orders_consumption_per_piece_finite check(consumption_per_piece is null or consumption_per_piece <> 'NaN'::numeric),
  constraint mf_orders_reserved_finite check(reserved is null or reserved <> 'NaN'::numeric),
  constraint mf_orders_actual_consumption_finite check(actual_consumption is null or actual_consumption <> 'NaN'::numeric),
  constraint mf_orders_material_price_finite check(material_price is null or material_price <> 'NaN'::numeric)
);
create index mf_orders_model on mf_private.orders(model_id);
create index mf_orders_material on mf_private.orders(material_id);
create index mf_orders_due on mf_private.orders(due) where stage <> 'Concluído';
create index mf_orders_creator on mf_private.orders(created_by);
create table mf_private.order_variants (
  order_id uuid not null references mf_private.orders(id),
  size text not null,
  quantity integer not null check(quantity > 0),
  primary key(order_id,size)
);
create table mf_private.inspections (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references mf_private.orders(id),
  quantity integer not null check(quantity > 0),
  result text not null check(result in ('Aprovadas','Retrabalho','Perda')),
  reason text not null check(char_length(btrim(reason)) between 1 and 160),
  notes text not null default '' check(char_length(notes) <= 4000),
  image_path text,
  date date not null default (now() at time zone 'America/Sao_Paulo')::date,
  resolved boolean not null default false,
  resolved_at timestamptz,
  created_by uuid not null references auth.users(id),
  check(not resolved or (result = 'Retrabalho' and resolved_at is not null))
);
create index mf_inspections_order on mf_private.inspections(order_id);
create index mf_inspections_creator on mf_private.inspections(created_by);
create table mf_private.movements (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references mf_private.materials(id),
  order_id uuid references mf_private.orders(id),
  kind text not null check(kind in ('Entrada','Perda','Reserva','Consumo')),
  amount numeric(16,3) not null check(amount > 0),
  physical_after numeric(16,3) not null check(physical_after >= 0),
  reserved_after numeric(16,3) not null check(reserved_after >= 0),
  note text not null,
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint mf_movements_amount_finite check(amount is null or amount <> 'NaN'::numeric),
  constraint mf_movements_physical_after_finite check(physical_after is null or physical_after <> 'NaN'::numeric),
  constraint mf_movements_reserved_after_finite check(reserved_after is null or reserved_after <> 'NaN'::numeric)
);
create index mf_movements_material on mf_private.movements(material_id);
create index mf_movements_order on mf_private.movements(order_id);
create index mf_movements_actor on mf_private.movements(actor_id);
create table mf_private.events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  title text not null,
  detail text not null,
  created_at timestamptz not null default now()
);
create index mf_events_date on mf_private.events(created_at desc);
create index mf_events_actor on mf_private.events(actor_id);
create table mf_private.command_receipts (
  request_id uuid primary key,
  actor_id uuid not null references auth.users(id),
  command jsonb not null,
  revision bigint not null,
  created_at timestamptz not null default now()
);
create index mf_receipts_actor on mf_private.command_receipts(actor_id);

-- Raw operational tables cannot be mutated through REST/GraphQL, even by a signed-in user.
alter table mf_private.factory enable row level security;
alter table mf_private.materials enable row level security;
alter table mf_private.models enable row level security;
alter table mf_private.model_sizes enable row level security;
alter table mf_private.orders enable row level security;
alter table mf_private.order_variants enable row level security;
alter table mf_private.inspections enable row level security;
alter table mf_private.movements enable row level security;
alter table mf_private.events enable row level security;
alter table mf_private.command_receipts enable row level security;
revoke all on all tables in schema mf_private from public,anon,authenticated;
revoke all on all sequences in schema mf_private from public,anon,authenticated;

create function mf_private.get_profile() returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p public.profiles;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.' using errcode='42501'; end if;
  select * into p from public.profiles where id=auth.uid() and active;
  if not found then raise exception 'Seu acesso à confecção não está ativo.' using errcode='42501'; end if;
  return jsonb_build_object('id',p.id,'name',p.full_name,'role',p.role,'active',p.active);
end $$;

create function mf_private.get_state() returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare actor jsonb; finance boolean; answer jsonb;
begin
  actor := mf_private.get_profile();
  finance := actor->>'role' in ('admin','gestao');
  select jsonb_build_object(
    'profile',actor,'revision',(select revision from mf_private.factory where singleton),'canViewCosts',finance,
    'state',jsonb_build_object('version',1,
      'materials',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',m.name,'category',m.category,'color',m.color,'hex',m.hex,'lot',m.lot,'supplier',m.supplier,'quantity',m.quantity,'reserved',m.reserved,'minimum',m.minimum,'unit',m.unit,'price',case when finance then m.price else 0 end) order by m.created_at desc,m.id) from mf_private.materials m),'[]'::jsonb),
      'models',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',m.name,'reference',m.reference,'materialId',m.material_id,'consumption',m.consumption,'sizes',(select coalesce(jsonb_agg(s.size order by s.position),'[]') from mf_private.model_sizes s where s.model_id=m.id),'notionsCost',case when finance then m.notions_cost else 0 end,'sewingCost',case when finance then m.sewing_cost else 0 end,'finishingCost',case when finance then m.finishing_cost else 0 end,'notes',m.notes,'image',m.image_path) order by m.created_at desc,m.id) from mf_private.models m),'[]'::jsonb),
      'orders',coalesce((select jsonb_agg(jsonb_build_object('id',o.code,'modelId',o.model_id,'materialId',o.material_id,'quantity',o.quantity,'variants',(select jsonb_agg(jsonb_build_object('size',v.size,'quantity',v.quantity) order by v.size) from mf_private.order_variants v where v.order_id=o.id),'stage',o.stage,'due',o.due,'team',o.team,'priority',o.priority,'reserved',o.reserved,'actualConsumption',o.actual_consumption,'materialPrice',case when finance then o.material_price else 0 end,'approved',o.approved,'rework',o.rework,'lost',o.lost,'created',o.created,'consumptionPerPiece',o.consumption_per_piece,'modelSnapshot',case when finance then o.model_snapshot else o.model_snapshot || jsonb_build_object('notionsCost',0,'sewingCost',0,'finishingCost',0) end) order by o.number desc) from mf_private.orders o),'[]'::jsonb),
      'inspections',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'orderId',o.code,'quantity',i.quantity,'result',i.result,'reason',i.reason,'notes',i.notes,'image',i.image_path,'date',i.date,'resolved',i.resolved) order by i.date desc,i.id) from mf_private.inspections i join mf_private.orders o on o.id=i.order_id),'[]'::jsonb),
      'dailyApprovals',coalesce((select jsonb_agg(jsonb_build_object('date',a.approval_date,'quantity',a.quantity) order by a.approval_date) from (select approval_date,sum(quantity)::integer quantity from (select i.date as approval_date,i.quantity from mf_private.inspections i where i.result='Aprovadas' union all select (i.resolved_at at time zone 'America/Sao_Paulo')::date as approval_date,i.quantity from mf_private.inspections i where i.result='Retrabalho' and i.resolved) approved_events group by approval_date) a),'[]'::jsonb),
      'activity',coalesce((select jsonb_agg(x.entry order by x.created_at desc) from (select e.created_at,jsonb_build_object('id',e.id,'title',e.title,'detail',e.detail,'date',e.created_at) entry from mf_private.events e order by e.created_at desc,e.id limit 50) x),'[]'::jsonb)
    )
  ) into answer;
  return answer;
end $$;

create function mf_private.assert_image(path text,kind text) returns void language plpgsql stable security definer set search_path = '' as $$
begin
  perform mf_private.get_profile();
  if path is null or path = '' then return; end if;
  if path !~ ('^' || kind || '/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.(webp|jpg|jpeg|png)$') then raise exception 'Referência de imagem inválida.' using errcode='22023'; end if;
  if not exists(select 1 from storage.objects where bucket_id='confeccao-images' and name=path) then raise exception 'A imagem ainda não foi enviada ao armazenamento.' using errcode='22023'; end if;
end $$;

create function mf_private.apply_command(p_command jsonb,p_request_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor jsonb; actor_role text; current_revision bigint; receipt mf_private.command_receipts;
  typ text; data jsonb; m mf_private.materials; base mf_private.materials; model mf_private.models; ord mf_private.orders; insp mf_private.inspections;
  item jsonb; total integer; need numeric(16,3); actual numeric(16,3); amount numeric(16,3); new_id uuid; sizes text[]; stage_next text; image text; t text; d text;
begin
  actor := mf_private.get_profile(); actor_role:=actor->>'role';
  if p_request_id is null or p_command is null or jsonb_typeof(p_command) <> 'object' or octet_length(p_command::text) > 20000 then raise exception 'Comando inválido.' using errcode='22023'; end if;
  select revision into current_revision from mf_private.factory where singleton for update;
  select * into receipt from mf_private.command_receipts where request_id=p_request_id;
  if found then
    if receipt.actor_id <> auth.uid() or receipt.command <> p_command then raise exception 'Identificador de envio já utilizado.' using errcode='22023'; end if;
    return mf_private.get_state() || jsonb_build_object('requestId',p_request_id,'replayed',true);
  end if;
  if (p_command->>'expectedRevision')::bigint is distinct from current_revision then raise exception 'Os dados foram atualizados por outra pessoa. Recarregue e confira a operação.' using errcode='40001'; end if;
  typ:=p_command->>'type'; data:=p_command->'payload';
  if data is null or jsonb_typeof(data) <> 'object' then raise exception 'Dados do comando inválidos.' using errcode='22023'; end if;
  if typ in ('create_material','create_model') and actor_role not in ('admin','gestao') then raise exception 'Apenas a gestão pode cadastrar materiais e fichas com custos.' using errcode='42501'; end if;
  if typ in ('move_material','create_order','update_model_image') and actor_role not in ('admin','gestao','producao') then raise exception 'Esta operação exige acesso de produção ou gestão.' using errcode='42501'; end if;
  if typ in ('inspect_order','resolve_inspection') and actor_role not in ('admin','gestao','qualidade') then raise exception 'Esta operação exige acesso de qualidade ou gestão.' using errcode='42501'; end if;

  case typ
  when 'create_material' then
    insert into mf_private.materials(name,category,color,hex,lot,supplier,quantity,reserved,minimum,unit,price)
    values(btrim(data->>'name'),data->>'category',btrim(data->>'color'),data->>'hex',btrim(data->>'lot'),btrim(data->>'supplier'),(data->>'quantity')::numeric,0,(data->>'minimum')::numeric,data->>'unit',(data->>'price')::numeric) returning * into m;
    if m.quantity > 0 then insert into mf_private.movements(material_id,kind,amount,physical_after,reserved_after,note,actor_id) values(m.id,'Entrada',m.quantity,m.quantity,0,'Saldo inicial cadastrado',auth.uid()); end if;
    t:='Material cadastrado'; d:=m.name||' · lote '||m.lot;
  when 'move_material' then
    select * into m from mf_private.materials where id=(data->>'id')::uuid for update;
    if not found then raise exception 'Material não encontrado.' using errcode='22023'; end if;
    amount:=(data->>'amount')::numeric;
    if amount is null or amount <= 0 or amount <> round(amount,3) or (m.unit='un' and amount <> trunc(amount)) then raise exception 'Quantidade de movimento inválida.' using errcode='22023'; end if;
    if data->>'kind' not in ('Entrada','Perda') or coalesce(char_length(btrim(data->>'note')),0) not between 1 and 500 then raise exception 'Informe o tipo e o motivo da movimentação.' using errcode='22023'; end if;
    if data->>'kind'='Perda' and amount > m.quantity-m.reserved then raise exception 'O material reservado está protegido; saldo livre insuficiente.' using errcode='22023'; end if;
    update mf_private.materials set quantity=quantity+case when data->>'kind'='Entrada' then amount else -amount end where id=m.id returning * into m;
    insert into mf_private.movements(material_id,kind,amount,physical_after,reserved_after,note,actor_id) values(m.id,data->>'kind',amount,m.quantity,m.reserved,btrim(data->>'note'),auth.uid());
    t:='Movimentação de material'; d:=m.name||' · '||amount||' '||m.unit||' · '||(data->>'kind');
  when 'create_model' then
    select * into m from mf_private.materials where id=(data->>'materialId')::uuid;
    if not found or m.category <> 'Tecido' or m.unit not in ('kg','m') then raise exception 'Selecione um tecido em quilos ou metros.' using errcode='22023'; end if;
    if jsonb_typeof(data->'sizes') is distinct from 'array' or jsonb_array_length(data->'sizes') not between 1 and 5 then raise exception 'Informe os tamanhos da ficha.' using errcode='22023'; end if;
    image:=nullif(data->>'image',''); perform mf_private.assert_image(image,'models');
    insert into mf_private.models(name,reference,material_id,unit,consumption,notions_cost,sewing_cost,finishing_cost,notes,image_path)
    values(btrim(data->>'name'),btrim(data->>'reference'),m.id,m.unit,(data->>'consumption')::numeric,(data->>'notionsCost')::numeric,(data->>'sewingCost')::numeric,(data->>'finishingCost')::numeric,coalesce(data->>'notes',''),image) returning * into model;
    insert into mf_private.model_sizes(model_id,size,position) select model.id,value,ordinality::integer from jsonb_array_elements_text(data->'sizes') with ordinality;
    t:='Ficha técnica criada'; d:=model.reference||' · '||model.name;
  when 'update_model_image' then
    image:=nullif(data->>'image',''); perform mf_private.assert_image(image,'models');
    update mf_private.models set image_path=image where id=(data->>'id')::uuid returning * into model;
    if not found then raise exception 'Modelo não encontrado.' using errcode='22023'; end if;
    t:='Foto do modelo atualizada'; d:=model.reference||' · '||model.name;
  when 'create_order' then
    select * into model from mf_private.models where id=(data->>'modelId')::uuid;
    if not found then raise exception 'Modelo não encontrado.' using errcode='22023'; end if;
    select * into m from mf_private.materials where id=(data->>'materialId')::uuid for update;
    if not found or m.category <> 'Tecido' or m.unit <> model.unit then raise exception 'Selecione um tecido compatível com a ficha técnica.' using errcode='22023'; end if;
    if jsonb_typeof(data->'variants') is distinct from 'array' or jsonb_array_length(data->'variants') not between 1 and 5 then raise exception 'Informe a grade do lote.' using errcode='22023'; end if;
    total:=0; sizes:='{}';
    for item in select value from jsonb_array_elements(data->'variants') loop
      actual:=(item->>'quantity')::numeric;
      if actual is null or actual <= 0 or actual <> trunc(actual) or actual > 1000000 then raise exception 'Informe quantidades inteiras e positivas.' using errcode='22023'; end if;
      if item->>'size'=any(sizes) or not exists(select 1 from mf_private.model_sizes where model_id=model.id and size=item->>'size') then raise exception 'Grade duplicada ou tamanho não cadastrado na ficha.' using errcode='22023'; end if;
      sizes:=array_append(sizes,item->>'size'); total:=total+actual::integer;
    end loop;
    need:=round(total*model.consumption,3);
    if need > m.quantity-m.reserved then raise exception 'Tecido insuficiente para reservar este lote.' using errcode='22023'; end if;
    insert into mf_private.orders(model_id,material_id,model_snapshot,consumption_per_piece,quantity,due,team,priority,reserved,material_price,created_by)
    values(model.id,m.id,jsonb_build_object('id',model.id,'name',model.name,'reference',model.reference,'materialId',model.material_id,'consumption',model.consumption,'notionsCost',model.notions_cost,'sewingCost',model.sewing_cost,'finishingCost',model.finishing_cost,'unit',model.unit),model.consumption,total,(data->>'due')::date,btrim(data->>'team'),data->>'priority',need,m.price,auth.uid()) returning * into ord;
    insert into mf_private.order_variants(order_id,size,quantity) select ord.id,value->>'size',(value->>'quantity')::integer from jsonb_array_elements(data->'variants');
    update mf_private.materials set reserved=reserved+need where id=m.id returning * into m;
    insert into mf_private.movements(material_id,order_id,kind,amount,physical_after,reserved_after,note,actor_id) values(m.id,ord.id,'Reserva',need,m.quantity,m.reserved,'Reserva para produção '||ord.code,auth.uid());
    t:='Produção planejada'; d:=ord.code||' · '||model.name||' · '||total||' peças';
  when 'advance_order' then
    select * into ord from mf_private.orders where code=data->>'orderId' for update;
    if not found or ord.stage='Concluído' then raise exception 'Produção não encontrada ou já concluída.' using errcode='22023'; end if;
    if actor_role not in ('admin','gestao','producao') and not (actor_role='qualidade' and ord.stage='Qualidade') then raise exception 'Sem permissão para esta etapa.' using errcode='42501'; end if;
    stage_next:=case ord.stage when 'Planejado' then 'Corte' when 'Corte' then 'Costura' when 'Costura' then 'Acabamento' when 'Acabamento' then 'Qualidade' when 'Qualidade' then 'Concluído' end;
    if ord.stage='Corte' then
      actual:=(data->>'consumption')::numeric;
      select * into m from mf_private.materials where id=ord.material_id for update;
      if actual is null or actual <= 0 or actual <> round(actual,3) or actual > m.quantity-m.reserved+ord.reserved then raise exception 'Consumo inválido ou saldo livre insuficiente.' using errcode='22023'; end if;
      update mf_private.materials set quantity=quantity-actual,reserved=reserved-ord.reserved where id=m.id returning * into m;
      update mf_private.orders set actual_consumption=actual,reserved=0,stage=stage_next where id=ord.id;
      insert into mf_private.movements(material_id,order_id,kind,amount,physical_after,reserved_after,note,actor_id) values(m.id,ord.id,'Consumo',actual,m.quantity,m.reserved,'Consumo registrado no corte',auth.uid());
    else
      if ord.stage='Qualidade' and (ord.rework>0 or ord.approved+ord.lost<>ord.quantity) then raise exception 'Confira todas as peças e resolva os retrabalhos antes de concluir.' using errcode='22023'; end if;
      update mf_private.orders set stage=stage_next where id=ord.id;
    end if;
    t:='Etapa atualizada'; d:=ord.code||' · '||stage_next;
  when 'inspect_order' then
    select * into ord from mf_private.orders where code=data->>'orderId' for update;
    if not found or ord.stage <> 'Qualidade' then raise exception 'A produção deve estar na etapa de qualidade.' using errcode='22023'; end if;
    actual:=(data->>'quantity')::numeric;
    if actual is null or actual <= 0 or actual <> trunc(actual) or actual > ord.quantity-ord.approved-ord.rework-ord.lost then raise exception 'Quantidade inválida ou superior às peças sem conferência.' using errcode='22023'; end if;
    image:=nullif(data->>'image',''); perform mf_private.assert_image(image,'inspections');
    insert into mf_private.inspections(order_id,quantity,result,reason,notes,image_path,created_by)
    values(ord.id,actual::integer,data->>'result',case when data->>'result'='Aprovadas' then 'Conferência aprovada' else btrim(data->>'reason') end,coalesce(data->>'notes',''),image,auth.uid()) returning * into insp;
    update mf_private.orders set approved=approved+case when insp.result='Aprovadas' then insp.quantity else 0 end,rework=rework+case when insp.result='Retrabalho' then insp.quantity else 0 end,lost=lost+case when insp.result='Perda' then insp.quantity else 0 end where id=ord.id;
    t:='Conferência registrada'; d:=ord.code||' · '||insp.quantity||' · '||insp.result;
  when 'resolve_inspection' then
    select * into insp from mf_private.inspections where id=(data->>'id')::uuid for update;
    if not found or insp.result <> 'Retrabalho' or insp.resolved then raise exception 'Registro inválido ou retrabalho já resolvido.' using errcode='22023'; end if;
    select * into ord from mf_private.orders where id=insp.order_id for update;
    if ord.stage <> 'Qualidade' or ord.rework < insp.quantity then raise exception 'O lote não permite esta reconferência.' using errcode='22023'; end if;
    update mf_private.inspections set resolved=true,resolved_at=now() where id=insp.id;
    update mf_private.orders set rework=rework-insp.quantity,approved=approved+insp.quantity where id=ord.id;
    t:='Retrabalho aprovado'; d:=ord.code||' · '||insp.quantity||' peças reconferidas';
  else raise exception 'Operação não reconhecida.' using errcode='22023';
  end case;
  update mf_private.factory set revision=revision+1 where singleton returning revision into current_revision;
  insert into mf_private.events(actor_id,title,detail) values(auth.uid(),t,d);
  insert into mf_private.command_receipts(request_id,actor_id,command,revision) values(p_request_id,auth.uid(),p_command,current_revision);
  return mf_private.get_state() || jsonb_build_object('requestId',p_request_id,'replayed',false);
end $$;

create function mf_private.list_profiles() returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if mf_private.current_role() is null or mf_private.current_role() not in ('admin','gestao') then raise exception 'Sem acesso à equipe.' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'full_name',full_name,'role',role,'active',active) order by full_name),'[]') from public.profiles);
end $$;
create function mf_private.set_profile(p_user_id uuid,p_full_name text,p_role text,p_active boolean) returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.profiles;
begin
  if mf_private.current_role() is distinct from 'admin' then raise exception 'Somente um administrador pode alterar acessos.' using errcode='42501'; end if;
  perform 1 from mf_private.factory where singleton for update;
  select * into target from public.profiles where id=p_user_id for update;
  if not found then raise exception 'Perfil não encontrado. O cadastro da identidade deve ser feito pelo administrador do projeto.' using errcode='22023'; end if;
  if target.active and target.role='admin' and (not p_active or p_role<>'admin') and not exists(select 1 from public.profiles where id<>p_user_id and active and role='admin') then raise exception 'Mantenha pelo menos um administrador ativo.' using errcode='22023'; end if;
  update public.profiles set full_name=btrim(p_full_name),role=p_role,active=p_active,updated_at=now() where id=p_user_id;
  update mf_private.factory set revision=revision+1 where singleton;
  insert into mf_private.events(actor_id,title,detail) values(auth.uid(),'Acesso atualizado',p_user_id::text||' · '||p_role||' · ativo='||p_active);
  return mf_private.list_profiles();
end $$;

-- Exposed functions are INVOKER wrappers; guarded privileged work remains non-exposed.
create function public.mf_get_profile() returns jsonb language sql stable security invoker set search_path = '' as $$ select mf_private.get_profile() $$;
create function public.mf_get_state() returns jsonb language sql stable security invoker set search_path = '' as $$ select mf_private.get_state() $$;
create function public.mf_apply_command(p_command jsonb,p_request_id uuid) returns jsonb language sql security invoker set search_path = '' as $$ select mf_private.apply_command(p_command,p_request_id) $$;
create function public.mf_list_profiles() returns jsonb language sql stable security invoker set search_path = '' as $$ select mf_private.list_profiles() $$;
create function public.mf_set_profile(p_user_id uuid,p_full_name text,p_role text,p_active boolean) returns jsonb language sql security invoker set search_path = '' as $$ select mf_private.set_profile(p_user_id,p_full_name,p_role,p_active) $$;
revoke all on all functions in schema mf_private from public,anon,authenticated;
grant execute on function mf_private.current_role(),mf_private.get_profile(),mf_private.get_state(),mf_private.apply_command(jsonb,uuid),mf_private.list_profiles(),mf_private.set_profile(uuid,text,text,boolean) to authenticated;
revoke all on function public.mf_get_profile(),public.mf_get_state(),public.mf_apply_command(jsonb,uuid),public.mf_list_profiles(),public.mf_set_profile(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.mf_get_profile(),public.mf_get_state(),public.mf_apply_command(jsonb,uuid),public.mf_list_profiles(),public.mf_set_profile(uuid,text,text,boolean) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('confeccao-images','confeccao-images',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy mf_images_read on storage.objects for select to authenticated using(bucket_id='confeccao-images' and (select mf_private.current_role()) is not null);
create policy mf_images_insert on storage.objects for insert to authenticated with check(
  bucket_id='confeccao-images' and name ~ '^(models|inspections)/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.(webp|jpg|jpeg|png)$'
  and ((split_part(name,'/',1)='models' and (select mf_private.current_role()) in ('admin','gestao','producao')) or (split_part(name,'/',1)='inspections' and (select mf_private.current_role()) in ('admin','gestao','qualidade')))
);
create policy mf_images_update on storage.objects for update to authenticated
using(bucket_id='confeccao-images' and ((select mf_private.current_role()) in ('admin','gestao') or (owner_id=(select auth.uid())::text and (select mf_private.current_role()) is not null)))
with check(bucket_id='confeccao-images' and name ~ '^(models|inspections)/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.(webp|jpg|jpeg|png)$'
  and ((split_part(name,'/',1)='models' and (select mf_private.current_role()) in ('admin','gestao','producao')) or (split_part(name,'/',1)='inspections' and (select mf_private.current_role()) in ('admin','gestao','qualidade'))));
create policy mf_images_delete on storage.objects for delete to authenticated
using(bucket_id='confeccao-images' and (select mf_private.current_role()) is not null and ((select mf_private.current_role()) in ('admin','gestao') or owner_id=(select auth.uid())::text));
commit;
