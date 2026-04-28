/**
 * CLOVA OCR → KT 니어 SheetExtraction.
 *
 * 니어 시트 (45행 × 33열):
 *   col 0: 모델명 (자체 포맷 — "AIP17", "F966 256", "S942N_512G")
 *   col 1: 개통 할부원금
 *   col 2: 단말기 구분 (5G 고가 등)
 *
 *   그룹별 (각 6셀 — 공시지원금 3 + 단가 3):
 *   col 3~8:   T110 (110,000원)  — [공시:신규,MNP,기변] [단가:신규,MNP,기변]
 *   col 9~14:  T100 (100,000원)
 *   col 15~20: T61  (61,000원)
 *   col 21~26: T37  (37,000원)
 *
 *   col 27+: 정책 부가 컬럼 (부가서비스, 추가지원금 등 — 스킵)
 *
 * 단위:
 *   - 공시지원금: 천원 ×1,000
 *   - 단가: 만원 ×10,000
 *   - 니어는 activation 별 공시지원금이 다를 수 있음 → MNP 값을 대표로 저장
 */

import type { ClovaResponse } from './clova-ocr';
import type { SheetExtraction, ParsedModel, ModelTier } from './vision-schema';
import { extractCellsRemapped, type Cell } from './clova-cells-utils';

function parseNumberOrNull(s: string): number | null {
  if (!s) return null;
  const t = s.trim().replace(/[.\s]+$/, ''); // "5." 꼬리 점 제거
  if (t === '' || t === '-' || t === '—' || t === '·') return null;
  const decimalComma = /^-?\d+,\d{1,2}$/.test(t);
  const cleaned = decimalComma ? t.replace(',', '.') : t.replace(/[,.]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** 니어 그룹: [공시 신규·MNP·기변 cols, 단가 신규·MNP·기변 cols] */
const GROUPS: Array<{
  tier: string;
  subsidy: [number, number, number];
  rebate: [number, number, number];
}> = [
  { tier: 'T110', subsidy: [3, 4, 5],    rebate: [6, 7, 8] },
  { tier: 'T100', subsidy: [9, 10, 11],  rebate: [12, 13, 14] },
  { tier: 'T61',  subsidy: [15, 16, 17], rebate: [18, 19, 20] },
  { tier: 'T37',  subsidy: [21, 22, 23], rebate: [24, 25, 26] },
];

export function parseClovaNear(resp: ClovaResponse): SheetExtraction {
  const cells = extractCellsRemapped(resp);
  const grid = new Map<string, string>();
  for (const c of cells) grid.set(`${c.rowIndex}|${c.columnIndex}`, c.text);

  let maxRow = 0;
  for (const c of cells) if (c.rowIndex > maxRow) maxRow = c.rowIndex;

  const models: ParsedModel[] = [];

  for (let r = 0; r <= maxRow; r++) {
    const modelCodeRaw = (grid.get(`${r}|0`) ?? '').trim();
    // 니어의 모델 코드는 자체 포맷 — 영문 + 숫자로 시작하면 모델 행으로 간주
    if (!/^[A-Z]/.test(modelCodeRaw) || modelCodeRaw.length < 2) continue;
    // 헤더 단어 제외
    if (/^(모델|팻네임|기종|단말기|공통|공시|정책|추가|유튜브|개통)/.test(modelCodeRaw)) continue;

    const retailRaw = grid.get(`${r}|1`) ?? '';
    // 니어 출고가 포맷 "1.290.000" 또는 "1,290,000" 또는 "1:290:000" 다양 — 숫자만 추출
    const retailDigits = retailRaw.replace(/\D/g, '');
    const retail_price_krw = retailDigits ? Number(retailDigits) : null;

    const tiers: ModelTier[] = [];
    for (const g of GROUPS) {
      const [sub010, subMnp, subChange] = g.subsidy;
      const [reb010, rebMnp, rebChange] = g.rebate;

      // 공시지원금 — MNP 값을 대표로 (단일 값 schema). 없으면 신규 fallback
      const subMnpV = parseNumberOrNull(grid.get(`${r}|${subMnp}`) ?? '');
      const sub010V = parseNumberOrNull(grid.get(`${r}|${sub010}`) ?? '');
      const subsidyRaw = subMnpV ?? sub010V;
      const subsidy_krw = subsidyRaw != null ? Math.round(subsidyRaw * 1_000) : null;

      const v010 = parseNumberOrNull(grid.get(`${r}|${reb010}`) ?? '');
      const vMnp = parseNumberOrNull(grid.get(`${r}|${rebMnp}`) ?? '');
      const vChange = parseNumberOrNull(grid.get(`${r}|${rebChange}`) ?? '');

      if (v010 == null && vMnp == null && vChange == null && subsidy_krw == null) continue;

      tiers.push({
        plan_tier_code: g.tier,
        subsidy_krw,
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
      model_code_raw: modelCodeRaw,
      nickname: modelCodeRaw,
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
