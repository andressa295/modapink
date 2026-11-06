-- Independent price simulations: no stock, order, Auth or email mutations.
begin;
create table mf_private.pricing_sheets (
  id uuid primary key,
  document jsonb not null check(jsonb_typeof(document)='object' and octet_length(document::text)<=100000),
  revision integer not null default 1 check(revision>0),
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  archived_at timestamptz
);
alter table mf_private.pricing_sheets enable row level security;
revoke all on mf_private.pricing_sheets from public,anon,authenticated,service_role;
create index mf_pricing_active_updated on mf_private.pricing_sheets(updated_at desc) where archived_at is null;

create function mf_private.validate_pricing_document(d jsonb) returns void language plpgsql set search_path='' as $$
declare item jsonb; field text; amount numeric; total_rates numeric:=0; total_cost numeric:=0; monthly boolean:=false;
begin
  if jsonb_typeof(d) is distinct from 'object' or octet_length(d::text)>100000 or d->'version' is distinct from '1'::jsonb then raise exception 'Simulação inválida.' using errcode='22023'; end if;
  foreach field in array array['name','sourceLabel','notes'] loop
    if jsonb_typeof(d->field) is distinct from 'string' then raise exception 'Revise o nome e as observações.' using errcode='22023'; end if;
  end loop;
  if char_length(btrim(d->>'name')) not between 1 and 120 or char_length(d->>'sourceLabel')>200 or char_length(d->>'notes')>4000 then raise exception 'Revise o nome e as observações.' using errcode='22023'; end if;
  foreach field in array array['produced','sellable','monthlyVolume','margin','wholesalePrice','retailMargin','retailExpenses','retailFixed'] loop
    if jsonb_typeof(d->field) is distinct from 'number' then raise exception 'Revise os valores da simulação.' using errcode='22023'; end if;
    amount:=(d->>field)::numeric;
    if amount<0 or amount>1000000000 then raise exception 'Valor fora do limite.' using errcode='22023'; end if;
  end loop;
  foreach field in array array['produced','sellable','monthlyVolume'] loop
    amount:=(d->>field)::numeric;
    if amount<>trunc(amount) or amount>1000000 then raise exception 'Informe quantidades inteiras de peças.' using errcode='22023'; end if;
  end loop;
  if (d->>'produced')::numeric<1 or (d->>'sellable')::numeric<1 or (d->>'sellable')::numeric>(d->>'produced')::numeric then raise exception 'Revise as peças produzidas e vendáveis.' using errcode='22023'; end if;
  if jsonb_typeof(d->'items') is distinct from 'array' or jsonb_typeof(d->'rates') is distinct from 'array' then raise exception 'Lista de custos inválida.' using errcode='22023'; end if;
  if jsonb_array_length(d->'items') not between 1 and 100 or jsonb_array_length(d->'rates')>30 then raise exception 'Quantidade de custos ou taxas fora do limite.' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(d->'items') loop
    if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'id') is distinct from 'string' or jsonb_typeof(item->'label') is distinct from 'string'
      or jsonb_typeof(item->'group') is distinct from 'string' or jsonb_typeof(item->'basis') is distinct from 'string' or jsonb_typeof(item->'value') is distinct from 'number' then raise exception 'Custo inválido.' using errcode='22023'; end if;
    if char_length(item->>'id') not between 1 and 100 or char_length(btrim(item->>'label')) not between 1 and 120
      or item->>'group' not in ('Materiais','Desenvolvimento','Produção','Logística','Estrutura') or item->>'basis' not in ('piece','batch','month')
      or (item->>'value')::numeric<0 or (item->>'value')::numeric>1000000000 then raise exception 'Revise as linhas de custo.' using errcode='22023'; end if;
    if item->>'basis'='month' and (item->>'value')::numeric>0 then monthly:=true; end if;
  end loop;
  if monthly and (d->>'monthlyVolume')::numeric<1 then raise exception 'Informe a produção mensal para ratear despesas.' using errcode='22023'; end if;
  select coalesce(sum((x->>'value')::numeric * case x->>'basis' when 'piece' then (d->>'produced')::numeric when 'month' then (d->>'sellable')::numeric/nullif((d->>'monthlyVolume')::numeric,0) else 1 end),0)
    into total_cost from jsonb_array_elements(d->'items') x;
  if total_cost>1000000000000 then raise exception 'O total ultrapassa o limite da simulação.' using errcode='22023'; end if;
  if (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(d->'items') x) then raise exception 'Há custos duplicados.' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(d->'rates') loop
    if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'id') is distinct from 'string' or jsonb_typeof(item->'label') is distinct from 'string' or jsonb_typeof(item->'value') is distinct from 'number' then raise exception 'Taxa inválida.' using errcode='22023'; end if;
    if char_length(item->>'id') not between 1 and 100 or char_length(btrim(item->>'label')) not between 1 and 120 or (item->>'value')::numeric<0 or (item->>'value')::numeric>=100 then raise exception 'Revise as taxas de venda.' using errcode='22023'; end if;
    total_rates:=total_rates+(item->>'value')::numeric;
  end loop;
  if (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(d->'rates') x) then raise exception 'Há taxas duplicadas.' using errcode='22023'; end if;
  if total_rates+(d->>'margin')::numeric>=100 or (d->>'retailMargin')::numeric+(d->>'retailExpenses')::numeric>=100 then raise exception 'As taxas e a margem devem somar menos de 100 por cento.' using errcode='22023'; end if;
