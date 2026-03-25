-- =========================================
-- EXTENSÕES
-- =========================================

create extension if not exists "uuid-ossp";

-- =========================================
-- TABELA: CUSTOMERS
-- =========================================

create table customers (
  id uuid primary key default uuid_generate_v4(),
  name text,
  phone text unique,
  created_at timestamp default now()
);

-- =========================================
-- TABELA: CONVERSATIONS
-- =========================================

create table conversations (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references customers(id) on delete cascade,
  channel text default 'whatsapp',
  status text default 'open',
  created_at timestamp default now()
);

-- =========================================
-- TABELA: MESSAGES
-- =========================================

create table messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references conversations(id) on delete cascade,
  sender text check (sender in ('user', 'bot', 'agent')),
  content text,
  created_at timestamp default now()
);

-- =========================================
-- TABELA: ORDERS (Nuvemshop)
-- =========================================

create table orders (
  id uuid primary key default uuid_generate_v4(),
  external_id text, -- id da Nuvemshop
  customer_id uuid references customers(id) on delete set null,
  status text,
  total numeric,
  created_at timestamp default now()
);

-- =========================================
-- TABELA: AUTOMATIONS
-- =========================================

create table automations (
  id uuid primary key default uuid_generate_v4(),
  name text,
  trigger text,
  response text,
  created_at timestamp default now()
);

-- =========================================
-- ÍNDICES (PERFORMANCE)
-- =========================================

create index idx_messages_conversation on messages(conversation_id);
create index idx_conversations_customer on conversations(customer_id);
create index idx_orders_customer on orders(customer_id);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  role text default 'admin', -- ou 'agent'
  created_at timestamp default now()
);
alter table profiles enable row level security;
create policy "Users can read own profile"
on profiles
for select
using (auth.uid() = id);
create policy "Users can update own profile"
on profiles
for update
using (auth.uid() = id);

create policy "read own profile"
on profiles
for select
using (auth.uid() = id);

create table automation_logs (
  id uuid primary key default uuid_generate_v4(),
  automation_id uuid references automations(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete cascade,
  executed_at timestamp default now()
);

create table agents (
  id uuid primary key references profiles(id) on delete cascade,
  name text,
  active boolean default true,
  created_at timestamp default now()
);

create table conversation_assignments (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references conversations(id) on delete cascade,
  agent_id uuid references agents(id) on delete set null,
  assigned_at timestamp default now()
);
create table whatsapp_sessions (
  id uuid primary key default uuid_generate_v4(),
  phone text,
  status text, -- online, offline, connecting
  last_seen timestamp,
  created_at timestamp default now()
);

create table settings (
  id uuid primary key default uuid_generate_v4(),
  key text unique,
  value jsonb,
  created_at timestamp default now()
);
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  role text default 'agent',
  created_at timestamp default now()
);
alter table profiles enable row level security;
create policy "read own profile"
on profiles
for select
using (auth.uid() = id);
create policy "admin read all"
on profiles
for select
using (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role = 'admin'
  )
);
create policy "admin update"
on profiles
for update
using (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role = 'admin'
  )
);
drop policy if exists "read own profile" on profiles;
drop policy if exists "admin read all" on profiles;
drop policy if exists "admin update" on profiles;
drop policy if exists "Users can read own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;

create policy "profiles select"
on profiles
for select
using (
  auth.uid() = id
  OR
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role = 'admin'
  )
);
create policy "profiles update"
on profiles
for update
using (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role = 'admin'
  )
);
create policy "profiles insert"
on profiles
for insert
with check (true);
alter table profiles enable row level security;
drop policy if exists "profiles insert" on profiles;

create policy "profiles insert"
on profiles
for insert
with check (true);
drop policy if exists "profiles delete" on profiles;

create policy "profiles delete"
on profiles
for delete
using (true);
create policy "admin delete"
on profiles
for delete
using (
  auth.uid() = id
  OR
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role = 'admin'
  )
);
create table stores (
  id uuid primary key default uuid_generate_v4(),
  store_id text,
  access_token text,
  created_at timestamp default now()
);
alter table stores add column shop text;

-- adiciona colunas que faltam
alter table stores add column if not exists user_id bigint;
alter table stores add column if not exists updated_at timestamp;

-- garante que upsert funcione
alter table stores add constraint stores_store_id_unique unique (store_id);
alter table stores alter column store_id type bigint using store_id::bigint;

alter table orders add column if not exists external_id text;
create unique index if not exists orders_external_id_idx on orders(external_id);
alter table orders add column if not exists order_number bigint;
alter table orders add column if not exists customer_name text;
alter table orders add column if not exists customer_email text;
alter table orders add column if not exists customer_phone text;

alter table orders add column if not exists payment_status text;
alter table orders add column if not exists payment_method text;

alter table orders add column if not exists shipping_status text;
alter table orders add column if not exists shipping_method text;

alter table orders add column if not exists currency text;
alter table orders add column if not exists address text;

alter table orders add column if not exists items jsonb;
alter table orders add column if not exists raw jsonb;

create unique index if not exists orders_external_id_idx on orders(external_id);

create table if not exists whatsapp_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id bigint,
  phone text,
  status text,
  created_at timestamp default now()
);

alter table whatsapp_sessions add column if not exists store_id bigint;
alter table whatsapp_sessions add column if not exists setor text;
alter table whatsapp_sessions add column if not exists is_default boolean default false;