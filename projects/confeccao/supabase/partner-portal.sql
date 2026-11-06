-- Additive migration for the dedicated Confecção Moda Pink project.
-- No partners, links, Auth identities or operational records are seeded.
-- Supabase CLI is unavailable in this workspace; apply this file as one migration.
begin;

do $$ begin
  if to_regprocedure('storage.allow_only_operation(text)') is null then
    raise exception 'Storage operation helper unavailable; do not enable anonymous photo access.';
  end if;
end $$;

create table mf_private.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  contact text not null default '' check (char_length(contact) <= 240),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id)
);
create unique index mf_partners_name on mf_private.partners(lower(name));
create index mf_partners_creator on mf_private.partners(created_by);

create table mf_private.partner_assignments (
  order_id uuid primary key references mf_private.orders(id),
  partner_id uuid not null references mf_private.partners(id),
  assigned_at timestamptz not null default now(),
  assigned_by uuid not null references auth.users(id)
);
create index mf_partner_assignments_partner on mf_private.partner_assignments(partner_id,order_id);
create index mf_partner_assignments_actor on mf_private.partner_assignments(assigned_by);

create table mf_private.portal_links (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references mf_private.partners(id),
  token_hash bytea not null unique check (octet_length(token_hash)=32),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '30 days'),
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id),
  check (expires_at > created_at and expires_at <= created_at+interval '30 days')
);
create index mf_portal_links_partner on mf_private.portal_links(partner_id,created_at desc);
create index mf_portal_links_actor on mf_private.portal_links(created_by);
create unique index mf_portal_one_live_link on mf_private.portal_links(partner_id) where revoked_at is null;

create table mf_private.portal_uploads (
  path text primary key,
  partner_id uuid not null references mf_private.partners(id),
  link_id uuid not null references mf_private.portal_links(id),
  status text not null default 'pending' check (status in ('pending','attached','deleting')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '10 minutes'),
  check (path ~ '^portal/[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg|jpeg|png)$')
);
create index mf_portal_uploads_link on mf_private.portal_uploads(link_id,status,expires_at);
create index mf_portal_uploads_partner on mf_private.portal_uploads(partner_id,created_at);

create table mf_private.partner_updates (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  partner_id uuid not null references mf_private.partners(id),
  link_id uuid not null references mf_private.portal_links(id),
  order_id uuid not null references mf_private.orders(id),
  stage text not null check (stage in ('Recebido','Corte','Costura','Acabamento','Conferência','Pronto para retirada')),
  produced integer not null check (produced>=0),
  checked integer not null check (checked>=0 and checked<=produced),
  defects integer not null check (defects>=0 and defects<=checked),
  reporter text not null check (char_length(btrim(reporter)) between 1 and 100),
  notes text not null default '' check (char_length(notes)<=4000),
  defect_description text not null default '' check (char_length(defect_description)<=2000),
  photos text[] not null default '{}' check (cardinality(photos)<=6),
  request_payload jsonb not null check (octet_length(request_payload::text)<=16384),
  created_at timestamptz not null default now(),
  check (defects=0 or char_length(btrim(defect_description))>0)
);
create index mf_partner_updates_order on mf_private.partner_updates(order_id,created_at desc,id);
create index mf_partner_updates_partner on mf_private.partner_updates(partner_id,created_at desc,id);
create index mf_partner_updates_link on mf_private.partner_updates(link_id,created_at desc);
create index mf_partner_updates_latest on mf_private.partner_updates(partner_id,order_id,created_at desc,id);
create index mf_partner_updates_photos on mf_private.partner_updates using gin(photos);

alter table mf_private.partners enable row level security;
alter table mf_private.partner_assignments enable row level security;
alter table mf_private.portal_links enable row level security;
alter table mf_private.portal_uploads enable row level security;
alter table mf_private.partner_updates enable row level security;
revoke all on mf_private.partners,mf_private.partner_assignments,mf_private.portal_links,mf_private.portal_uploads,mf_private.partner_updates from public,anon,authenticated;