end $$;

create function mf_private.pricing_list() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform mf_private.get_profile();
  if mf_private.current_role() not in ('admin','gestao') then raise exception 'Área exclusiva da gestão.' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',id,'document',document,'revision',revision,'updatedAt',updated_at) order by updated_at desc) from mf_private.pricing_sheets where archived_at is null),'[]'::jsonb);
end $$;

create function mf_private.pricing_save(p_id uuid,p_document jsonb,p_expected_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare existing mf_private.pricing_sheets; saved mf_private.pricing_sheets;
begin
  perform 1 from public.profiles where id=auth.uid() for share;
  perform mf_private.get_profile();
  if mf_private.current_role() not in ('admin','gestao') then raise exception 'Área exclusiva da gestão.' using errcode='42501'; end if;
  if p_id is null or p_expected_revision is null or p_expected_revision<0 then raise exception 'Identificação inválida.' using errcode='22023'; end if;
  perform mf_private.validate_pricing_document(p_document);
  -- Serialize even brand-new UUIDs: an uncertain retry cannot create a second row.
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,42));
  select * into existing from mf_private.pricing_sheets where id=p_id for update;
  if found then
    if existing.archived_at is not null then raise exception 'Esta simulação foi excluída. Crie uma nova.' using errcode='40001'; end if;
    if existing.document=p_document then saved:=existing;
    else
      if existing.revision<>p_expected_revision then raise exception 'Outra pessoa atualizou a simulação. Recarregue a versão salva.' using errcode='40001'; end if;
      update mf_private.pricing_sheets set document=p_document,revision=revision+1,updated_by=auth.uid(),updated_at=clock_timestamp() where id=p_id returning * into saved;
    end if;
  else
    if p_expected_revision<>0 then raise exception 'Simulação não encontrada. Recarregue a lista.' using errcode='40001'; end if;
    insert into mf_private.pricing_sheets(id,document,created_by,updated_by) values(p_id,p_document,auth.uid(),auth.uid()) returning * into saved;
  end if;
  return jsonb_build_object('id',saved.id,'document',saved.document,'revision',saved.revision,'updatedAt',saved.updated_at);
end $$;

create function mf_private.pricing_remove(p_id uuid,p_expected_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare existing mf_private.pricing_sheets;
begin
  perform 1 from public.profiles where id=auth.uid() for share;
  perform mf_private.get_profile();
  if mf_private.current_role() not in ('admin','gestao') then raise exception 'Área exclusiva da gestão.' using errcode='42501'; end if;
  if p_id is null or p_expected_revision is null or p_expected_revision<1 then raise exception 'Identificação inválida.' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,42));
  select * into existing from mf_private.pricing_sheets where id=p_id for update;
  if not found then raise exception 'Simulação não encontrada.' using errcode='22023'; end if;
  if existing.archived_at is null then
    if existing.revision<>p_expected_revision then raise exception 'Outra pessoa atualizou a simulação. Recarregue a versão salva.' using errcode='40001'; end if;
    update mf_private.pricing_sheets set archived_at=clock_timestamp(),updated_at=clock_timestamp(),updated_by=auth.uid(),revision=revision+1 where id=p_id;
  end if;
  return jsonb_build_object('id',p_id,'removed',true);
end $$;

create function public.mf_pricing_list() returns jsonb language sql stable security invoker set search_path='' as $$ select mf_private.pricing_list() $$;
create function public.mf_pricing_save(p_id uuid,p_document jsonb,p_expected_revision integer) returns jsonb language sql security invoker set search_path='' as $$ select mf_private.pricing_save(p_id,p_document,p_expected_revision) $$;
create function public.mf_pricing_remove(p_id uuid,p_expected_revision integer) returns jsonb language sql security invoker set search_path='' as $$ select mf_private.pricing_remove(p_id,p_expected_revision) $$;
revoke all on function mf_private.validate_pricing_document(jsonb),mf_private.pricing_list(),mf_private.pricing_save(uuid,jsonb,integer),mf_private.pricing_remove(uuid,integer) from public,anon,authenticated,service_role;
revoke all on function public.mf_pricing_list(),public.mf_pricing_save(uuid,jsonb,integer),public.mf_pricing_remove(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function mf_private.pricing_list(),mf_private.pricing_save(uuid,jsonb,integer),mf_private.pricing_remove(uuid,integer) to authenticated;
grant execute on function public.mf_pricing_list(),public.mf_pricing_save(uuid,jsonb,integer),public.mf_pricing_remove(uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
