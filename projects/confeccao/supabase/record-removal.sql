-- Additive soft removal. Apply after core, portal, portal image fix and team invitations.
-- No physical Auth/Storage deletion or historical movement/update deletion is performed.
begin;

alter table mf_private.materials add column archived_at timestamptz,add column archived_by uuid references auth.users(id);
alter table mf_private.models add column archived_at timestamptz,add column archived_by uuid references auth.users(id);
alter table mf_private.orders add column archived_at timestamptz,add column archived_by uuid references auth.users(id);
alter table mf_private.partners add column archived_at timestamptz,add column archived_by uuid references auth.users(id);
alter table public.profiles add column archived_at timestamptz,add column archived_by uuid references auth.users(id);
create index mf_materials_archiver on mf_private.materials(archived_by);
create index mf_models_archiver on mf_private.models(archived_by);
create index mf_orders_archiver on mf_private.orders(archived_by);
create index mf_partners_archiver on mf_private.partners(archived_by);
create index mf_profiles_archiver on public.profiles(archived_by);

-- Wrong entries can be entered again while old foreign keys and snapshots remain intact.
drop index mf_private.mf_material_identity;
create unique index mf_material_identity on mf_private.materials(lower(name),lower(color),lower(lot)) where archived_at is null;
drop index mf_private.mf_model_reference;
create unique index mf_model_reference on mf_private.models(lower(reference)) where archived_at is null;
drop index mf_private.mf_partners_name;
create unique index mf_partners_name on mf_private.partners(lower(name)) where archived_at is null;
alter table mf_private.movements drop constraint movements_kind_check;
alter table mf_private.movements add constraint movements_kind_check check(kind in ('Entrada','Perda','Reserva','Consumo','Liberação'));

-- Preserve the installed validation implementation once, behind private functions with no caller grants.
-- Wrappers below add archive guards/filters without duplicating or weakening its transactional rules.
do $$
declare item record; source_oid regprocedure; definition text; copied text;
begin
  for item in select * from (values
    ('get_state',''),('apply_command','jsonb,uuid'),('portal_owner_state',''),('portal_manage','jsonb'),
    ('portal_prepare_upload','text,text'),('portal_submit','text,uuid,jsonb'),('set_profile','uuid,text,text,boolean')
  ) v(name,args) loop
    source_oid:=to_regprocedure('mf_private.'||item.name||'('||item.args||')');
    if source_oid is null then raise exception 'Missing prerequisite function: %',item.name; end if;
    definition:=pg_get_functiondef(source_oid);
    copied:=replace(definition,'FUNCTION mf_private.'||item.name||'(','FUNCTION mf_private.pre_remove_'||item.name||'(');
    if copied=definition then raise exception 'Could not preserve prerequisite function: %',item.name; end if;
    execute copied;
    execute 'revoke all on function mf_private.pre_remove_'||item.name||'('||item.args||') from public,anon,authenticated,service_role';
  end loop;
end $$;

create or replace function mf_private.current_role() returns text language sql stable security definer set search_path='' as $$
  select p.role from public.profiles p where p.id=(select auth.uid()) and p.active and p.archived_at is null and auth.uid() is not null
$$;
create or replace function mf_private.get_profile() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.profiles;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.' using errcode='42501'; end if;
  select * into p from public.profiles where id=auth.uid() and active and archived_at is null;
  if not found then raise exception 'Seu acesso à confecção não está ativo.' using errcode='42501'; end if;
  return jsonb_build_object('id',p.id,'name',p.full_name,'role',p.role,'active',p.active);
