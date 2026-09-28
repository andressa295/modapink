begin;

alter table public.orders
  alter column nuvemshop_order_id drop not null;

alter table public.orders add column if not exists external_id text;
alter table public.orders add column if not exists order_number bigint;
alter table public.orders add column if not exists conversation_id uuid
  references public.conversations(id) on delete set null;
alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists shipping_status text;
alter table public.orders add column if not exists shipping_method text;
alter table public.orders add column if not exists tracking_number text;
alter table public.orders add column if not exists tracking_url text;
alter table public.orders add column if not exists currency text;
alter table public.orders add column if not exists address text;
alter table public.orders add column if not exists items jsonb default '[]'::jsonb;
alter table public.orders add column if not exists raw jsonb;
alter table public.orders add column if not exists raw_products jsonb default '[]'::jsonb;
alter table public.orders add column if not exists whatsapp_number text;

create unique index if not exists orders_external_id_idx
  on public.orders(external_id);

commit;
