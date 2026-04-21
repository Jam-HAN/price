export const CARRIERS = ['SKT', 'KT', 'LGU+'] as const;
export type Carrier = (typeof CARRIERS)[number];

export function formatKrw(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === '') return '-';
  const num = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(num)) return '-';
  return new Intl.NumberFormat('ko-KR').format(num);
}

export function formatManwon(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === '') return '-';
  const num = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(num)) return '-';
  return (num / 10_000).toFixed(num % 10_000 === 0 ? 0 : 1) + '만';
}

/**
 * 금액을 "##.#" 만원 단위 문자열로 포맷.
 * 규칙: 천원 미만은 내림(버림) — 예: 155,900원 → "15.5", 155,000원 → "15.5", 156,000원 → "15.6"
 * null/undefined/NaN → "—"
 */
export function formatMan(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  // 천원 단위로 내림(trunc toward 0) 후 / 10 = 만원 소수 1자리
  const man = Math.trunc(n / 1000) / 10;
  return man.toFixed(1);
}

/**
 * 시리즈 정렬 순서 — 최신 시리즈 먼저.
 * Samsung 섹션(0번대) → Apple 섹션(100번대) → 기타(200번대)
 * 시리즈 내부는 출고가 내림차순.
 */
const SERIES_ORDER: Record<string, number> = {
  galaxyS26: 0,
  fold7: 1,
  flip7: 2,
  galaxyS25: 3,
  fold6: 4,
  flip6: 5,
  galaxyEtc: 6,
  // Apple
  iphone17: 100,
  iphoneAir: 101,
  iphone16: 102,
  iphone15: 103,
  // 기타
  tablet: 200,
  wearable: 201,
  misc: 299,
};

function seriesOrder(series: string | null | undefined, nickname: string | null | undefined): number {
  const s = series ?? '';
  if (s in SERIES_ORDER) return SERIES_ORDER[s];
  // series 필드가 비어있을 때 nickname으로 추정
  const n = (nickname ?? '').toLowerCase();
  if (n.includes('갤럭시') || n.includes('galaxy') || n.includes('폴드') || n.includes('플립')) return 50;
  if (n.includes('아이폰') || n.includes('iphone')) return 150;
  return 250;
}

/**
 * 디바이스 리스트 정렬자 — 시리즈 순서(최신 먼저) → 시리즈 내 출고가 내림차순
 */
export function compareDevicesForList<T extends {
  nickname?: string | null;
  manufacturer?: string | null;
  series?: string | null;
  retail_price_krw?: number | null;
}>(a: T, b: T): number {
  const sa = seriesOrder(a.series, a.nickname);
  const sb = seriesOrder(b.series, b.nickname);
  if (sa !== sb) return sa - sb;
  const ra = a.retail_price_krw ?? 0;
  const rb = b.retail_price_krw ?? 0;
  return rb - ra;
}
