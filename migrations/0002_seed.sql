-- =============================================================
-- Price — seed data
-- 거래처 6곳 + 통신사별 요금제 구간 마스터
-- =============================================================

-- 거래처 6곳 (carrier 매핑 확정)
insert into price_vendors (name, carrier, display_order) values
  ('청담', 'SKT', 1),
  ('피에스', 'SKT', 2),
  ('니어', 'KT', 3),
  ('반추', 'KT', 4),
  ('대산', 'LGU+', 5),
  ('안성', 'LGU+', 6)
on conflict (name) do update set carrier = excluded.carrier, display_order = excluded.display_order;

-- SKT 요금제 구간 (피에스/청담 단가표 기준)
insert into price_plan_tiers (carrier, code, label, monthly_fee_krw, aliases, display_order) values
  ('SKT', 'BASE',  '요금제불입정책 포함단가 (5GX 프리미엄/프라티넘/0청년109)', null, array['요금제 불입정책','신규요금제불입정책 포함단가'], 1),
  ('SKT', 'I_100', '5GX 프라이밍 플러스 청년99 / 넷플릭스 (0청년99/T플랜 맥스)', 99000, array['I_100 구간'], 2),
  ('SKT', 'F_79',  '5GX 프라이밍 / 0청년89 / 넷플릭스 (0청년89/넷플릭스)',   89000, array['F_79 구간'], 3),
  ('SKT', 'L_69',  '5GX 레귤러플러스 / T플랜 스페셜 / 0청년69 (5GX레귤러/T플랜 에센스 0청년69,79)', 69000, array['L_69 구간'], 4),
  ('SKT', 'M_50',  '베이직플러스 / T플랜 미디엄 / 주말엔팅 5.0 / 0청년 59 (0틴 플랜 미디엄+ / 5G ZEM 퍼펙트)', 50000, array['M_50 구간'], 5),
  ('SKT', 'R_43',  '컴팩트 / T플랜 안심 2.5G / 0틴 5G / ZEM 풀런 베스트 / 0청년 37,43,49 / 5G 시니어 A,B,C / 5G 슬림 / 베이직', 43000, array['R_43 구간'], 6),
  ('SKT', 'S_33',  'T플랜 세이브 / ZEM 플랜 스마트 / T끼리어로신 / ZEM플랜스마트 (주말엔 킹 세이브 / T플랜 시니어 세이브)', 33000, array['S_33 구간','T플랜 어른신'], 7)
on conflict (carrier, code) do update set label = excluded.label, monthly_fee_krw = excluded.monthly_fee_krw, aliases = excluded.aliases, display_order = excluded.display_order;

-- KT 요금제 구간 (니어/반추 기준 — 금액대 중심)
insert into price_plan_tiers (carrier, code, label, monthly_fee_krw, aliases, display_order) values
  ('KT', 'T110',    '초이스 스페셜 / 프리미엄 (110,000원 이상)',     110000, array['110K','초이스 스페셜'], 1),
  ('KT', 'T100',    '스페셜 / 5G 스페셜 / Y포함 (100,000원 이상)',   100000, array['100K','스폐셜','Y포함'], 2),
  ('KT', 'SLIM14',  '5G 슬림 14G',                                      null, array['5G 슬림 14G'], 3),
  ('KT', 'T61',     '5G 심플 30GB / 5G Y틴 / 주니어 / 5G 시니어 베이직 / 데이터ON비디오+ (61,000원 이상)', 61000, array['61K'], 4),
  ('KT', 'T37',     '5G 시니어 A,B,C / 5G 슬림 / 순광뜬20 / Y틴 ON / 주니어 ON / 5G 슬림 4-14G (37,000원 이상)', 37000, array['37K'], 5)
on conflict (carrier, code) do update set label = excluded.label, monthly_fee_krw = excluded.monthly_fee_krw, aliases = excluded.aliases, display_order = excluded.display_order;

-- LGU+ 요금제 구간 (대산/안성 기준 — 군 단위)
insert into price_plan_tiers (carrier, code, label, monthly_fee_krw, aliases, display_order) values
  ('LGU+', 'G115', '시그니처 / 프리미어 슈퍼 (115군 이상)',                 115000, array['115군','최고가군','그룹1'], 1),
  ('LGU+', 'G105', '프리미어 플러스 (OTT 티빙 or 멀티팩 필수) / LTE 프리미어 플러스 (105군)', 105000, array['105군','그룹2','고가군'], 2),
  ('LGU+', 'G95',  '프리미어 레귤러 (95군)',                                 95000, array['95군','그룹3','고가군'], 3),
  ('LGU+', 'G85',  '프리미어 에센셜 / 스탠다드 / 청소년3군 (75/85/청소년III군)', 85000, array['75군','85군','청소년3군','중저가군','그룹4'], 4),
  ('LGU+', 'G69',  '스탠다드 에센셜 / 심플+ / LTE 속걱데69 (61/69군)',       69000, array['61군','69군','그룹5','저가군'], 5),
  ('LGU+', 'G55',  '라이트+ / 슬림+ / 베이직+ / 라이트 청소년 / 시니어 A,B,C (44/55군 청소년II군 시니어II군)', 55000, array['44군','55군','그룹6','최저가군','청소년2군','시니어2군'], 6),
  ('LGU+', 'G33',  '키즈 29 / 미니 / LTE 데이터33 / 청소년19 / 키즈22 / LTE 청소년33 (33군 청소년I군 키즈군)', 33000, array['33군','그룹7','청소년1군','키즈군'], 7)
on conflict (carrier, code) do update set label = excluded.label, monthly_fee_krw = excluded.monthly_fee_krw, aliases = excluded.aliases, display_order = excluded.display_order;
