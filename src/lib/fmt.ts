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
 * 디바이스 리스트 정렬자 — Samsung 내림차순(출고가 높은 순) → Apple 내림차순 → 기타
 */
export function compareDevicesForList<T extends {
  nickname?: string | null;
  manufacturer?: string | null;
  retail_price_krw?: number | null;
}>(a: T, b: T): number {
  const grp = (d: T): number => {
    const m = (d.manufacturer ?? '').toLowerCase();
    const n = (d.nickname ?? '').toLowerCase();
    if (m.includes('samsung') || n.includes('갤럭시') || n.includes('galaxy')) return 0;
    if (m.includes('apple') || n.includes('아이폰') || n.includes('iphone')) return 1;
    return 2;
  };
  const ga = grp(a);
  const gb = grp(b);
  if (ga !== gb) return ga - gb;
  const ra = a.retail_price_krw ?? 0;
  const rb = b.retail_price_krw ?? 0;
  return rb - ra; // 출고가 높은 순
}
