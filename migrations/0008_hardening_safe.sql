-- 0008_hardening_safe.sql (additive only — 롤백 불필요)
-- 1) parser_key 컬럼 + 시드
-- 2) 쿼리 인덱스
-- 3) sync RPC 함수 (기존 sync-sheet.ts 호출 전까지 미사용)

alter table price_vendors
  add column if not exists parser_key text;

update price_vendors set parser_key = 'lgu-daesan'    where name = '대산'   and parser_key is null;
update price_vendors set parser_key = 'lgu-anseong'   where name = '안성'   and parser_key is null;
update price_vendors set parser_key = 'kt-banchu'     where name = '반추'   and parser_key is null;
update price_vendors set parser_key = 'kt-near'       where name = '니어'   and parser_key is null;
update price_vendors set parser_key = 'skt-cheongdam' where name = '청담'   and parser_key is null;
update price_vendors set parser_key = 'skt-pes'       where name = '피에스' and parser_key is null;

create index if not exists idx_plan_tiers_carrier_active_order
  on price_plan_tiers(carrier, active, display_order);

create index if not exists idx_vendor_quotes_device_tier
  on price_vendor_quotes(device_id, plan_tier_id);

create index if not exists idx_vendor_quote_sheets_vendor_date
  on price_vendor_quote_sheets(vendor_id, effective_date desc);

create index if not exists idx_carrier_subsidies_carrier
  on price_carrier_subsidies(carrier, device_id, plan_tier_id);

create or replace function price_sync_replace_sheet(
  p_sheet_id uuid,
  p_quotes jsonb,
  p_policies jsonb
) returns void
language plpgsql
as $$
begin
  delete from price_vendor_quotes where sheet_id = p_sheet_id;
  delete from price_vendor_policies where sheet_id = p_sheet_id;

  if jsonb_array_length(p_quotes) > 0 then
    insert into price_vendor_quotes(sheet_id, device_id, plan_tier_id, contract_type, activation_type, amount_krw)
    select
      p_sheet_id,
      (q->>'device_id')::uuid,
      (q->>'plan_tier_id')::uuid,
      q->>'contract_type',
      q->>'activation_type',
      (q->>'amount_krw')::numeric
    from jsonb_array_elements(p_quotes) q;
  end if;

  if jsonb_array_length(p_policies) > 0 then
    insert into price_vendor_policies(sheet_id, category, name, amount_krw, raw_text, display_order)
    select
      p_sheet_id,
      p->>'category',
      p->>'name',
      nullif(p->>'amount_krw','')::numeric,
      p->>'raw_text',
      (p->>'display_order')::int
    from jsonb_array_elements(p_policies) p;
  end if;
end;
$$;