create function mf_private.portal_updates_immutable() returns trigger
language plpgsql set search_path='' as $$ begin
  raise exception 'Atualizações do portal são imutáveis.' using errcode='22023';
end $$;
create trigger mf_partner_updates_immutable before update or delete on mf_private.partner_updates
for each row execute function mf_private.portal_updates_immutable();

-- The capability is checked on every RPC and every Storage request. Hashes never leave this schema.
create function mf_private.portal_access(p_token text) returns mf_private.portal_links
language plpgsql stable security definer set search_path='' as $$
declare access mf_private.portal_links;
begin
  if p_token is null or octet_length(p_token)<>64 or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'Link inválido, expirado ou revogado.' using errcode='42501';
  end if;
  select l.* into access from mf_private.portal_links l
  join mf_private.partners p on p.id=l.partner_id
  where l.token_hash=sha256(convert_to(p_token,'UTF8')) and l.revoked_at is null and l.expires_at>now() and p.active;
  if not found then raise exception 'Link inválido, expirado ou revogado.' using errcode='42501'; end if;
  return access;
end $$;

create function mf_private.portal_update_json(u mf_private.partner_updates) returns jsonb
language sql immutable set search_path='' as $$
  select jsonb_build_object('id',u.id,'partnerId',u.partner_id,'orderId',u.order_id,'stage',u.stage,
    'produced',u.produced,'checked',u.checked,'defects',u.defects,'reporter',u.reporter,
    'notes',u.notes,'defectDescription',u.defect_description,'photos',to_jsonb(u.photos),'createdAt',u.created_at)
$$;

-- Intentionally explicit projection: model_snapshot contains costs and must never be returned wholesale.
create function mf_private.portal_orders(p_partner_id uuid default null) returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'code',o.code,
    'model',jsonb_build_object('id',o.model_id,'name',o.model_snapshot->>'name',
      'reference',o.model_snapshot->>'reference','image',m.image_path),
    'quantity',o.quantity,'variants',(select coalesce(jsonb_agg(jsonb_build_object('size',v.size,'quantity',v.quantity) order by v.size),'[]') from mf_private.order_variants v where v.order_id=o.id),
    'stage',o.stage,'due',o.due,'priority',o.priority) order by o.due,o.id),'[]')
  from mf_private.orders o join mf_private.models m on m.id=o.model_id
  where p_partner_id is null or exists(select 1 from mf_private.partner_assignments a where a.order_id=o.id and a.partner_id=p_partner_id)
$$;

create function mf_private.portal_updates_list(p_partner_id uuid,p_latest boolean) returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(mf_private.portal_update_json(rows.entry) order by (rows.entry).created_at desc,(rows.entry).id),'[]')
  from (
    select u as entry from mf_private.partner_updates u
    where (p_partner_id is null or (u.partner_id=p_partner_id and exists(
      select 1 from mf_private.partner_assignments a where a.order_id=u.order_id and a.partner_id=p_partner_id)))
    and (not p_latest or not exists(select 1 from mf_private.partner_updates newer
      where newer.partner_id=u.partner_id and newer.order_id=u.order_id and (newer.created_at,newer.id)>(u.created_at,u.id)))
    order by u.created_at desc,u.id
    limit case when p_latest then null else 200 end
  ) rows
$$;

create function mf_private.portal_owner_state() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform mf_private.get_profile();
  return jsonb_build_object(
    'partners',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'contact',p.contact,'active',p.active,'createdAt',p.created_at) order by p.name),'[]') from mf_private.partners p),
    'orders',mf_private.portal_orders(),
    'assignments',(select coalesce(jsonb_agg(jsonb_build_object('orderId',a.order_id,'partnerId',a.partner_id,'assignedAt',a.assigned_at) order by a.assigned_at desc),'[]') from mf_private.partner_assignments a),
    'links',(select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'partnerId',l.partner_id,'createdAt',l.created_at,'expiresAt',l.expires_at,'revokedAt',l.revoked_at,'active',l.revoked_at is null and l.expires_at>now() and p.active) order by l.created_at desc),'[]') from mf_private.portal_links l join mf_private.partners p on p.id=l.partner_id),
    'historyLimit',200,'updates',mf_private.portal_updates_list(null,false),'latestUpdates',mf_private.portal_updates_list(null,true)
  );