end $$;
create or replace function mf_private.list_profiles() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if mf_private.current_role() is null or mf_private.current_role() not in ('admin','gestao') then raise exception 'Sem acesso à equipe.' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'full_name',full_name,'role',role,'active',active) order by full_name),'[]') from public.profiles where archived_at is null);
end $$;
create or replace function mf_private.set_profile(p_user_id uuid,p_full_name text,p_role text,p_active boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if mf_private.current_role() is distinct from 'admin' then raise exception 'Somente um administrador pode alterar acessos.' using errcode='42501'; end if;
  perform 1 from mf_private.factory where singleton for update;
  if mf_private.current_role() is distinct from 'admin' then raise exception 'Somente um administrador pode alterar acessos.' using errcode='42501'; end if;
  if exists(select 1 from public.profiles where id=p_user_id and archived_at is not null) then raise exception 'Esse acesso foi removido. Faça um novo convite para cadastrá-lo novamente.' using errcode='22023'; end if;
  return mf_private.pre_remove_set_profile(p_user_id,p_full_name,p_role,p_active);
end $$;

create or replace function mf_private.get_state() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare answer jsonb; state jsonb;
begin
  answer:=mf_private.pre_remove_get_state(); state:=answer->'state';
  state:=jsonb_set(state,'{orders}',coalesce((select jsonb_agg(x.value order by x.ordinality) from jsonb_array_elements(state->'orders') with ordinality x
    join mf_private.orders o on o.code=x.value->>'id' where o.archived_at is null),'[]'));
  state:=jsonb_set(state,'{inspections}',coalesce((select jsonb_agg(x.value order by x.ordinality) from jsonb_array_elements(state->'inspections') with ordinality x
    join mf_private.orders o on o.code=x.value->>'orderId' where o.archived_at is null),'[]'));
  state:=jsonb_set(state,'{models}',coalesce((select jsonb_agg(x.value||jsonb_build_object('archived',m.archived_at is not null) order by x.ordinality)
    from jsonb_array_elements(state->'models') with ordinality x join mf_private.models m on m.id=(x.value->>'id')::uuid
    where m.archived_at is null or exists(select 1 from mf_private.orders o where o.model_id=m.id and o.archived_at is null)),'[]'));
  state:=jsonb_set(state,'{materials}',coalesce((select jsonb_agg(x.value||jsonb_build_object('archived',m.archived_at is not null) order by x.ordinality)
    from jsonb_array_elements(state->'materials') with ordinality x join mf_private.materials m on m.id=(x.value->>'id')::uuid
    where m.archived_at is null or exists(select 1 from mf_private.orders o where o.material_id=m.id and o.archived_at is null)
      or exists(select 1 from mf_private.models model where model.material_id=m.id and (model.archived_at is null
        or exists(select 1 from mf_private.orders o where o.model_id=model.id and o.archived_at is null)))),'[]'));
  state:=jsonb_set(state,'{dailyApprovals}',coalesce((select jsonb_agg(jsonb_build_object('date',a.approval_date,'quantity',a.quantity) order by a.approval_date)
    from (select approval_date,sum(quantity)::integer quantity from (
      select i.date approval_date,i.quantity from mf_private.inspections i join mf_private.orders o on o.id=i.order_id where i.result='Aprovadas' and o.archived_at is null
      union all select (i.resolved_at at time zone 'America/Sao_Paulo')::date,i.quantity from mf_private.inspections i join mf_private.orders o on o.id=i.order_id
        where i.result='Retrabalho' and i.resolved and o.archived_at is null) approved group by approval_date) a),'[]'));
  return jsonb_set(answer,'{state}',state);
end $$;

create or replace function mf_private.apply_command(p_command jsonb,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare typ text; data jsonb;
begin
  perform mf_private.get_profile();
  if p_command is null or jsonb_typeof(p_command)<>'object' or octet_length(p_command::text)>20000 then raise exception 'Comando inválido.' using errcode='22023'; end if;
  perform 1 from mf_private.factory where singleton for update;
  perform mf_private.get_profile();
  -- An acknowledged old request remains a receipt; it cannot repeat a mutation of an archived row.
  if exists(select 1 from mf_private.command_receipts where request_id=p_request_id) then return mf_private.pre_remove_apply_command(p_command,p_request_id); end if;
  typ:=p_command->>'type'; data:=p_command->'payload';
  if typ='create_model' and exists(select 1 from mf_private.materials where id=(data->>'materialId')::uuid and archived_at is not null) then raise exception 'O material foi excluído. Selecione um material ativo.' using errcode='22023'; end if;
  if typ='create_order' and (exists(select 1 from mf_private.materials where id=(data->>'materialId')::uuid and archived_at is not null)
    or exists(select 1 from mf_private.models m join mf_private.materials base on base.id=m.material_id where m.id=(data->>'modelId')::uuid and (m.archived_at is not null or base.archived_at is not null))) then
    raise exception 'A ficha ou seu material foi excluído. Cadastre uma ficha com material ativo para abrir outra ordem.' using errcode='22023';
  end if;
  if typ='move_material' and exists(select 1 from mf_private.materials where id=(data->>'id')::uuid and archived_at is not null) then raise exception 'O material foi excluído.' using errcode='22023'; end if;
  if typ='update_model_image' and exists(select 1 from mf_private.models where id=(data->>'id')::uuid and archived_at is not null) then raise exception 'A ficha foi excluída.' using errcode='22023'; end if;
  if typ in ('advance_order','inspect_order') and exists(select 1 from mf_private.orders where code=data->>'orderId' and archived_at is not null) then raise exception 'A produção foi excluída.' using errcode='22023'; end if;
  if typ='resolve_inspection' and exists(select 1 from mf_private.inspections i join mf_private.orders o on o.id=i.order_id where i.id=(data->>'id')::uuid and o.archived_at is not null) then raise exception 'A produção foi excluída.' using errcode='22023'; end if;
  return mf_private.pre_remove_apply_command(p_command,p_request_id);
end $$;

create or replace function mf_private.portal_orders(p_partner_id uuid default null) returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'code',o.code,
    'model',jsonb_build_object('id',o.model_id,'name',o.model_snapshot->>'name','reference',o.model_snapshot->>'reference','image',m.image_path),
    'quantity',o.quantity,'variants',(select coalesce(jsonb_agg(jsonb_build_object('size',v.size,'quantity',v.quantity) order by v.size),'[]') from mf_private.order_variants v where v.order_id=o.id),
    'stage',o.stage,'due',o.due,'priority',o.priority) order by o.due,o.id),'[]')
  from mf_private.orders o join mf_private.models m on m.id=o.model_id where o.archived_at is null
    and (p_partner_id is null or exists(select 1 from mf_private.partner_assignments a join mf_private.partners p on p.id=a.partner_id where a.order_id=o.id and a.partner_id=p_partner_id and p.archived_at is null))
