-- Inventario de ESTRUTURA. Nao consulta clientes, pedidos, mensagens ou auth.users.
-- Executar com psql -X -q -A -t -v ON_ERROR_STOP=1 -f catalog.sql.
begin transaction isolation level repeatable read read only;

with application_schemas as (
  select n.oid, n.nspname
  from pg_catalog.pg_namespace n
  where n.nspname !~ '^pg_'
    and n.nspname not in (
      'information_schema', 'auth', 'storage', 'realtime', 'extensions',
      'graphql', 'graphql_public', 'supabase_migrations', 'supabase_functions',
      'vault', 'net', 'pgbouncer', 'cron', '_realtime', '_analytics'
    )
), application_relations as (
  select c.*, n.nspname as schema_name
  from pg_catalog.pg_class c
  join application_schemas n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
    and not exists (
      select 1 from pg_catalog.pg_depend d
      where d.classid = 'pg_catalog.pg_class'::regclass
        and d.objid = c.oid and d.deptype = 'e'
    )
)
select jsonb_build_object(
  'captured_at', current_timestamp,
  'server_version', current_setting('server_version'),
  'application_schemas', coalesce((
    select jsonb_agg(nspname order by nspname) from application_schemas
  ), '[]'::jsonb),
  'extensions', coalesce((
    select jsonb_agg(jsonb_build_object('name', e.extname, 'version', e.extversion,
      'schema', n.nspname) order by e.extname)
    from pg_catalog.pg_extension e
    join pg_catalog.pg_namespace n on n.oid = e.extnamespace
  ), '[]'::jsonb),
  'relations', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', c.schema_name, 'name', c.relname, 'kind', c.relkind,
      'row_level_security', c.relrowsecurity, 'force_row_level_security', c.relforcerowsecurity,
      'acl', c.relacl,
      'columns', coalesce((
        select jsonb_agg(jsonb_build_object(
          'name', a.attname, 'type', pg_catalog.format_type(a.atttypid, a.atttypmod),
          'not_null', a.attnotnull, 'identity', a.attidentity, 'generated', a.attgenerated,
          'default', pg_catalog.pg_get_expr(ad.adbin, ad.adrelid), 'acl', a.attacl
        ) order by a.attnum)
        from pg_catalog.pg_attribute a
        left join pg_catalog.pg_attrdef ad on ad.adrelid = a.attrelid and ad.adnum = a.attnum
        where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
      ), '[]'::jsonb),
      'view_definition', case when c.relkind in ('v', 'm')
        then pg_catalog.pg_get_viewdef(c.oid, true) else null end
    ) order by c.schema_name, c.relname) from application_relations c
  ), '[]'::jsonb),
  'constraints', coalesce((
    select jsonb_agg(jsonb_build_object('schema', c.schema_name, 'table', c.relname,
      'name', co.conname, 'definition', pg_catalog.pg_get_constraintdef(co.oid, true),
      'validated', co.convalidated) order by c.schema_name, c.relname, co.conname)
    from pg_catalog.pg_constraint co join application_relations c on c.oid = co.conrelid
  ), '[]'::jsonb),
  'indexes', coalesce((
    select jsonb_agg(jsonb_build_object('schema', c.schema_name, 'table', c.relname,
      'name', i.relname, 'definition', pg_catalog.pg_get_indexdef(i.oid),
      'valid', ix.indisvalid) order by c.schema_name, c.relname, i.relname)
    from pg_catalog.pg_index ix
    join application_relations c on c.oid = ix.indrelid
    join pg_catalog.pg_class i on i.oid = ix.indexrelid
  ), '[]'::jsonb),
  'functions', coalesce((
    select jsonb_agg(jsonb_build_object('schema', n.nspname, 'name', p.proname,
      'arguments', pg_catalog.pg_get_function_identity_arguments(p.oid),
      'definition', pg_catalog.pg_get_functiondef(p.oid), 'acl', p.proacl)
      order by n.nspname, p.proname, p.oid)
    from pg_catalog.pg_proc p join application_schemas n on n.oid = p.pronamespace
    where p.prokind in ('f', 'p', 'w') and not exists (
      select 1 from pg_catalog.pg_depend d
      where d.classid = 'pg_catalog.pg_proc'::regclass
        and d.objid = p.oid and d.deptype = 'e'
    )
  ), '[]'::jsonb),
  'triggers', coalesce((
    select jsonb_agg(jsonb_build_object('schema', n.nspname, 'table', c.relname,
      'name', t.tgname, 'enabled', t.tgenabled,
      'function_schema', fn.nspname, 'function_name', p.proname,
      'definition', pg_catalog.pg_get_triggerdef(t.oid, true))
      order by n.nspname, c.relname, t.tgname)
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    join pg_catalog.pg_proc p on p.oid = t.tgfoid
    join pg_catalog.pg_namespace fn on fn.oid = p.pronamespace
    where not t.tgisinternal and (
      n.oid in (select oid from application_schemas)
      or (n.nspname in ('auth', 'storage', 'realtime')
        and fn.oid in (select oid from application_schemas))
    )
  ), '[]'::jsonb),
  'policies', coalesce((
    select jsonb_agg(to_jsonb(p) order by p.schemaname, p.tablename, p.policyname)
    from pg_catalog.pg_policies p
    where p.schemaname in (select nspname from application_schemas)
      or p.schemaname in ('auth', 'storage', 'realtime')
  ), '[]'::jsonb),
  'types', coalesce((
    select jsonb_agg(jsonb_build_object('schema', n.nspname, 'name', t.typname,
      'kind', t.typtype, 'enum_labels', (
        select jsonb_agg(e.enumlabel order by e.enumsortorder)
        from pg_catalog.pg_enum e where e.enumtypid = t.oid
      )) order by n.nspname, t.typname)
    from pg_catalog.pg_type t join application_schemas n on n.oid = t.typnamespace
    where t.typtype in ('e', 'd', 'c', 'r', 'm')
  ), '[]'::jsonb),
  'default_privileges', coalesce((
    select jsonb_agg(jsonb_build_object('owner', r.rolname, 'schema', n.nspname,
      'object_type', a.defaclobjtype, 'acl', a.defaclacl) order by r.rolname, n.nspname, a.defaclobjtype)
    from pg_catalog.pg_default_acl a
    join pg_catalog.pg_roles r on r.oid = a.defaclrole
    left join pg_catalog.pg_namespace n on n.oid = a.defaclnamespace
    where a.defaclnamespace = 0 or a.defaclnamespace in (select oid from application_schemas)
  ), '[]'::jsonb),
  'publications', coalesce((
    select jsonb_agg(to_jsonb(p) order by p.pubname, p.schemaname, p.tablename)
    from pg_catalog.pg_publication_tables p
    where p.schemaname in (select nspname from application_schemas)
  ), '[]'::jsonb),
  'roles_without_passwords', coalesce((
    select jsonb_agg(jsonb_build_object('name', rolname, 'login', rolcanlogin,
      'bypass_rls', rolbypassrls, 'inherit', rolinherit) order by rolname)
    from pg_catalog.pg_roles where rolname !~ '^pg_'
  ), '[]'::jsonb),
  'excluded_from_export', jsonb_build_array(
    'application row data', 'auth users and passwords', 'storage files and bucket rows',
    'vault secrets', 'auth provider configuration', 'edge functions', 'cron job rows',
    'custom objects inside platform-managed schemas require a separate reviewed diff'
  )
);

commit;
