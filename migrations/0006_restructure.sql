-- =============================================================
-- 구조 개편: 공시지원금 = 통신사 레벨 / 리베이트 = 거래처 레벨 / 마진 설정 추가
-- 2026-04-21
-- =============================================================

-- 0. 통신사 레벨 공시지원금 (unique per carrier+device+tier)
create table if not exists price_carrier_subsidies (
  id uuid primary key default gen_random_uuid(),
  carrier text not null check (carrier in ('SKT','KT','LGU+')),
  device_id uuid not null references price_devices(id) on delete cascade,
  plan_tier_id uuid not null references price_plan_tiers(id) on delete cascade,
  subsidy_krw numeric(12,0) not null,
  source_sheet_id uuid references price_vendor_quote_sheets(id) on delete set null,
  source_vendor_id uuid references price_vendors(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (carrier, device_id, plan_tier_id)
);
create index if not exists idx_car_sub_carrier on price_carrier_subsidies(carrier);
create index if not exists idx_car_sub_device on price_carrier_subsidies(device_id);

alter table price_carrier_subsidies enable row level security;
drop policy if exists service_all on price_carrier_subsidies;
create policy service_all on price_carrier_subsidies for all to service_role using (true) with check (true);

-- 1. 기존 vendor_subsidies에서 이관 (최신 날짜 sheet 우선)
-- 통신사+디바이스+구간 단위로, 가장 최근 effective_date의 값 하나만 남김
with ranked as (
  select
    vs.device_id, vs.plan_tier_id, vs.subsidy_krw, vs.sheet_id,
    s.vendor_id, s.effective_date,
    v.carrier,
    row_number() over (
      partition by v.carrier, vs.device_id, vs.plan_tier_id
      order by s.effective_date desc, s.uploaded_at desc
    ) as rn
  from price_vendor_subsidies vs
  join price_vendor_quote_sheets s on s.id = vs.sheet_id
  join price_vendors v on v.id = s.vendor_id
  where s.parse_status = 'confirmed'
)
insert into price_carrier_subsidies (carrier, device_id, plan_tier_id, subsidy_krw, source_sheet_id, source_vendor_id)
select carrier, device_id, plan_tier_id, subsidy_krw, sheet_id, vendor_id
from ranked
where rn = 1
on conflict (carrier, device_id, plan_tier_id) do nothing;

-- 2. 마진 설정 테이블 (scope: device > series > global)
create table if not exists price_device_margins (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('global','series','device')),
  device_id uuid references price_devices(id) on delete cascade,   -- scope_type='device' 일때 필수
  series text,                                                     -- scope_type='series' 일때 필수
  margin_krw numeric(12,0) not null default 0,
  updated_at timestamptz not null default now(),
  unique (scope_type, device_id, series)
);
-- 기본 전역 마진 0 시드 (없으면)
insert into price_device_margins (scope_type, margin_krw)
select 'global', 0
where not exists (select 1 from price_device_margins where scope_type = 'global');

alter table price_device_margins enable row level security;
drop policy if exists service_all on price_device_margins;
create policy service_all on price_device_margins for all to service_role using (true) with check (true);

-- 3. 기존 price_net_view, price_latest_net 재정의 — carrier_subsidies 사용
drop view if exists price_latest_net;
drop view if exists price_net_view;

create view price_net_view as
select
  q.sheet_id,
  s.vendor_id,
  v.name            as vendor_name,
  v.carrier,
  s.effective_date,
  s.parse_status,
  q.device_id,
  d.model_code      as device_code,
  d.nickname        as device_name,
  d.series          as device_series,
  d.display_order   as device_order,
  d.retail_price_krw,
  q.plan_tier_id,
  t.code            as plan_tier_code,
  t.label           as plan_tier_label,
  t.display_order   as tier_order,
  q.contract_type,
  q.activation_type,
  q.amount_krw      as vendor_price,      -- 리베이트
  cs.subsidy_krw,                         -- 통신사 공시지원금
  case
    when q.contract_type = 'common'
      then d.retail_price_krw - coalesce(cs.subsidy_krw, 0) - q.amount_krw
    else d.retail_price_krw - q.amount_krw
  end               as net_price
from price_vendor_quotes q
join price_vendor_quote_sheets s on s.id = q.sheet_id
join price_vendors v             on v.id = s.vendor_id
join price_devices d             on d.id = q.device_id
join price_plan_tiers t          on t.id = q.plan_tier_id
left join price_carrier_subsidies cs
  on cs.carrier = v.carrier
  and cs.device_id = q.device_id
  and cs.plan_tier_id = q.plan_tier_id
where s.parse_status = 'confirmed';

create view price_latest_net as
with latest as (
  select distinct on (s.vendor_id)
    s.id as sheet_id, s.vendor_id, s.effective_date
  from price_vendor_quote_sheets s
  where s.parse_status = 'confirmed'
  order by s.vendor_id, s.effective_date desc
)
select n.*
from price_net_view n
join latest l on l.sheet_id = n.sheet_id;

-- 4. 마진 조회 함수 — device > series > global 순서
create or replace function price_resolve_margin(p_device_id uuid) returns numeric as $$
  select margin_krw
  from price_device_margins
  where (scope_type = 'device' and device_id = p_device_id)
     or (scope_type = 'series' and series = (select series from price_devices where id = p_device_id))
     or (scope_type = 'global')
  order by case scope_type when 'device' then 1 when 'series' then 2 else 3 end
  limit 1;
$$ language sql stable;

-- 5. 고객가 뷰 = Net가 + 마진
create or replace view price_customer_view as
select
  n.*,
  price_resolve_margin(n.device_id) as margin_krw,
  n.net_price + coalesce(price_resolve_margin(n.device_id), 0) as customer_price
from price_latest_net n;
