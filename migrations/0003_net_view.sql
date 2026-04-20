-- Net가 계산 VIEW
-- Net(common) = 출고가 − 공시지원금 − 거래처단가
-- Net(select) = 출고가 − 거래처단가  (선약은 공시지원금 대신 요금할인 받음)
-- 부가정책 반영은 향후 레이어 (마진 테이블 추가 시)

create or replace view price_net_view as
select
  q.sheet_id,
  s.vendor_id,
  v.name           as vendor_name,
  v.carrier,
  s.effective_date,
  s.parse_status,
  q.device_id,
  d.model_code     as device_code,
  d.nickname       as device_name,
  d.series         as device_series,
  d.display_order  as device_order,
  d.retail_price_krw,
  q.plan_tier_id,
  t.code           as plan_tier_code,
  t.label          as plan_tier_label,
  t.display_order  as tier_order,
  q.contract_type,
  q.activation_type,
  q.amount_krw     as vendor_price,
  sub.subsidy_krw,
  case
    when q.contract_type = 'common'
      then d.retail_price_krw - coalesce(sub.subsidy_krw, 0) - q.amount_krw
    else d.retail_price_krw - q.amount_krw
  end              as net_price
from price_vendor_quotes q
join price_vendor_quote_sheets s on s.id = q.sheet_id
join price_vendors v            on v.id = s.vendor_id
join price_devices d            on d.id = q.device_id
join price_plan_tiers t         on t.id = q.plan_tier_id
left join price_vendor_subsidies sub
  on sub.sheet_id = q.sheet_id
  and sub.device_id = q.device_id
  and sub.plan_tier_id = q.plan_tier_id
where s.parse_status = 'confirmed';

-- 각 (device, tier, contract, activation) 조합 × 통신사에서 최신 confirmed sheet의 최저 Net가
create or replace view price_latest_net as
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
