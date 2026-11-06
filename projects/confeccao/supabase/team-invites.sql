-- Additive team invitation support for the dedicated Confecção Moda Pink project.
-- No Auth identity, credential, invitation or application profile is created by this migration.
-- Auth email delivery happens in the trusted Edge Function, outside the database transaction.
begin;

create table mf_private.team_invite_requests (
  request_id uuid primary key,
  actor_id uuid not null references auth.users(id),
  action text not null check(action in ('invite','resend','recovery')),
  email text not null check(char_length(email) between 3 and 254),
  full_name text not null check(char_length(btrim(full_name)) between 1 and 100),
  role text not null check(role in ('admin','gestao','producao','qualidade')),
  -- A frozen Auth identity reference, when present. No cascade can change a ticket's intended identity.
  target_user_id uuid,
  request_input jsonb not null check(octet_length(request_input::text)<=4096),
  status text not null default 'processing' check(status in ('processing','completed','failed','uncertain')),
  failure_reason text check(failure_reason in ('send_failed','send_uncertain','finalization_failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index mf_team_requests_actor_time on mf_private.team_invite_requests(actor_id,created_at desc);
create index mf_team_requests_email_time on mf_private.team_invite_requests(email,created_at desc);
alter table mf_private.team_invite_requests enable row level security;
revoke all on mf_private.team_invite_requests from public,anon,authenticated,service_role;

create function mf_private.assert_team_admin(p_actor_id uuid) returns void
language plpgsql stable security definer set search_path='' as $$
begin
  if p_actor_id is null or not exists(select 1 from public.profiles where id=p_actor_id and active and role='admin') then
    raise exception 'Somente um administrador ativo pode enviar acessos da equipe.' using errcode='42501';
  end if;
end $$;

create function mf_private.team_profile_json(p_user_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',p.id,'full_name',p.full_name,'email',coalesce(u.email,''),'role',p.role,'active',p.active,
    'status',case when not p.active then 'inactive' when u.email_confirmed_at is null then 'invited'
      when coalesce(u.encrypted_password,'')='' then 'awaiting_password' else 'active' end,
    'email_confirmed',u.email_confirmed_at is not null,'password_set',coalesce(u.encrypted_password,'')<>'',
    'invited_at',u.invited_at,'last_sign_in_at',u.last_sign_in_at)
  from public.profiles p join auth.users u on u.id=p.id where p.id=p_user_id
$$;

create function mf_private.team_list() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if mf_private.current_role() is null or mf_private.current_role() not in ('admin','gestao') then
    raise exception 'Sem acesso à equipe.' using errcode='42501';
  end if;
  return (select coalesce(jsonb_agg(mf_private.team_profile_json(p.id) order by p.full_name,p.id),'[]') from public.profiles p);
end $$;

create function mf_private.team_request_json(r mf_private.team_invite_requests,p_can_send boolean,p_replayed boolean) returns jsonb
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
    'target',jsonb_build_object('id',target_id,'email',r.email,'fullName',coalesce(profile->>'full_name',r.full_name),
      'role',coalesce(profile->>'role',r.role),'active',coalesce((profile->>'active')::boolean,false),
      'emailConfirmed',confirmed,'passwordSet',password_present,'hasProfile',profile is not null));
end $$;

create function mf_private.team_prepare(
  p_actor_id uuid,p_request_id uuid,p_action text,p_email text default null,
  p_full_name text default null,p_role text default null,p_user_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare r mf_private.team_invite_requests; input jsonb; target_id uuid; target_email text; target_name text;
  target_role text; target_active boolean; confirmed boolean; password_present boolean; matching integer;
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
      if exists(select 1 from public.profiles where id=target_id) then
        raise exception 'Essa pessoa já tem perfil. Edite o acesso ou use reenvio/recuperação.' using errcode='22023';
      end if;
    end if;
  else
    select p.id,u.email,p.full_name,p.role,p.active,u.email_confirmed_at is not null,coalesce(u.encrypted_password,'')<>''
    into target_id,target_email,target_name,target_role,target_active,confirmed,password_present
    from public.profiles p join auth.users u on u.id=p.id where p.id=p_user_id;
    if not found or not target_active then raise exception 'Pessoa não encontrada ou com acesso inativo.' using errcode='22023'; end if;
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
  insert into mf_private.team_invite_requests(request_id,actor_id,action,email,full_name,role,target_user_id,request_input)
  values(p_request_id,p_actor_id,p_action,target_email,target_name,target_role,target_id,input) returning * into r;
  return mf_private.team_request_json(r,true,false);
end $$;

create function mf_private.team_finish(p_actor_id uuid,p_request_id uuid,p_auth_user_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r mf_private.team_invite_requests; profile jsonb; actual_email text; created_profile boolean:=false;
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
    if profile is null then raise exception 'O perfil foi removido após a conclusão. Confira a equipe.' using errcode='22023'; end if;
    return jsonb_build_object('requestId',r.request_id,'status','completed','profile',profile);
  end if;
  if r.status not in ('processing','uncertain') then raise exception 'Essa solicitação não pode ser finalizada. Faça um novo envio autorizado.' using errcode='22023'; end if;
  profile:=mf_private.team_profile_json(p_auth_user_id);
  if r.action='invite' and profile is null then
    -- Explicit admin authorization is the approval. Auth still verifies email/password normally.
    insert into public.profiles(id,full_name,role,active) values(p_auth_user_id,r.full_name,r.role,true);
    created_profile:=true;
    profile:=mf_private.team_profile_json(p_auth_user_id);
  elsif r.action<>'invite' and (profile is null or not (profile->>'active')::boolean) then
    raise exception 'A pessoa não tem mais um perfil ativo.' using errcode='22023';
  end if;
  -- Existing profiles are never reactivated, renamed or promoted by an invitation/retry.
  update mf_private.team_invite_requests set status='completed',target_user_id=p_auth_user_id,completed_at=now(),failure_reason=null where request_id=r.request_id;
  update mf_private.factory set revision=revision+1 where singleton;
  insert into mf_private.events(actor_id,title,detail) values(p_actor_id,
    case when created_profile then 'Pessoa adicionada à equipe' when r.action='resend' then 'Convite de acesso reenviado'
      when r.action='recovery' then 'Recuperação de senha enviada' else 'Acesso da equipe conferido' end,profile->>'full_name');
  return jsonb_build_object('requestId',r.request_id,'status','completed','profile',profile);
end $$;

create function mf_private.team_fail(p_actor_id uuid,p_request_id uuid,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r mf_private.team_invite_requests;
begin
  perform mf_private.assert_team_admin(p_actor_id);
  perform 1 from mf_private.factory where singleton for update;
  perform mf_private.assert_team_admin(p_actor_id);
  if p_reason is null or p_reason not in ('send_failed','send_uncertain','finalization_failed') then raise exception 'Motivo de falha inválido.' using errcode='22023'; end if;
  select * into r from mf_private.team_invite_requests where request_id=p_request_id for update;
  if not found or r.actor_id<>p_actor_id then raise exception 'Solicitação não encontrada.' using errcode='22023'; end if;
  if r.status<>'completed' then
    update mf_private.team_invite_requests set status=case when p_reason='send_failed' then 'failed' else 'uncertain' end,
      failure_reason=p_reason where request_id=p_request_id returning * into r;
  end if;
  return jsonb_build_object('requestId',r.request_id,'status',r.status);
end $$;

create function public.mf_team_list() returns jsonb language sql stable security invoker set search_path='' as $$ select mf_private.team_list() $$;
create function public.mf_team_prepare(p_actor_id uuid,p_request_id uuid,p_action text,p_email text default null,p_full_name text default null,p_role text default null,p_user_id uuid default null)
returns jsonb language sql security invoker set search_path='' as $$ select mf_private.team_prepare(p_actor_id,p_request_id,p_action,p_email,p_full_name,p_role,p_user_id) $$;
create function public.mf_team_finish(p_actor_id uuid,p_request_id uuid,p_auth_user_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select mf_private.team_finish(p_actor_id,p_request_id,p_auth_user_id) $$;
create function public.mf_team_fail(p_actor_id uuid,p_request_id uuid,p_reason text) returns jsonb language sql security invoker set search_path='' as $$ select mf_private.team_fail(p_actor_id,p_request_id,p_reason) $$;

revoke all on function mf_private.assert_team_admin(uuid),mf_private.team_profile_json(uuid),mf_private.team_request_json(mf_private.team_invite_requests,boolean,boolean),mf_private.team_list(),mf_private.team_prepare(uuid,uuid,text,text,text,text,uuid),mf_private.team_finish(uuid,uuid,uuid),mf_private.team_fail(uuid,uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.mf_team_list(),public.mf_team_prepare(uuid,uuid,text,text,text,text,uuid),public.mf_team_finish(uuid,uuid,uuid),public.mf_team_fail(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function mf_private.team_list(),public.mf_team_list() to authenticated;
grant usage on schema mf_private to service_role;
grant execute on function mf_private.team_prepare(uuid,uuid,text,text,text,text,uuid),mf_private.team_finish(uuid,uuid,uuid),mf_private.team_fail(uuid,uuid,text),public.mf_team_prepare(uuid,uuid,text,text,text,text,uuid),public.mf_team_finish(uuid,uuid,uuid),public.mf_team_fail(uuid,uuid,text) to service_role;

-- Harden the existing profile editor without changing its contract or last-admin rule.
create or replace function mf_private.set_profile(p_user_id uuid,p_full_name text,p_role text,p_active boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.profiles;
begin
  if mf_private.current_role() is distinct from 'admin' then raise exception 'Somente um administrador pode alterar acessos.' using errcode='42501'; end if;
  perform 1 from mf_private.factory where singleton for update;
  if mf_private.current_role() is distinct from 'admin' then raise exception 'Somente um administrador pode alterar acessos.' using errcode='42501'; end if;
  select * into target from public.profiles where id=p_user_id for update;
  if not found then raise exception 'Perfil não encontrado. O cadastro da identidade deve ser feito pelo administrador do projeto.' using errcode='22023'; end if;
  if target.active and target.role='admin' and (not p_active or p_role<>'admin') and not exists(select 1 from public.profiles where id<>p_user_id and active and role='admin') then raise exception 'Mantenha pelo menos um administrador ativo.' using errcode='22023'; end if;
  update public.profiles set full_name=btrim(p_full_name),role=p_role,active=p_active,updated_at=now() where id=p_user_id;
  update mf_private.factory set revision=revision+1 where singleton;
  insert into mf_private.events(actor_id,title,detail) values(auth.uid(),'Acesso atualizado',p_user_id::text||' · '||p_role||' · ativo='||p_active);
  return mf_private.list_profiles();
end $$;
commit;
