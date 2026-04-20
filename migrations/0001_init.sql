-- =============================================================
-- Price (대박통신 단가표 시스템) — initial schema
-- 2026-04-20
-- 모든 테이블은 price_ 프리픽스로 admin 테이블과 네임스페이스 분리
-- =============================================================

-- 거래처 ---------------------------------------------------------
create table if not exists price_vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  carrier text not null check (carrier in ('SKT', 'KT', 'LGU+')),
  display_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 디바이스 마스터 (출고가) --------------------------------------
create table if not exists price_devices (
  id uuid primary key default gen_random_uuid(),
  model_code text not null unique,       -- 내부 표준 코드 (SM-S942N 등)
  nickname text not null,                -- 표시명 (갤럭시 S26)
  manufacturer text,                     -- Samsung / Apple / 기타
  series text,                           -- galaxyS26 / iphone17 / fold7 / flip7 / s25 등
  storage text,                          -- 256G / 512G / 1TB
  retail_price_krw numeric(12,0) not null,
  category text not null default '5G' check (category in ('5G','LTE','S-D','기타')),
  released_at date,
  is_new boolean not null default false,
  display_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_price_devices_series on price_devices(series);
create index if not exists idx_price_devices_active_order on price_devices(active, display_order);

-- 거래처별 모델 코드 alias (거래처마다 쓰는 코드가 달라서 매핑 필요)
create table if not exists price_device_aliases (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references price_devices(id) on delete cascade,
  vendor_id uuid not null references price_vendors(id) on delete cascade,
  vendor_code text not null,             -- 거래처가 쓰는 raw 코드 ("SM-S942N_512G", "UIP17-256", "AIP17P")
  created_at timestamptz not null default now(),
  unique(vendor_id, vendor_code)
);
create index if not exists idx_price_device_aliases_device on price_device_aliases(device_id);

-- 요금제 구간 마스터 (통신사 × 구간코드) -----------------------
-- SKT: I_100 / F_79 / L_69 / M_50 / R_43 / S_33 / BASE(요금제불입포함)
-- KT: T110 / T100 / T61 / T37 / SLIM14 (금액대)
-- LGU+: G115 / G105 / G95 / G85 / G75 / G69 / G61 / G55 / G44 / G33 (군)
create table if not exists price_plan_tiers (
  id uuid primary key default gen_random_uuid(),
  carrier text not null check (carrier in ('SKT', 'KT', 'LGU+')),
  code text not null,
  label text not null,                   -- 대표 요금제명
  monthly_fee_krw numeric(10,0),         -- 월 요금 (선약 기준 등은 메모)
  aliases text[] default '{}',           -- 거래처별 표기 변형 ("S_33 구간", "33군" 등)
  display_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(carrier, code)
);

-- 단가표 배치 (일자별 업로드) -----------------------------------
create table if not exists price_vendor_quote_sheets (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references price_vendors(id) on delete restrict,
  effective_date date not null,
  policy_round text,                     -- '4-9차', '04월 09차', 'ver.15'
  effective_time text,                   -- '00시 00분', '19시 00분'
  image_url text,                        -- Supabase Storage 경로
  raw_ocr_json jsonb,                    -- Claude Vision 원본 응답 (검수 전/후 diff용)
  parse_status text not null default 'pending' check (parse_status in ('pending','parsing','parsed','confirmed','error')),
  error_message text,
  uploaded_by text,
  uploaded_at timestamptz not null default now(),
  parsed_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by text,
  notes text,
  unique(vendor_id, effective_date)
);
create index if not exists idx_price_sheets_vendor_date on price_vendor_quote_sheets(vendor_id, effective_date desc);
create index if not exists idx_price_sheets_status on price_vendor_quote_sheets(parse_status);

-- 단가 raw (long format) ----------------------------------------
-- 한 모델당 최대 (구간 × 약정 × 개통) = 7 × 2 × 3 = 42행
create table if not exists price_vendor_quotes (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references price_vendor_quote_sheets(id) on delete cascade,
  device_id uuid not null references price_devices(id) on delete restrict,
  plan_tier_id uuid not null references price_plan_tiers(id) on delete restrict,
  contract_type text not null check (contract_type in ('common','select')),
  activation_type text not null check (activation_type in ('new010','mnp','change')),
  amount_krw numeric(12,0) not null,     -- 단가 (음수=페이백)
  unique(sheet_id, device_id, plan_tier_id, contract_type, activation_type)
);
create index if not exists idx_price_quotes_sheet on price_vendor_quotes(sheet_id);
create index if not exists idx_price_quotes_device on price_vendor_quotes(device_id);

-- 공시/요금지원금 (거래처별 raw) --------------------------------
-- 원래 통신사 공통값이지만 거래처마다 표기가 다를 수 있어 거래처 sheet에 저장
create table if not exists price_vendor_subsidies (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references price_vendor_quote_sheets(id) on delete cascade,
  device_id uuid not null references price_devices(id) on delete restrict,
  plan_tier_id uuid not null references price_plan_tiers(id) on delete restrict,
  subsidy_krw numeric(12,0) not null,    -- 요금지원금 (원 단위)
  unique(sheet_id, device_id, plan_tier_id)
);
create index if not exists idx_price_subsidies_sheet on price_vendor_subsidies(sheet_id);

-- 부가정책 (세트보너스/추가지원/결합/OTT/카드/축소/페널티) ----
create table if not exists price_vendor_policies (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references price_vendor_quote_sheets(id) on delete cascade,
  category text not null check (category in (
    'bonus_set',      -- 세트 유치 보너스 (마이스마트콜3 + T All Care)
    'model_extra',    -- 특정 모델군 추가지원금
    'combine',        -- 유무선 결합 / 번들
    'ott_addon',      -- OTT 구독 추가
    'card',           -- 제휴카드 할부/DC
    'youth',          -- 청소년 요금제 추가
    'senior',         -- 시니어 요금제 추가/축소
    'penalty',        -- 축소 정책
    'other'
  )),
  name text not null,
  amount_krw numeric(12,0),              -- 양수(더하기) / 음수(빼기)
  conditions jsonb,                      -- {models:[], plan_tiers:[], activation_types:[], requires:[...]}
  raw_text text,                         -- 원본 설명 (OCR)
  display_order int not null default 0
);
create index if not exists idx_price_policies_sheet on price_vendor_policies(sheet_id);

-- updated_at 자동 갱신 트리거
create or replace function price_touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_price_vendors_updated on price_vendors;
create trigger trg_price_vendors_updated before update on price_vendors
  for each row execute function price_touch_updated_at();

drop trigger if exists trg_price_devices_updated on price_devices;
create trigger trg_price_devices_updated before update on price_devices
  for each row execute function price_touch_updated_at();

-- RLS — 일단 internal-only. admin JWT 검증은 app 레이어에서 처리.
alter table price_vendors enable row level security;
alter table price_devices enable row level security;
alter table price_device_aliases enable row level security;
alter table price_plan_tiers enable row level security;
alter table price_vendor_quote_sheets enable row level security;
alter table price_vendor_quotes enable row level security;
alter table price_vendor_subsidies enable row level security;
alter table price_vendor_policies enable row level security;

-- 서비스 롤만 직접 접근 (anon/authenticated는 전부 거부)
-- Next.js 서버는 service_role key 사용
do $$
declare t text;
begin
  for t in select unnest(array[
    'price_vendors','price_devices','price_device_aliases','price_plan_tiers',
    'price_vendor_quote_sheets','price_vendor_quotes','price_vendor_subsidies','price_vendor_policies'
  ]) loop
    execute format('drop policy if exists service_all on %I', t);
    execute format('create policy service_all on %I for all to service_role using (true) with check (true)', t);
  end loop;
end $$;
