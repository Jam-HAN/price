-- =============================================================
-- Cell-level corrections log (사용자 인라인 편집 기록)
-- 목적:
--   1. 파인튜닝용 정답 데이터 축적
--   2. consistency engine의 정확도 측정
-- 2026-04-21
-- =============================================================

create table if not exists price_cell_corrections (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references price_vendor_quote_sheets(id) on delete cascade,
  -- 대상 위치
  model_code_raw text not null,            -- raw_ocr_json 기준
  plan_tier_code text,                     -- null 가능 (retail_price 수정)
  field text not null check (field in (
    'retail_price_krw',
    'subsidy_krw',
    'common.new010','common.mnp','common.change',
    'select.new010','select.mnp','select.change'
  )),
  -- 값
  before_value numeric(12,0),              -- null 가능 (신규 입력)
  after_value numeric(12,0),               -- null 가능 (값 지움)
  -- 메타
  flag_reason text,                        -- 'pair_mismatch' / 'day_drift' / 'monotonic' / 'range' / 'manual'
  corrected_by text,
  corrected_at timestamptz not null default now()
);

create index if not exists idx_cell_corr_sheet on price_cell_corrections(sheet_id);
create index if not exists idx_cell_corr_model on price_cell_corrections(model_code_raw);
create index if not exists idx_cell_corr_date on price_cell_corrections(corrected_at desc);

alter table price_cell_corrections enable row level security;
drop policy if exists service_all on price_cell_corrections;
create policy service_all on price_cell_corrections for all to service_role using (true) with check (true);
