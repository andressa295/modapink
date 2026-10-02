-- Acesso de atendentes/usuarios limitado ao chat; administradores mantem acesso.
-- Executar no SQL Editor do mesmo Supabase usado pelo painel e pela API.
begin;

create or replace function public.dashboard_is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;
revoke all on function public.dashboard_is_admin() from public;
grant execute on function public.dashboard_is_admin() to authenticated;

-- Evita auto-promocao e remove politicas antigas que consultam profiles recursivamente.
alter table public.profiles enable row level security;
alter table public.profiles alter column role set default 'agent';
do $$
declare p record;
begin
  for p in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
  loop
    execute format('drop policy %I on public.profiles', p.policyname);
  end loop;
end $$;
create policy dashboard_profiles_read on public.profiles
for select to authenticated
using (id = auth.uid() or public.dashboard_is_admin());
create policy dashboard_profiles_insert on public.profiles
for insert to authenticated with check (public.dashboard_is_admin());
create policy dashboard_profiles_update on public.profiles
for update to authenticated
using (public.dashboard_is_admin()) with check (public.dashboard_is_admin());
create policy dashboard_profiles_delete on public.profiles
for delete to authenticated using (public.dashboard_is_admin());

-- Restritivas: combinam com politicas existentes sem permitir acessos antigos amplos.
-- O service_role das integracoes continua operando; tabelas de chat nao sao alteradas.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'orders', 'stores', 'settings', 'store_settings', 'automations',
    'automation_logs', 'agents', 'ratings', 'events'
  ] loop
    if to_regclass(format('public.%I', table_name)) is null then continue; end if;
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists dashboard_admin_guard on public.%I', table_name);
    execute format('create policy dashboard_admin_guard on public.%I as restrictive for all to authenticated using (public.dashboard_is_admin()) with check (public.dashboard_is_admin())', table_name);
    execute format('drop policy if exists dashboard_admin_access on public.%I', table_name);
    execute format('create policy dashboard_admin_access on public.%I for all to authenticated using (public.dashboard_is_admin()) with check (public.dashboard_is_admin())', table_name);
    execute format('drop policy if exists dashboard_anon_guard on public.%I', table_name);
    execute format('create policy dashboard_anon_guard on public.%I as restrictive for all to anon using (false) with check (false)', table_name);
  end loop;
end $$;

-- Impede usuarios comuns de criar, desconectar ou excluir numeros pelo banco.
do $$
declare action text;
begin
  if to_regclass('public.whatsapp_sessions') is null then return; end if;
  alter table public.whatsapp_sessions enable row level security;
  foreach action in array array['insert', 'update', 'delete'] loop
    execute format('drop policy if exists %I on public.whatsapp_sessions', 'dashboard_sessions_' || action);
    if action = 'insert' then
      execute 'create policy dashboard_sessions_insert on public.whatsapp_sessions as restrictive for insert to authenticated with check (public.dashboard_is_admin())';
    elsif action = 'update' then
      execute 'create policy dashboard_sessions_update on public.whatsapp_sessions as restrictive for update to authenticated using (public.dashboard_is_admin()) with check (public.dashboard_is_admin())';
    else
      execute 'create policy dashboard_sessions_delete on public.whatsapp_sessions as restrictive for delete to authenticated using (public.dashboard_is_admin())';
    end if;
  end loop;
end $$;

commit;
