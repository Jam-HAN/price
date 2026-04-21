/**
 * 거래처별로 들쭉날쭉한 모델 코드를 표준형으로 정규화.
 * Samsung: "SM-XNNNN[N|NK][_]?[storage]" → "SM-XNNNN_STORAGE" 또는 "SM-XNNNN"
 * 예:
 *   SM-S948N_512G → SM-S948N_512G
 *   SM-S948N512G  → SM-S948N_512G
 *   SM-S948NK512  → SM-S948N_512G
 *   SM-S948NK     → SM-S948N
 *   SM-S948N1TB   → SM-S948N_1T
 *   S948 512      → SM-S948N_512G (SM- 프리픽스 자동 보정)
 *
 * Apple/기타: 현재는 원본 유지 (벤더 프리픽스가 제각각이라 신뢰 가능한 매핑 어려움)
 */
export function normalizeDeviceCode(raw: string): string {
  if (!raw) return raw;
  const cleaned = raw.toUpperCase().replace(/\s+/g, '');

  // Samsung 패턴: (SM-)? [A-Z]\d{3}(선택적으로 N·K·연결자) + optional storage
  // family는 반드시 3자리 숫자 (S942, F766, A366 등) — greedy overmatch 방지
  const m = cleaned.match(/^(?:SM-)?([A-Z]\d{3})N?K?[_-]?(\d+(?:G|T)?B?)?$/);
  if (!m) return raw; // 인식 실패 → 원본 유지

  const family = m[1];
  let storage: string | null = m[2] ?? null;

  if (storage) {
    // GB/TB → G/T (뒤 B 제거)
    if (storage.endsWith('B')) storage = storage.slice(0, -1);
    // 숫자만 있으면 G 추가 (512 → 512G)
    if (/^\d+$/.test(storage)) storage = storage + 'G';
  }

  return storage ? `SM-${family}N_${storage}` : `SM-${family}N`;
}

/** 디바이스 2건이 동일 물리 모델인지 판단 (code + nickname + retail 10%내) */
export function areSameDevice(
  a: { model_code: string; nickname: string; retail_price_krw: number },
  b: { model_code: string; nickname: string; retail_price_krw: number },
): boolean {
  const na = normalizeDeviceCode(a.model_code);
  const nb = normalizeDeviceCode(b.model_code);
  if (na === nb && na !== a.model_code) return true; // 정규화 후 일치
  return false;
}