$$;
create or replace function mf_private.portal_updates_list(p_partner_id uuid,p_latest boolean) returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(mf_private.portal_update_json(rows.entry) order by (rows.entry).created_at desc,(rows.entry).id),'[]') from (
    select u as entry from mf_private.partner_updates u join mf_private.orders o on o.id=u.order_id join mf_private.partners p on p.id=u.partner_id
    where o.archived_at is null and p.archived_at is null
      and (p_partner_id is null or (u.partner_id=p_partner_id and exists(select 1 from mf_private.partner_assignments a where a.order_id=u.order_id and a.partner_id=p_partner_id)))
      and (not p_latest or not exists(select 1 from mf_private.partner_updates newer where newer.partner_id=u.partner_id and newer.order_id=u.order_id and (newer.created_at,newer.id)>(u.created_at,u.id)))
    order by u.created_at desc,u.id limit case when p_latest then null else 200 end
  ) rows
$$;
create or replace function mf_private.portal_owner_state() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare answer jsonb;
begin
  answer:=mf_private.pre_remove_portal_owner_state();
  answer:=jsonb_set(answer,'{partners}',coalesce((select jsonb_agg(x.value order by x.ordinality) from jsonb_array_elements(answer->'partners') with ordinality x join mf_private.partners p on p.id=(x.value->>'id')::uuid where p.archived_at is null),'[]'));
  answer:=jsonb_set(answer,'{assignments}',coalesce((select jsonb_agg(x.value order by x.ordinality) from jsonb_array_elements(answer->'assignments') with ordinality x
    join mf_private.partners p on p.id=(x.value->>'partnerId')::uuid join mf_private.orders o on o.id=(x.value->>'orderId')::uuid where p.archived_at is null and o.archived_at is null),'[]'));
  answer:=jsonb_set(answer,'{links}',coalesce((select jsonb_agg(x.value order by x.ordinality) from jsonb_array_elements(answer->'links') with ordinality x join mf_private.partners p on p.id=(x.value->>'partnerId')::uuid where p.archived_at is null),'[]'));
  return answer;
