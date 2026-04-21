-- =============================================================
-- 디바이스 마스터 시드 — 화이트리스트 접근
-- 2026-04-21
-- 이 시드에 없는 모델은 업로드 시 skip 됨. 신규 출시 시 /devices에서 수동 추가.
-- =============================================================

-- 기존 데이터 비운 상태 가정 (price_devices empty)
-- retail_price_krw는 SKT/KT/LGU+ 공통 삼성·애플 공식가 기준
-- 변동 시 /subsidies 또는 /devices에서 편집

insert into price_devices (model_code, nickname, manufacturer, series, storage, retail_price_krw, category, is_new, display_order, active) values

-- ── Samsung Galaxy S26 (2026 flagship) ───────────────────────────
('SM-S942N_256G', '갤럭시 S26 256G',       'Samsung', 'galaxyS26', '256G', 1254000, '5G', true, 10, true),
('SM-S942N_512G', '갤럭시 S26 512G',       'Samsung', 'galaxyS26', '512G', 1507000, '5G', true, 11, true),
('SM-S947N_256G', '갤럭시 S26+ 256G',      'Samsung', 'galaxyS26', '256G', 1452000, '5G', true, 20, true),
('SM-S947N_512G', '갤럭시 S26+ 512G',      'Samsung', 'galaxyS26', '512G', 1705000, '5G', true, 21, true),
('SM-S948N_256G', '갤럭시 S26 울트라 256G', 'Samsung', 'galaxyS26', '256G', 1797400, '5G', true, 30, true),
('SM-S948N_512G', '갤럭시 S26 울트라 512G', 'Samsung', 'galaxyS26', '512G', 2050400, '5G', true, 31, true),
('SM-S948N_1T',   '갤럭시 S26 울트라 1TB',  'Samsung', 'galaxyS26', '1TB',  2545400, '5G', true, 32, true),

-- ── Samsung Galaxy Z Fold7 / Flip7 ────────────────────────────────
('SM-F966N_256G', '갤럭시 Z 폴드7 256G',   'Samsung', 'fold7', '256G', 2379300, '5G', true, 40, true),
('SM-F966N_512G', '갤럭시 Z 폴드7 512G',   'Samsung', 'fold7', '512G', 2537700, '5G', true, 41, true),
('SM-F966N_1T',   '갤럭시 Z 폴드7 1TB',    'Samsung', 'fold7', '1TB',  2853000, '5G', true, 42, true),
('SM-F766N_256G', '갤럭시 Z 플립7 256G',   'Samsung', 'flip7', '256G', 1485000, '5G', true, 50, true),
('SM-F766N_512G', '갤럭시 Z 플립7 512G',   'Samsung', 'flip7', '512G', 1643400, '5G', true, 51, true),
('SM-F761N',      '갤럭시 Z 플립7 FE',     'Samsung', 'flip7', null,   899000,  '5G', true, 60, true),

-- ── Samsung Galaxy S25 (2025) ─────────────────────────────────────
('SM-S731N',      '갤럭시 S25 FE',         'Samsung', 'galaxyS25', null,   946000,  '5G', false, 100, true),
('SM-S931N_256G', '갤럭시 S25 256G',        'Samsung', 'galaxyS25', '256G', 1155000, '5G', false, 110, true),
('SM-S931N_512G', '갤럭시 S25 512G',        'Samsung', 'galaxyS25', '512G', 1298000, '5G', false, 111, true),
('SM-S936N_256G', '갤럭시 S25+ 256G',       'Samsung', 'galaxyS25', '256G', 1353000, '5G', false, 120, true),
('SM-S936N_512G', '갤럭시 S25+ 512G',       'Samsung', 'galaxyS25', '512G', 1496000, '5G', false, 121, true),
('SM-S937N_256G', '갤럭시 S25 엣지 256G',   'Samsung', 'galaxyS25', '256G', 1496000, '5G', false, 130, true),
('SM-S937N_512G', '갤럭시 S25 엣지 512G',   'Samsung', 'galaxyS25', '512G', 1639000, '5G', false, 131, true),
('SM-S938N_256G', '갤럭시 S25 울트라 256G', 'Samsung', 'galaxyS25', '256G', 1698400, '5G', false, 140, true),
('SM-S938N_512G', '갤럭시 S25 울트라 512G', 'Samsung', 'galaxyS25', '512G', 1951400, '5G', false, 141, true),
('SM-S938N_1T',   '갤럭시 S25 울트라 1TB',  'Samsung', 'galaxyS25', '1TB',  2446400, '5G', false, 142, true),

