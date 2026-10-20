-- PREPARED ONLY. Run only as an authorized deployment step, before replacing
-- the API. No schema, grants, RLS, or existing business records are changed.
-- Preserve generated checkout identities currently stored in conversations.
-- Historical checkout tokens, URLs and customer data are intentionally omitted.
begin;
select pg_advisory_xact_lock(731922041);
insert into public.events (type, conversation_id, payload)
select
  'whatsapp_checkout_created',
  c.id,
  jsonb_build_object(
    'draft_order_id', c.checkout #>> '{data,id}',
    'store_id', c.store_id,
    'source', 'whatsapp',
    'generated_at', c.checkout ->> 'generated_at',
    'recovered_from', 'existing_conversation_checkout'
  )
from public.conversations c
where c.checkout ->> 'status' = 'generated'
  and (c.checkout #>> '{data,id}') ~ '^[1-9][0-9]{0,19}$'
  and not exists (
    select 1 from public.events e
    where e.type = 'whatsapp_checkout_created'
      and e.conversation_id = c.id
      and e.payload ->> 'draft_order_id' = c.checkout #>> '{data,id}'
  );
commit;

-- Read-only post-check. missing_events should be 0 for the currently generated
-- links. Newly generated links are also covered once the API writer is live.
select
  count(*) as current_generated_links,
  count(*) filter (where not exists (
    select 1 from public.events e
    where e.type = 'whatsapp_checkout_created'
      and e.conversation_id = c.id
      and e.payload ->> 'draft_order_id' = c.checkout #>> '{data,id}'
  )) as missing_events
from public.conversations c
where c.checkout ->> 'status' = 'generated'
  and (c.checkout #>> '{data,id}') ~ '^[1-9][0-9]{0,19}$';