end $$;
create or replace function mf_private.portal_manage(p_command jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare data jsonb;
begin
  if mf_private.current_role() is null or mf_private.current_role() not in ('admin','gestao') then raise exception 'Apenas administração e gestão podem gerenciar confecções.' using errcode='42501'; end if;
  perform 1 from mf_private.factory where singleton for update;
  if mf_private.current_role() is null or mf_private.current_role() not in ('admin','gestao') then raise exception 'Apenas administração e gestão podem gerenciar confecções.' using errcode='42501'; end if;
  data:=p_command->'payload';
  if exists(select 1 from mf_private.partners where id=coalesce(nullif(data->>'partnerId',''),nullif(data->>'id',''))::uuid and archived_at is not null) then raise exception 'A confecção foi excluída.' using errcode='22023'; end if;
  if p_command->>'type'='assign_order' and exists(select 1 from mf_private.orders where id=(data->>'orderId')::uuid and archived_at is not null) then raise exception 'A produção foi excluída.' using errcode='22023'; end if;
  return mf_private.pre_remove_portal_manage(p_command);
end $$;
create or replace function mf_private.portal_prepare_upload(p_token text,p_extension text) returns jsonb language plpgsql security definer set search_path='' as $$
declare access mf_private.portal_links;
begin
  access:=mf_private.portal_access(p_token);
  perform 1 from mf_private.factory where singleton for update;
  access:=mf_private.portal_access(p_token);
  if not exists(select 1 from mf_private.partner_assignments a join mf_private.orders o on o.id=a.order_id where a.partner_id=access.partner_id and o.archived_at is null and o.stage<>'Concluído') then raise exception 'Não há ordem aberta atribuída à confecção.' using errcode='22023'; end if;
  return mf_private.pre_remove_portal_prepare_upload(p_token,p_extension);
end $$;
create or replace function mf_private.portal_submit(p_token text,p_request_id uuid,p_update jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform mf_private.portal_access(p_token);
  perform 1 from mf_private.factory where singleton for update;
  perform mf_private.portal_access(p_token);
  if exists(select 1 from mf_private.orders where id=(p_update->>'orderId')::uuid and archived_at is not null) then raise exception 'A produção foi excluída.' using errcode='42501'; end if;
  return mf_private.pre_remove_portal_submit(p_token,p_request_id,p_update);
end $$;
-- Keep the canonical Storage header context, adding only archive scope checks.
create or replace function mf_private.portal_storage_access(p_path text,p_action text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare access mf_private.portal_links; headers jsonb;
begin
  begin
    headers:=nullif(current_setting('request.headers',true),'')::jsonb;
    access:=mf_private.portal_access(headers->>'x-confeccao-portal');
  exception when others then return false;
  end;
  if p_action='read' then
    return exists(select 1 from mf_private.models m join mf_private.partner_assignments a on a.partner_id=access.partner_id join mf_private.orders o on o.id=a.order_id and o.model_id=m.id
      where m.image_path=p_path and o.archived_at is null)
      or exists(select 1 from mf_private.partner_updates u join mf_private.partner_assignments a on a.order_id=u.order_id and a.partner_id=access.partner_id join mf_private.orders o on o.id=u.order_id
        where u.partner_id=access.partner_id and p_path=any(u.photos) and o.archived_at is null);
  elsif p_action='upload' then
    return exists(select 1 from mf_private.portal_uploads u where u.path=p_path and u.link_id=access.id and u.partner_id=access.partner_id and u.status='pending' and u.expires_at>now())
      and exists(select 1 from mf_private.partner_assignments a join mf_private.orders o on o.id=a.order_id where a.partner_id=access.partner_id and o.stage<>'Concluído' and o.archived_at is null);
  elsif p_action='delete' then
    return exists(select 1 from mf_private.portal_uploads u where u.path=p_path and u.link_id=access.id and u.partner_id=access.partner_id and u.status='deleting')
      and not exists(select 1 from mf_private.partner_updates u where p_path=any(u.photos));
  end if;
  return false;
end $$;

create function mf_private.remove_record(p_entity text,p_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_role text; m mf_private.materials; model mf_private.models; ord mf_private.orders; partner mf_private.partners; member public.profiles;
  released numeric(16,3); event_title text; event_detail text;
begin
  perform mf_private.get_profile();
  if p_entity is null or p_entity not in ('material','model','order','partner','member') or coalesce(char_length(p_id),0) not between 1 and 100 then raise exception 'Registro inválido.' using errcode='22023'; end if;
  perform 1 from mf_private.factory where singleton for update;
  actor_role:=mf_private.current_role();
  if actor_role is null or actor_role not in ('admin','gestao') or (p_entity='member' and actor_role<>'admin') then raise exception 'Sem permissão para excluir esse registro.' using errcode='42501'; end if;
  case p_entity
  when 'material' then
    select * into m from mf_private.materials where id=p_id::uuid for update;
    if not found then raise exception 'Material não encontrado.' using errcode='22023'; end if;
    if m.archived_at is not null then return jsonb_build_object('entity',p_entity,'id',p_id,'removed',true); end if;
    update mf_private.materials set archived_at=clock_timestamp(),archived_by=auth.uid() where id=m.id;
    event_title:='Material excluído'; event_detail:=m.name||' · lote '||m.lot;
  when 'model' then
    select * into model from mf_private.models where id=p_id::uuid for update;
    if not found then raise exception 'Ficha não encontrada.' using errcode='22023'; end if;
    if model.archived_at is not null then return jsonb_build_object('entity',p_entity,'id',p_id,'removed',true); end if;
    update mf_private.models set archived_at=clock_timestamp(),archived_by=auth.uid() where id=model.id;
    event_title:='Ficha excluída'; event_detail:=model.reference||' · '||model.name;
  when 'order' then
    select * into ord from mf_private.orders where code=p_id for update;
    if not found then raise exception 'Produção não encontrada.' using errcode='22023'; end if;
    if ord.archived_at is not null then return jsonb_build_object('entity',p_entity,'id',p_id,'removed',true); end if;
    released:=ord.reserved;
    if released>0 then
      select * into m from mf_private.materials where id=ord.material_id for update;
      if m.reserved<released then raise exception 'Reserva inconsistente. Confira o estoque antes de excluir.' using errcode='22023'; end if;
      update mf_private.materials set reserved=reserved-released where id=m.id returning * into m;
      insert into mf_private.movements(material_id,order_id,kind,amount,physical_after,reserved_after,note,actor_id)
      values(m.id,ord.id,'Liberação',released,m.quantity,m.reserved,'Reserva liberada pela exclusão da produção '||ord.code,auth.uid());
    end if;
    update mf_private.orders set reserved=0,archived_at=clock_timestamp(),archived_by=auth.uid() where id=ord.id;
    event_title:='Produção excluída'; event_detail:=ord.code||' · histórico preservado';
  when 'partner' then
    select * into partner from mf_private.partners where id=p_id::uuid for update;
    if not found then raise exception 'Confecção não encontrada.' using errcode='22023'; end if;
    if partner.archived_at is not null then return jsonb_build_object('entity',p_entity,'id',p_id,'removed',true); end if;
    update mf_private.partners set active=false,archived_at=clock_timestamp(),archived_by=auth.uid() where id=partner.id;
    update mf_private.portal_links set revoked_at=now() where partner_id=partner.id and revoked_at is null;
    event_title:='Confecção excluída'; event_detail:=partner.name;
  when 'member' then
    if p_id::uuid=auth.uid() then raise exception 'Você não pode excluir o próprio acesso.' using errcode='22023'; end if;
    select * into member from public.profiles where id=p_id::uuid for update;
    if not found then raise exception 'Pessoa não encontrada.' using errcode='22023'; end if;
    if member.archived_at is not null then return jsonb_build_object('entity',p_entity,'id',p_id,'removed',true); end if;
    if member.active and member.role='admin' and not exists(select 1 from public.profiles where id<>member.id and active and role='admin' and archived_at is null) then raise exception 'Mantenha pelo menos um administrador ativo.' using errcode='22023'; end if;
    update public.profiles set active=false,archived_at=clock_timestamp(),archived_by=auth.uid(),updated_at=now() where id=member.id;
    event_title:='Pessoa removida da equipe'; event_detail:=member.full_name;
  end case;
  update mf_private.factory set revision=revision+1 where singleton;
  insert into mf_private.events(actor_id,title,detail) values(auth.uid(),event_title,event_detail);
  return jsonb_build_object('entity',p_entity,'id',p_id,'removed',true);
end $$;
create function public.mf_remove_record(p_entity text,p_id text) returns jsonb language sql security invoker set search_path='' as $$ select mf_private.remove_record(p_entity,p_id) $$;
revoke all on function mf_private.remove_record(text,text),public.mf_remove_record(text,text) from public,anon,authenticated,service_role;
grant execute on function mf_private.remove_record(text,text),public.mf_remove_record(text,text) to authenticated;

-- Team restoration functions are appended below before the migration commit.

-- Append inside record-removal.sql, after profiles.archived_at/archived_by exist and before COMMIT.
-- CREATE OR REPLACE retains the existing service-only and authenticated execution ACLs.
alter table mf_private.team_invite_requests
  add column restore_archived boolean not null default false,
  add column restore_archived_at timestamptz,
  add constraint mf_team_restore_intent_complete check(restore_archived=(restore_archived_at is not null));

create or replace function mf_private.team_profile_json(p_user_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',p.id,'full_name',p.full_name,'email',coalesce(u.email,''),'role',p.role,'active',p.active,
    'archived',p.archived_at is not null,
    'status',case when p.archived_at is not null then 'archived' when not p.active then 'inactive' when u.email_confirmed_at is null then 'invited'
      when coalesce(u.encrypted_password,'')='' then 'awaiting_password' else 'active' end,
    'email_confirmed',u.email_confirmed_at is not null,'password_set',coalesce(u.encrypted_password,'')<>'',
    'invited_at',u.invited_at,'last_sign_in_at',u.last_sign_in_at)
  from public.profiles p join auth.users u on u.id=p.id where p.id=p_user_id
$$;

create or replace function mf_private.team_list() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if mf_private.current_role() is null or mf_private.current_role() not in ('admin','gestao') then
    raise exception 'Sem acesso à equipe.' using errcode='42501';
  end if;
  return (select coalesce(jsonb_agg(mf_private.team_profile_json(p.id) order by p.full_name,p.id),'[]') from public.profiles p where p.archived_at is null);
end $$;

create or replace function mf_private.team_request_json(r mf_private.team_invite_requests,p_can_send boolean,p_replayed boolean) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target_id uuid; matching integer; profile jsonb; confirmed boolean:=false; password_present boolean:=false;
begin
  select count(*)::integer into matching from auth.users
  where lower(email)=r.email and (r.target_user_id is null or id=r.target_user_id);
  if matching>1 then raise exception 'Há mais de uma identidade para esse e-mail. Confira o Auth do projeto.' using errcode='22023'; end if;
  if matching=1 then
    select id,email_confirmed_at is not null,coalesce(encrypted_password,'')<>'' into target_id,confirmed,password_present
    from auth.users where lower(email)=r.email and (r.target_user_id is null or id=r.target_user_id);
    profile:=mf_private.team_profile_json(target_id);
  end if;
  return jsonb_build_object('requestId',r.request_id,'action',r.action,'status',r.status,'canSend',p_can_send,'replayed',p_replayed,
    'target',jsonb_build_object('id',target_id,'email',r.email,'fullName',case when r.restore_archived and coalesce((profile->>'archived')::boolean,false) then r.full_name else coalesce(profile->>'full_name',r.full_name) end,
      'role',case when r.restore_archived and coalesce((profile->>'archived')::boolean,false) then r.role else coalesce(profile->>'role',r.role) end,
      'active',coalesce((profile->>'active')::boolean,false),'archived',coalesce((profile->>'archived')::boolean,false),
      'emailConfirmed',confirmed,'passwordSet',password_present,'hasProfile',profile is not null));
end $$;

create or replace function mf_private.team_prepare(
  p_actor_id uuid,p_request_id uuid,p_action text,p_email text default null,
  p_full_name text default null,p_role text default null,p_user_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare r mf_private.team_invite_requests; input jsonb; target_id uuid; target_email text; target_name text;
  target_role text; target_active boolean; target_archived boolean:=false; restore_archived boolean:=false; restore_at timestamptz;
  confirmed boolean; password_present boolean; matching integer;
begin
  perform mf_private.assert_team_admin(p_actor_id);
  if p_request_id is null or p_action is null or p_action not in ('invite','resend','recovery') then raise exception 'Solicitação inválida.' using errcode='22023'; end if;
  if p_action='invite' then
    target_email:=lower(btrim(p_email)); target_name:=btrim(p_full_name); target_role:=p_role;
    if p_user_id is not null or coalesce(char_length(target_email),0) not between 3 and 254
      or target_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or target_email ~ '[[:cntrl:]]'
      or coalesce(char_length(target_name),0) not between 1 and 100
      or target_role is null or target_role not in ('admin','gestao','producao','qualidade') then
      raise exception 'Informe nome, e-mail e papel válidos.' using errcode='22023';
    end if;
    input:=jsonb_build_object('action',p_action,'email',target_email,'fullName',target_name,'role',target_role);
  else
    if p_user_id is null then raise exception 'Selecione uma pessoa da equipe.' using errcode='22023'; end if;
    input:=jsonb_build_object('action',p_action,'userId',p_user_id);
  end if;
  perform 1 from mf_private.factory where singleton for update;
  perform mf_private.assert_team_admin(p_actor_id);
  select * into r from mf_private.team_invite_requests where request_id=p_request_id for update;
  if found then
    if r.actor_id<>p_actor_id or r.request_input<>input then raise exception 'Identificador de solicitação já utilizado.' using errcode='22023'; end if;
    -- A replay never authorizes another email, including processing/uncertain requests.
    return mf_private.team_request_json(r,false,true);
  end if;
  if p_action='invite' then
    select count(*)::integer into matching from auth.users where lower(email)=target_email;
    if matching>1 then raise exception 'Há mais de uma identidade para esse e-mail. Confira o Auth do projeto.' using errcode='22023'; end if;
    if matching=1 then
      select id into target_id from auth.users where lower(email)=target_email;
      select archived_at is not null,archived_at into target_archived,restore_at from public.profiles where id=target_id;
      if found then
        if not target_archived then
          raise exception 'Essa pessoa já tem perfil. Edite o acesso ou use reenvio/recuperação.' using errcode='22023';
        end if;
        -- This new explicit invitation authorizes only the currently archived membership.
        restore_archived:=true;
      end if;
    end if;
  else
    select p.id,u.email,p.full_name,p.role,p.active,p.archived_at is not null,u.email_confirmed_at is not null,coalesce(u.encrypted_password,'')<>''
    into target_id,target_email,target_name,target_role,target_active,target_archived,confirmed,password_present
    from public.profiles p join auth.users u on u.id=p.id where p.id=p_user_id;
    if not found or not target_active or target_archived then raise exception 'Pessoa não encontrada, removida ou com acesso inativo.' using errcode='22023'; end if;
    target_email:=lower(btrim(target_email));
    if target_email is null or target_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'A identidade não tem e-mail válido.' using errcode='22023'; end if;
    if p_action='resend' and password_present then raise exception 'Essa pessoa já definiu senha. Use recuperação de senha.' using errcode='22023'; end if;
    if p_action='recovery' and (not confirmed or not password_present) then raise exception 'A pessoa ainda precisa concluir o primeiro acesso. Use reenvio.' using errcode='22023'; end if;
  end if;
  if (select count(*) from mf_private.team_invite_requests where actor_id=p_actor_id and created_at>now()-interval '1 hour')>=20 then
    raise exception 'Limite de envios da equipe atingido. Aguarde para tentar novamente.' using errcode='P0001',detail='team_rate_limit';
  end if;
  if exists(select 1 from mf_private.team_invite_requests where email=target_email and created_at>now()-interval '60 seconds') then
    raise exception 'Aguarde 60 segundos antes de enviar novamente para essa pessoa.' using errcode='P0001',detail='team_cooldown';
  end if;
  insert into mf_private.team_invite_requests(request_id,actor_id,action,email,full_name,role,target_user_id,request_input,restore_archived,restore_archived_at)
  values(p_request_id,p_actor_id,p_action,target_email,target_name,target_role,target_id,input,restore_archived,restore_at) returning * into r;
  return mf_private.team_request_json(r,true,false);
end $$;

create or replace function mf_private.team_finish(p_actor_id uuid,p_request_id uuid,p_auth_user_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r mf_private.team_invite_requests; profile jsonb; actual_email text; created_profile boolean:=false; restored_profile boolean:=false; removed_at timestamptz;
begin
  perform mf_private.assert_team_admin(p_actor_id);
  perform 1 from mf_private.factory where singleton for update;
  perform mf_private.assert_team_admin(p_actor_id);
  select * into r from mf_private.team_invite_requests where request_id=p_request_id for update;
  if not found or r.actor_id<>p_actor_id then raise exception 'Solicitação não encontrada.' using errcode='22023'; end if;
  if p_auth_user_id is null or (r.target_user_id is not null and r.target_user_id<>p_auth_user_id) then raise exception 'Identidade diferente da solicitação.' using errcode='22023'; end if;
  select lower(email) into actual_email from auth.users where id=p_auth_user_id for update;
  if not found or actual_email is distinct from r.email then raise exception 'O e-mail da identidade não corresponde à solicitação.' using errcode='22023'; end if;
  if r.status='completed' then
    profile:=mf_private.team_profile_json(p_auth_user_id);
    if profile is null or coalesce((profile->>'archived')::boolean,false) then raise exception 'O perfil foi removido após a conclusão. Faça um novo convite autorizado.' using errcode='22023'; end if;
    return jsonb_build_object('requestId',r.request_id,'status','completed','profile',profile);
  end if;
  if r.status not in ('processing','uncertain') then raise exception 'Essa solicitação não pode ser finalizada. Faça um novo envio autorizado.' using errcode='22023'; end if;
  profile:=mf_private.team_profile_json(p_auth_user_id);
  if r.action='invite' and profile is null then
    if r.restore_archived then raise exception 'O perfil arquivado não está disponível para restauração.' using errcode='22023'; end if;
    -- Explicit admin authorization is the approval. Auth still verifies email/password normally.
    insert into public.profiles(id,full_name,role,active) values(p_auth_user_id,r.full_name,r.role,true);
    created_profile:=true;
    profile:=mf_private.team_profile_json(p_auth_user_id);
  elsif r.action='invite' and coalesce((profile->>'archived')::boolean,false) then
    if not r.restore_archived then
      raise exception 'A pessoa foi removida após esta solicitação. Faça um novo convite autorizado.' using errcode='22023';
    end if;
    select archived_at into removed_at from public.profiles where id=p_auth_user_id for update;
    -- A subsequent removal invalidates even a prior restoration ticket.
    if removed_at is null or removed_at is distinct from r.restore_archived_at then
      raise exception 'A pessoa foi removida após esta solicitação. Faça um novo convite autorizado.' using errcode='22023';
    end if;
    update public.profiles set full_name=r.full_name,role=r.role,active=true,
      archived_at=null,archived_by=null,updated_at=now() where id=p_auth_user_id;
    restored_profile:=true;
    profile:=mf_private.team_profile_json(p_auth_user_id);
  elsif r.action<>'invite' and (profile is null or not (profile->>'active')::boolean or coalesce((profile->>'archived')::boolean,false)) then
    raise exception 'A pessoa não tem mais um perfil ativo.' using errcode='22023';
  end if;
  -- Non-archived profiles are never reactivated, renamed or promoted by invitation/retry.
  update mf_private.team_invite_requests set status='completed',target_user_id=p_auth_user_id,completed_at=now(),failure_reason=null where request_id=r.request_id;
  update mf_private.factory set revision=revision+1 where singleton;
  insert into mf_private.events(actor_id,title,detail) values(p_actor_id,
    case when restored_profile then 'Pessoa readicionada à equipe' when created_profile then 'Pessoa adicionada à equipe' when r.action='resend' then 'Convite de acesso reenviado'
      when r.action='recovery' then 'Recuperação de senha enviada' else 'Acesso da equipe conferido' end,profile->>'full_name');
  return jsonb_build_object('requestId',r.request_id,'status','completed','profile',profile);
end $$;

commit;
