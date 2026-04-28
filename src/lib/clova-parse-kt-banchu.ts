/**
 * CLOVA OCR → KT 반추 SheetExtraction.
 *
 * 반추 시트 (80행 × 23열) — 2행 per 모델 (공통/할원):
 *   col 0: 팻네임
 *   col 1: 기종 (모델명, SM-xxx)
 *   col 2: 출고가 (천단위 — "1,254" → 1,254,000원)
 *   col 3: 구분 ("공통" / "할원")
 *
 * 실제 raw 데이터 패턴 확인 결과:
 *   col 4~6:  초이스 스페셜 (T110) — 공시지원금 (천단위, 3 activation 같은 값 500/500/500)
 *   col 7~9:  5G 슬림 14 (SLIM14) — 공시지원금 (천단위, 300/300/300)
 *   col 10:   모델군 ("5G고가" 등 — 메타)
 *   col 11~13: 스페셜/프리미엄 (T100)      — 단가 [010신규, MNP, 보상]
 *   col 14~16: 5G 스페셜(Y) (T100 variant) — 단가
 *   col 17~19: 5G 심플 (T61)               — 단가
 *   col 20~22: 5G 슬림4~1 (T37)            — 단가
 *
 * 참고:
 *   - T110/SLIM14 구간은 공시지원금만 제공, 단가 없음 (거래처 정책)
 *   - 하위 tier 는 단가만 제공, 공시지원금 없음
 *   - 단가 단위 ×10,000, 공시지원금 단위 ×1,000
 *   - "할원" row 는 할부원금 (무시)
 */

import type { ClovaResponse } from './clova-ocr';
import type { SheetExtraction, ParsedModel, ModelTier } from './vision-schema';
import { extractCells, type Cell } from './clova-cells-utils';

function parseNumberOrNull(s: string): number | null {
  if (!s) return null;
  const t = s.trim();
  if (t === '' || t === '-' || t === '—' || t === '·') return null;
  const decimalComma = /^-?\d+,\d{1,2}$/.test(t);
  const cleaned = decimalComma ? t.replace(',', '.') : t.replace(/,/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** 공시지원금 전용 tier (col 4-6, 7-9) */
const SUBSIDY_TIERS: Array<{ tier: string; col: number }> = [
  { tier: 'T110',   col: 4 },
  { tier: 'SLIM14', col: 7 },
];

/** 단가 전용 tier (col 11~) */
const REBATE_TIERS: Array<{ tier: string; cols: [number, number, number] }> = [
  { tier: 'T100', cols: [11, 12, 13] },
  // col 14-16 은 T100 variant (Y) — 생략 (중복)
  { tier: 'T61',  cols: [17, 18, 19] },
  { tier: 'T37',  cols: [20, 21, 22] },
];

export function parseClovaBanchu(resp: ClovaResponse): SheetExtraction {
  const cells = extractCells(resp);
  const grid = new Map<string, string>();
  for (const c of cells) grid.set(`${c.rowIndex}|${c.columnIndex}`, c.text);

  let maxRow = 0;
  for (const c of cells) if (c.rowIndex > maxRow) maxRow = c.rowIndex;

  const models: ParsedModel[] = [];

  for (let r = 0; r <= maxRow; r++) {
    const modelCode = (grid.get(`${r}|1`) ?? '').trim();
    if (!/^(SM-|UIP|UAW|AT-|IP|F\d|S\d)/.test(modelCode)) continue;

    const divider = (grid.get(`${r}|3`) ?? '').trim();
    if (!divider.startsWith('공통')) continue; // "할원" row 무시

    const nickname = (grid.get(`${r}|0`) ?? '').trim();
    const retailThousands = parseNumberOrNull(grid.get(`${r}|2`) ?? '');
    const retail_price_krw = retailThousands != null ? Math.round(retailThousands * 1_000) : null;

    const tiers: ModelTier[] = [];

    // T110, SLIM14: 공시지원금만 제공 (3 activation 같은 값이므로 첫 칸 사용)
    for (const s of SUBSIDY_TIERS) {
      const sub = parseNumberOrNull(grid.get(`${r}|${s.col}`) ?? '');
      if (sub == null) continue;
      tiers.push({
        plan_tier_code: s.tier,
        subsidy_krw: Math.round(sub * 1_000), // 천원 단위
        common: { new010: null, mnp: null, change: null },
        select: null,
      });
    }

    // T100, T61, T37: 단가만 제공
    for (const g of REBATE_TIERS) {
      const [c010, cMnp, cChange] = g.cols;
      const v010 = parseNumberOrNull(grid.get(`${r}|${c010}`) ?? '');
      const vMnp = parseNumberOrNull(grid.get(`${r}|${cMnp}`) ?? '');
      const vChange = parseNumberOrNull(grid.get(`${r}|${cChange}`) ?? '');

      if (v010 == null && vMnp == null && vChange == null) continue;

      tiers.push({
        plan_tier_code: g.tier,
        subsidy_krw: null,
        common: {
          new010: v010 != null ? Math.round(v010 * 10_000) : null,
          mnp: vMnp != null ? Math.round(vMnp * 10_000) : null,
          change: vChange != null ? Math.round(vChange * 10_000) : null,
        },
        select: null,
      });
    }

    if (tiers.length === 0) continue;

    models.push({
      model_code_raw: modelCode,
      nickname,
      storage: null,
      retail_price_krw: retail_price_krw ?? 0,
      is_new: false,
      tiers,
    });
  }

  return {
    policy_round: null,
    effective_date: null,
    effective_time: null,
    models,
    policies: [],
  };
}
