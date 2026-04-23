export const CARRIERS = ['SKT', 'KT', 'LGU+'] as const;
export type Carrier = (typeof CARRIERS)[number];

export function formatKrw(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === '') return '-';
  const num = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(num)) return '-';
  return new Intl.NumberFormat('ko-KR').format(num);
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
 * 변형(variant) 순서 — Samsung: family 번호 오름차순 (S942 base < S947 plus < S948 ultra)
 * Apple: nickname 기반 (base < plus < pro < pro max)
 */
function variantOrder(code: string | null | undefined, nickname: string | null | undefined): number {
  const c = code ?? '';
  // Samsung family number에서 변형 추출 (SM-S942N → 942)
  const m = c.match(/^SM-[A-Z](\d{3})/);
  if (m) return parseInt(m[1], 10);

  const n = (nickname ?? '').toLowerCase();
  if (n.includes('pro max') || n.includes('프로 맥스')) return 4;
  if (n.includes(' pro') || n.includes('프로') || n.includes('ultra') || n.includes('울트라')) return 3;
  if (n.includes('plus') || n.includes('+') || n.includes('max')) return 2;
  if (n.includes(' air') || n.includes('에어')) return 1;
  return 0;
}

/** 용량을 원 단위 정수로 변환 (256G → 256, 1T → 1024) · null이면 0 */
function storageOrder(storage: string | null | undefined): number {
  if (!storage) return 0;
  const m = storage.match(/^(\d+)\s*([GT])/i);
  if (!m) return 0;
  const num = parseInt(m[1], 10);
  return m[2].toUpperCase() === 'T' ? num * 1024 : num;
}

/**
 * 디바이스 리스트 정렬자:
 *   1차: 시리즈 순서 (최신 먼저)
 *   2차: 변형 (base → plus → ultra / Pro / Pro Max)
 *   3차: 용량 오름차순 (null → 256 → 512 → 1TB)
 */
export function compareDevicesForList<T extends {
  model_code?: string | null;
  nickname?: string | null;
  manufacturer?: string | null;
  series?: string | null;
  storage?: string | null;
  retail_price_krw?: number | null;
}>(a: T, b: T): number {
  const sa = seriesOrder(a.series, a.nickname);
  const sb = seriesOrder(b.series, b.nickname);
  if (sa !== sb) return sa - sb;
  const va = variantOrder(a.model_code, a.nickname);
  const vb = variantOrder(b.model_code, b.nickname);
  if (va !== vb) return va - vb;
  const sta = storageOrder(a.storage);
  const stb = storageOrder(b.storage);
  return sta - stb;
}
