-- 공시지원금 단위 자동 보정 함수
-- Claude Vision이 "천원 단위" 표기를 놓쳐서 공시지원금을 ×10 작게 기록하는 경우 자동 복구.
-- 조건: 같은 (sheet, tier) 묶음의 평균 subsidy < 100,000원 AND tier의 월요금 >= 60,000원.
-- 반환: 보정된 행 수.

create or replace function price_autocorrect_subsidy_units(p_sheet_id uuid)
returns integer
language plpgsql
security definer
as $$
declare
  v_count integer;
begin
  with tier_stats as (
    select sub.sheet_id, sub.plan_tier_id, avg(sub.subsidy_krw) as avg_sub
    from price_vendor_subsidies sub
    where sub.sheet_id = p_sheet_id
    group by sub.sheet_id, sub.plan_tier_id
  ),
  updated as (
    update price_vendor_subsidies sub
    set subsidy_krw = subsidy_krw * 10
    from tier_stats ts, price_plan_tiers t
    where ts.sheet_id = sub.sheet_id
      and ts.plan_tier_id = sub.plan_tier_id
      and t.id = sub.plan_tier_id
      and sub.sheet_id = p_sheet_id
      and coalesce(t.monthly_fee_krw, 0) >= 60000
      and ts.avg_sub < 100000
    returning sub.id
  )
  select count(*) into v_count from updated;
  return v_count;
end;
$$;

grant execute on function price_autocorrect_subsidy_units(uuid) to service_role;
