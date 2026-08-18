create table if not exists public.store_settings (
  store_key text primary key,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null
);

alter table public.store_settings
  add column if not exists settings jsonb not null default '{}'::jsonb;

alter table public.store_settings
  add column if not exists updated_at timestamptz not null default now();

alter table public.store_settings
  add column if not exists updated_by uuid null references auth.users(id) on delete set null;

alter table public.store_settings enable row level security;

create unique index if not exists store_settings_store_key_unique
  on public.store_settings (store_key);

revoke all on table public.store_settings from anon, authenticated;

insert into public.store_settings (store_key, settings)
values ('default', '{}'::jsonb)
on conflict (store_key) do nothing;

comment on table public.store_settings is
  'Fonte única das regras comerciais e textos do atendimento Moda Pink.';