-- ── Samsung Z Fold6 / Flip6 (legacy) ──────────────────────────────
('SM-F946N_256G', '갤럭시 Z 폴드6 256G',   'Samsung', 'fold6', '256G', 2098700, '5G', false, 200, true),
('SM-F946N_512G', '갤럭시 Z 폴드6 512G',   'Samsung', 'fold6', '512G', 2210700, '5G', false, 201, true),
('SM-F741N_256G', '갤럭시 Z 플립6 256G',   'Samsung', 'flip6', '256G', 1485000, '5G', false, 210, true),
('SM-F741N_512G', '갤럭시 Z 플립6 512G',   'Samsung', 'flip6', '512G', 1643400, '5G', false, 211, true),

-- ── Samsung 보급형 (A 시리즈 + M) ─────────────────────────────────
('SM-A366N', '갤럭시 A36', 'Samsung', 'galaxyEtc', null, 499400, '5G', false, 300, true),
('SM-M366N', '갤럭시 M36', 'Samsung', 'galaxyEtc', null, 499400, '5G', false, 310, true),
('SM-A175N', '갤럭시 A17', 'Samsung', 'galaxyEtc', null, 319000, '5G', false, 320, true),
('SM-A165N', '갤럭시 A16', 'Samsung', 'galaxyEtc', null, 279000, '5G', false, 330, true),
('SM-A566N', '갤럭시 A56', 'Samsung', 'galaxyEtc', null, 594000, '5G', false, 340, true),

-- ── Apple iPhone 17 (2025 flagship) ───────────────────────────────
('IP17_256G',   '아이폰 17 256G',        'Apple', 'iphone17', '256G', 1287000, '5G', true, 500, true),
('IP17_512G',   '아이폰 17 512G',        'Apple', 'iphone17', '512G', 1534000, '5G', true, 501, true),
('IP17P_256G',  '아이폰 17 PRO 256G',    'Apple', 'iphone17', '256G', 1782000, '5G', true, 510, true),
('IP17P_512G',  '아이폰 17 PRO 512G',    'Apple', 'iphone17', '512G', 2090000, '5G', true, 511, true),
('IP17P_1T',    '아이폰 17 PRO 1TB',     'Apple', 'iphone17', '1TB',  2398000, '5G', true, 512, true),
('IP17PM_256G', '아이폰 17 PRO MAX 256G','Apple', 'iphone17', '256G', 1980000, '5G', true, 520, true),
('IP17PM_512G', '아이폰 17 PRO MAX 512G','Apple', 'iphone17', '512G', 2288000, '5G', true, 521, true),
('IP17PM_1T',   '아이폰 17 PRO MAX 1TB', 'Apple', 'iphone17', '1TB',  2596000, '5G', true, 522, true),
('IP17e_256G',  '아이폰 17e 256G',       'Apple', 'iphone17', '256G', 990000,  '5G', true, 530, true),

-- ── Apple iPhone Air ──────────────────────────────────────────────
('IPA_256G', '아이폰 AIR 256G', 'Apple', 'iphoneAir', '256G', 1584000, '5G', true, 540, true),
('IPA_512G', '아이폰 AIR 512G', 'Apple', 'iphoneAir', '512G', 1892000, '5G', true, 541, true),
('IPA_1T',   '아이폰 AIR 1TB',  'Apple', 'iphoneAir', '1TB',  2188000, '5G', true, 542, true),

-- ── Apple iPhone 16 (2024, still selling) ─────────────────────────
('IP16_128G',    '아이폰 16 128G',         'Apple', 'iphone16', '128G', 1155000, '5G', false, 600, true),
('IP16_256G',    '아이폰 16 256G',         'Apple', 'iphone16', '256G', 1287000, '5G', false, 601, true),
('IP16_512G',    '아이폰 16 512G',         'Apple', 'iphone16', '512G', 1518000, '5G', false, 602, true),
('IP16P_256G',   '아이폰 16 PRO 256G',     'Apple', 'iphone16', '256G', 1529000, '5G', false, 610, true),
('IP16P_512G',   '아이폰 16 PRO 512G',     'Apple', 'iphone16', '512G', 1771000, '5G', false, 611, true),
('IP16PM_256G',  '아이폰 16 PRO MAX 256G', 'Apple', 'iphone16', '256G', 1892000, '5G', false, 620, true),
('IP16PM_512G',  '아이폰 16 PRO MAX 512G', 'Apple', 'iphone16', '512G', 2134000, '5G', false, 621, true),
('IP16PM_1T',    '아이폰 16 PRO MAX 1TB',  'Apple', 'iphone16', '1TB',  2376000, '5G', false, 622, true),
('IP16e_128G',   '아이폰 16e 128G',        'Apple', 'iphone16', '128G', 990000,  '5G', false, 630, true)

on conflict (model_code) do nothing;
