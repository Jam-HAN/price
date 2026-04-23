-- 0008_hardening.sql
-- - sync-sheet 트랜잭션화 (price_sync_sheet RPC)
-- - parser_key 컬럼 (거래처 파서 라우팅 DB화)
-- - composite 인덱스 추가
-- - 디바이스 삭제 cascade 완화

-- 1) parser_key 컬럼 추가 (하드코딩된 거래처명 정규식 대신)
alter table price_vendors
  add column if not exists parser_key text;

-- 기존 거래처에 기본값 주입
update price_vendors set parser_key = 'lgu-daesan'    where name = '대산'   and parser_key is null;
update price_vendors set parser_key = 'lgu-anseong'   where name = '안성'   and parser_key is null;
update price_vendors set parser_key = 'kt-banchu'     where name = '반추'   and parser_key is null;
update price_vendors set parser_key = 'kt-near'       where name = '니어'   and parser_key is null;
update price_vendors set parser_key = 'skt-cheongdam' where name = '청담'   and parser_key is null;
update price_vendors set parser_key = 'skt-pes'       where name = '피에스' and parser_key is null;

-- 2) 쿼리 성능 인덱스
create index if not exists idx_plan_tiers_carrier_active_order
  on price_plan_tiers(carrier, active, display_order);

create index if not exists idx_vendor_quotes_device_tier
  on price_vendor_quotes(device_id, plan_tier_id);

create index if not exists idx_vendor_quote_sheets_vendor_date
  on price_vendor_quote_sheets(vendor_id, effective_date desc);

create index if not exists idx_carrier_subsidies_carrier
  on price_carrier_subsidies(carrier, device_id, plan_tier_id);

-- 3) 디바이스 삭제 cascade
-- 기존 on delete restrict → 디바이스 삭제 시 quote/subsidy/margin도 같이 삭제
alter table price_vendor_quotes
  drop constraint if exists price_vendor_quotes_device_id_fkey,
  add constraint price_vendor_quotes_device_id_fkey
    foreign key (device_id) references price_devices(id) on delete cascade;

alter table price_carrier_subsidies
  drop constraint if exists price_carrier_subsidies_device_id_fkey,
  add constraint price_carrier_subsidies_device_id_fkey
    foreign key (device_id) references price_devices(id) on delete cascade;

alter table price_device_margins
  drop constraint if exists price_device_margins_device_id_fkey,
  add constraint price_device_margins_device_id_fkey
    foreign key (device_id) references price_devices(id) on delete cascade;

alter table price_device_aliases
  drop constraint if exists price_device_aliases_device_id_fkey,
  add constraint price_device_aliases_device_id_fkey
    foreign key (device_id) references price_devices(id) on delete cascade;

-- 4) sync-sheet 트랜잭션화 — 시트 동기화 시 quotes/policies를 원자적으로 교체
-- 기존: TS에서 delete → insert 순차 호출 (중간 실패 시 데이터 증발)
-- 변경: RPC 하나에서 transaction 내 실행
create or replace function price_sync_replace_sheet(
  p_sheet_id uuid,
  p_quotes jsonb,
  p_policies jsonb
) returns void
language plpgsql
as $$
begin
  -- 기존 시트 관련 데이터 삭제
  delete from price_vendor_quotes where sheet_id = p_sheet_id;
  delete from price_vendor_policies where sheet_id = p_sheet_id;

  -- 새 quotes 삽입
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

  -- 새 policies 삽입
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
