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