end $$;

create function mf_private.portal_manage(p_command jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare data jsonb; typ text; partner mf_private.partners; ord mf_private.orders;
  access mf_private.portal_links; raw_token text; result jsonb; event_title text; event_detail text;
begin
  if mf_private.current_role() is null or mf_private.current_role() not in ('admin','gestao') then
    raise exception 'Apenas administração e gestão podem gerenciar confecções.' using errcode='42501';
  end if;
  if jsonb_typeof(p_command) is distinct from 'object' or octet_length(p_command::text)>8192 then raise exception 'Comando inválido.' using errcode='22023'; end if;
  typ:=p_command->>'type'; data:=p_command->'payload';
  if jsonb_typeof(data) is distinct from 'object' then raise exception 'Dados inválidos.' using errcode='22023'; end if;
  perform 1 from mf_private.factory where singleton for update;
  -- Profile changes use this same lock; permissions must be checked again after waiting.
  if mf_private.current_role() is null or mf_private.current_role() not in ('admin','gestao') then
    raise exception 'Apenas administração e gestão podem gerenciar confecções.' using errcode='42501';
  end if;
  case typ
  when 'save_partner' then
    if jsonb_typeof(data->'name') is distinct from 'string' or coalesce(char_length(btrim(data->>'name')),0) not between 1 and 120
      or char_length(coalesce(data->>'contact',''))>240 or (data ? 'contact' and jsonb_typeof(data->'contact') is distinct from 'string')
      or jsonb_typeof(data->'active') is distinct from 'boolean' then
      raise exception 'Informe nome e situação válidos da confecção.' using errcode='22023';
    end if;
    if nullif(data->>'id','') is null then
      insert into mf_private.partners(name,contact,active,created_by)
      values(btrim(data->>'name'),btrim(coalesce(data->>'contact','')),(data->>'active')::boolean,auth.uid()) returning * into partner;
      event_title:='Confecção cadastrada';
    else
      update mf_private.partners set name=btrim(data->>'name'),contact=btrim(coalesce(data->>'contact','')),active=(data->>'active')::boolean
      where id=(data->>'id')::uuid returning * into partner;
      if not found then raise exception 'Confecção não encontrada.' using errcode='22023'; end if;
      if not partner.active then update mf_private.portal_links set revoked_at=now() where partner_id=partner.id and revoked_at is null; end if;
      event_title:='Confecção atualizada';
    end if;
    event_detail:=partner.name||' · '||case when partner.active then 'Ativa' else 'Inativa' end;
  when 'assign_order' then
    select * into ord from mf_private.orders where id=(data->>'orderId')::uuid for update;
    if not found or ord.stage='Concluído' then raise exception 'Ordem não encontrada ou concluída.' using errcode='22023'; end if;
    if nullif(data->>'partnerId','') is null then
      delete from mf_private.partner_assignments where order_id=ord.id;
      event_title:='Confecção desvinculada da produção';
      event_detail:=ord.code||' · produção sem confecção parceira';
    else
      select * into partner from mf_private.partners where id=(data->>'partnerId')::uuid and active;
      if not found then raise exception 'Confecção não encontrada ou inativa.' using errcode='22023'; end if;
      insert into mf_private.partner_assignments(order_id,partner_id,assigned_by) values(ord.id,partner.id,auth.uid())
      on conflict(order_id) do update set partner_id=excluded.partner_id,assigned_at=now(),assigned_by=excluded.assigned_by;
      event_title:='Produção atribuída à confecção';
      event_detail:=ord.code||' · '||partner.name;
    end if;
  when 'create_link' then
    select * into partner from mf_private.partners where id=(data->>'partnerId')::uuid and active for update;
    if not found then raise exception 'Confecção não encontrada ou inativa.' using errcode='22023'; end if;
    update mf_private.portal_links set revoked_at=now() where partner_id=partner.id and revoked_at is null;
    -- Two independent UUIDv4 values provide approximately 244 random bits, with no extension dependency.
    raw_token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
    insert into mf_private.portal_links(partner_id,token_hash,created_by)
    values(partner.id,sha256(convert_to(raw_token,'UTF8')),auth.uid()) returning * into access;
    event_title:='Acesso da confecção gerado';
    event_detail:=partner.name||' · válido por 30 dias';
  when 'revoke_link' then
    select * into partner from mf_private.partners where id=(data->>'partnerId')::uuid for update;
    if not found then raise exception 'Confecção não encontrada.' using errcode='22023'; end if;
    update mf_private.portal_links set revoked_at=now() where partner_id=partner.id and revoked_at is null;
    event_title:='Acesso da confecção revogado';
    event_detail:=partner.name;
  else raise exception 'Comando não reconhecido.' using errcode='22023';
  end case;
  update mf_private.factory set revision=revision+1 where singleton;
  insert into mf_private.events(actor_id,title,detail) values(auth.uid(),event_title,event_detail);
  result:=mf_private.portal_owner_state();
  if typ='create_link' then
    result:=result||jsonb_build_object('createdLink',jsonb_build_object('id',access.id,'partnerId',access.partner_id,'token',raw_token,'expiresAt',access.expires_at));
  end if;
  return result;
end $$;

create function mf_private.portal_get(p_token text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare access mf_private.portal_links;
begin
  access:=mf_private.portal_access(p_token);
  return jsonb_build_object('partner',(select jsonb_build_object('id',id,'name',name) from mf_private.partners where id=access.partner_id),
    'expiresAt',access.expires_at,'orders',mf_private.portal_orders(access.partner_id),
    'historyLimit',200,'updates',mf_private.portal_updates_list(access.partner_id,false),'latestUpdates',mf_private.portal_updates_list(access.partner_id,true));
end $$;

create function mf_private.portal_prepare_upload(p_token text,p_extension text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare access mf_private.portal_links; object_path text;
begin
  access:=mf_private.portal_access(p_token);
  -- Serialize all portal writes with owner assignment/closure/profile operations.
  perform 1 from mf_private.factory where singleton for update;
  access:=mf_private.portal_access(p_token);
  perform 1 from mf_private.partners where id=access.partner_id for update;
  if p_extension is null or p_extension not in ('webp','jpg','jpeg','png') then raise exception 'Formato de imagem inválido.' using errcode='22023'; end if;
  if not exists(select 1 from mf_private.partner_assignments a join mf_private.orders o on o.id=a.order_id where a.partner_id=access.partner_id and o.stage<>'Concluído') then
    raise exception 'Não há ordem aberta atribuída à confecção.' using errcode='22023';
  end if;
  if (select count(*) from mf_private.portal_uploads where link_id=access.id and status='pending' and expires_at>now())>=24
    or (select count(*) from mf_private.portal_uploads where partner_id=access.partner_id and created_at>now()-interval '1 day')>=240 then
    raise exception 'Limite de imagens atingido. Finalize os envios pendentes ou tente mais tarde.' using errcode='22023';
  end if;
  object_path:='portal/'||access.partner_id::text||'/'||gen_random_uuid()::text||'.'||p_extension;
  insert into mf_private.portal_uploads(path,partner_id,link_id) values(object_path,access.partner_id,access.id);
  return jsonb_build_object('path',object_path);
end $$;

create function mf_private.portal_release_upload(p_token text,p_path text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare access mf_private.portal_links; upload mf_private.portal_uploads;
begin
  access:=mf_private.portal_access(p_token);
  perform 1 from mf_private.factory where singleton for update;
  access:=mf_private.portal_access(p_token);
  perform 1 from mf_private.partners where id=access.partner_id for update;
  select * into upload from mf_private.portal_uploads where path=p_path and link_id=access.id for update;
  if not found or upload.status='attached' or exists(select 1 from mf_private.partner_updates where p_path=any(photos)) then
    raise exception 'A imagem não é um envio órfão deste link.' using errcode='42501';
  end if;
  update mf_private.portal_uploads set status='deleting' where path=p_path;
  return jsonb_build_object('released',true);
end $$;

create function mf_private.portal_submit(p_token text,p_request_id uuid,p_update jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare access mf_private.portal_links; ord mf_private.orders; receipt mf_private.partner_updates;
  photos text[]; image text; upload mf_private.portal_uploads; total integer; checked_count integer; defect_count integer;
begin
  access:=mf_private.portal_access(p_token);
  if p_request_id is null or jsonb_typeof(p_update) is distinct from 'object' or octet_length(p_update::text)>16384 then
    raise exception 'Atualização inválida.' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_object_keys(p_update) k where k not in ('orderId','stage','produced','checked','defects','reporter','notes','defectDescription','photos')) then
    raise exception 'Campos de atualização não reconhecidos.' using errcode='22023';
  end if;
  perform 1 from mf_private.factory where singleton for update;
  access:=mf_private.portal_access(p_token);
  perform 1 from mf_private.partners where id=access.partner_id for update;
  select * into receipt from mf_private.partner_updates where request_id=p_request_id;
  if found then
    if receipt.link_id<>access.id or receipt.request_payload<>p_update then raise exception 'Identificador de envio já utilizado.' using errcode='22023'; end if;
    if not exists(select 1 from mf_private.partner_assignments where order_id=receipt.order_id and partner_id=access.partner_id) then raise exception 'Ordem não disponível neste link.' using errcode='42501'; end if;
    return jsonb_build_object('update',mf_private.portal_update_json(receipt),'requestId',p_request_id,'replayed',true);
  end if;
  if (select count(*) from mf_private.partner_updates where link_id=access.id and created_at>now()-interval '1 hour')>=120 then
    raise exception 'Limite de atualizações atingido. Aguarde antes de enviar novamente.' using errcode='22023';
  end if;
  select o.* into ord from mf_private.orders o join mf_private.partner_assignments a on a.order_id=o.id
  where o.id=(p_update->>'orderId')::uuid and a.partner_id=access.partner_id for update of o;
  if not found then raise exception 'Ordem não disponível neste link.' using errcode='42501'; end if;
  if ord.stage='Concluído' then raise exception 'A ordem já foi concluída.' using errcode='22023'; end if;
  if jsonb_typeof(p_update->'produced') is distinct from 'number' or (p_update->>'produced') !~ '^(0|[1-9][0-9]{0,8})$'
    or jsonb_typeof(p_update->'checked') is distinct from 'number' or (p_update->>'checked') !~ '^(0|[1-9][0-9]{0,8})$'
    or jsonb_typeof(p_update->'defects') is distinct from 'number' or (p_update->>'defects') !~ '^(0|[1-9][0-9]{0,8})$' then
    raise exception 'Informe contagens inteiras e não negativas.' using errcode='22023';
  end if;
  total:=(p_update->>'produced')::integer; checked_count:=(p_update->>'checked')::integer; defect_count:=(p_update->>'defects')::integer;
  if total>ord.quantity or checked_count>total or defect_count>checked_count then raise exception 'Contagens incompatíveis com a quantidade da ordem.' using errcode='22023'; end if;
  if p_update->>'stage'='Pronto para retirada' and (total<>ord.quantity or checked_count<>ord.quantity) then
    raise exception 'Para marcar pronto para retirada, produza e confira toda a quantidade da ordem.' using errcode='22023';
  end if;
  if jsonb_typeof(p_update->'stage') is distinct from 'string' or p_update->>'stage' not in ('Recebido','Corte','Costura','Acabamento','Conferência','Pronto para retirada')
    or jsonb_typeof(p_update->'reporter') is distinct from 'string' or coalesce(char_length(btrim(p_update->>'reporter')),0) not between 1 and 100
    or char_length(coalesce(p_update->>'notes',''))>4000 or char_length(coalesce(p_update->>'defectDescription',''))>2000
    or (p_update ? 'notes' and jsonb_typeof(p_update->'notes') is distinct from 'string')
    or (p_update ? 'defectDescription' and jsonb_typeof(p_update->'defectDescription') is distinct from 'string')
    or (defect_count>0 and coalesce(char_length(btrim(p_update->>'defectDescription')),0)=0) then
    raise exception 'Informe etapa, responsável e descrição do defeito válidos.' using errcode='22023';
  end if;
  if p_update ? 'photos' and (jsonb_typeof(p_update->'photos') is distinct from 'array' or jsonb_array_length(p_update->'photos')>6) then raise exception 'Envie até seis fotos.' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(p_update->'photos','[]')) v where jsonb_typeof(v)<>'string') then raise exception 'Caminho de imagem inválido.' using errcode='22023'; end if;
  select coalesce(array_agg(value),'{}') into photos from jsonb_array_elements_text(coalesce(p_update->'photos','[]'));
  if cardinality(photos)<>(select count(distinct v) from unnest(photos) v) then raise exception 'Fotos duplicadas.' using errcode='22023'; end if;
  foreach image in array photos loop
    select * into upload from mf_private.portal_uploads where path=image and partner_id=access.partner_id and link_id=access.id for update;
    if not found or upload.status<>'pending' or upload.expires_at<=now() or not exists(select 1 from storage.objects where bucket_id='confeccao-images' and name=image) then
      raise exception 'Imagem não disponível para este envio.' using errcode='42501';
    end if;
  end loop;
  insert into mf_private.partner_updates(request_id,partner_id,link_id,order_id,stage,produced,checked,defects,reporter,notes,defect_description,photos,request_payload)
  values(p_request_id,access.partner_id,access.id,ord.id,p_update->>'stage',total,checked_count,defect_count,btrim(p_update->>'reporter'),coalesce(p_update->>'notes',''),coalesce(p_update->>'defectDescription',''),photos,p_update) returning * into receipt;
  update mf_private.portal_uploads set status='attached' where path=any(photos);
  return jsonb_build_object('update',mf_private.portal_update_json(receipt),'requestId',p_request_id,'replayed',false);
end $$;

-- Storage receives the capability only as a custom header. Missing/invalid context fails closed.
create function mf_private.portal_storage_access(p_path text,p_action text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare access mf_private.portal_links; headers jsonb;
begin
  begin
    headers:=nullif(current_setting('request.headers',true),'')::jsonb;
    access:=mf_private.portal_access(headers->>'x-confeccao-portal');
  exception when others then return false;
  end;
  if p_action='read' then
    return exists(select 1 from mf_private.models m join mf_private.partner_assignments a on a.partner_id=access.partner_id
      join mf_private.orders o on o.id=a.order_id and o.model_id=m.id where m.image_path=p_path)
      or exists(select 1 from mf_private.partner_updates u join mf_private.partner_assignments a on a.order_id=u.order_id and a.partner_id=access.partner_id
        where u.partner_id=access.partner_id and p_path=any(u.photos));
  elsif p_action='upload' then
    return exists(select 1 from mf_private.portal_uploads u where u.path=p_path and u.link_id=access.id and u.partner_id=access.partner_id and u.status='pending' and u.expires_at>now())
      and exists(select 1 from mf_private.partner_assignments a join mf_private.orders o on o.id=a.order_id where a.partner_id=access.partner_id and o.stage<>'Concluído');
  elsif p_action='delete' then
    return exists(select 1 from mf_private.portal_uploads u where u.path=p_path and u.link_id=access.id and u.partner_id=access.partner_id and u.status='deleting')
      and not exists(select 1 from mf_private.partner_updates u where p_path=any(u.photos));
  end if;
  return false;
end $$;

create function public.mf_portal_owner_state() returns jsonb language sql stable security invoker set search_path='' as $$ select mf_private.portal_owner_state() $$;
create function public.mf_portal_manage(p_command jsonb) returns jsonb language sql security invoker set search_path='' as $$ select mf_private.portal_manage(p_command) $$;
create function public.mf_portal_get(p_token text) returns jsonb language sql stable security invoker set search_path='' as $$ select mf_private.portal_get(p_token) $$;
create function public.mf_portal_submit(p_token text,p_request_id uuid,p_update jsonb) returns jsonb language sql security invoker set search_path='' as $$ select mf_private.portal_submit(p_token,p_request_id,p_update) $$;
create function public.mf_portal_prepare_upload(p_token text,p_extension text) returns jsonb language sql security invoker set search_path='' as $$ select mf_private.portal_prepare_upload(p_token,p_extension) $$;
create function public.mf_portal_release_upload(p_token text,p_path text) returns jsonb language sql security invoker set search_path='' as $$ select mf_private.portal_release_upload(p_token,p_path) $$;

revoke all on function mf_private.portal_updates_immutable(),mf_private.portal_access(text),mf_private.portal_update_json(mf_private.partner_updates),mf_private.portal_orders(uuid),mf_private.portal_updates_list(uuid,boolean),mf_private.portal_owner_state(),mf_private.portal_manage(jsonb),mf_private.portal_get(text),mf_private.portal_submit(text,uuid,jsonb),mf_private.portal_prepare_upload(text,text),mf_private.portal_release_upload(text,text),mf_private.portal_storage_access(text,text) from public,anon,authenticated;
revoke all on function public.mf_portal_owner_state(),public.mf_portal_manage(jsonb),public.mf_portal_get(text),public.mf_portal_submit(text,uuid,jsonb),public.mf_portal_prepare_upload(text,text),public.mf_portal_release_upload(text,text) from public,anon,authenticated;
grant usage on schema mf_private to anon;
grant execute on function mf_private.portal_owner_state(),mf_private.portal_manage(jsonb),public.mf_portal_owner_state(),public.mf_portal_manage(jsonb) to authenticated;
grant execute on function mf_private.portal_get(text),mf_private.portal_submit(text,uuid,jsonb),mf_private.portal_prepare_upload(text,text),mf_private.portal_release_upload(text,text),mf_private.portal_storage_access(text,text),public.mf_portal_get(text),public.mf_portal_submit(text,uuid,jsonb),public.mf_portal_prepare_upload(text,text),public.mf_portal_release_upload(text,text) to anon,authenticated;

-- Owner SELECT policy already includes all images in this private bucket. Guests get no list/sign/update privileges.
grant select,insert,delete on storage.objects to anon;
create policy mf_portal_images_read on storage.objects for select to anon using (
  bucket_id='confeccao-images' and (
    (storage.allow_only_operation('storage.object.get_authenticated') and mf_private.portal_storage_access(name,'read'))
    or ((storage.allow_only_operation('storage.object.delete') or storage.allow_only_operation('storage.object.delete_many')) and mf_private.portal_storage_access(name,'delete'))
  )
);
create policy mf_portal_images_insert on storage.objects for insert to anon
with check(bucket_id='confeccao-images' and storage.allow_only_operation('storage.object.upload') and mf_private.portal_storage_access(name,'upload'));
create policy mf_portal_images_delete on storage.objects for delete to anon
using(bucket_id='confeccao-images' and (storage.allow_only_operation('storage.object.delete') or storage.allow_only_operation('storage.object.delete_many')) and mf_private.portal_storage_access(name,'delete'));
commit;
