/**
 * CLOVA OCR → SKT 청담 SheetExtraction.
 *
 * 청담 시트 (51행 × 52열 · 모델표만 crop된 후):
 *   col 0: 모델코드 (SM-xxx, IP17, AT-Mxxx, UIP 등)
 *   col 1: 팻네임 (S26_256G, 아이폰17, 스타일폴더 등)
 *   col 2: 출고가 ("1,254,000" 포맷)
 *
 *   각 구간 7셀 [프라임+, 공통 010/MNP/기변, 선약 010/MNP/기변]:
 *   col  3~ 9: 109요금제 (신규요금제불입정책)  → T109
 *   col 10~16: I_100 구간 (5GX 프리미엄/T플랜 맥스) → T100
 *   col 17~23: F_79  구간 (5GX 프라임)           → T79
 *   col 24~30: L_69  구간 (5GX 레귤러)            → T69
 *   col 31~37: M_50  구간 (베이직 플러스+)        → T50
 *   col 38~44: R_43  구간 (컴팩트/0틴 5G)         → T43
 *   col 45~51: S_33  구간 (T플랜 세이브)          → T33
 *
 * 값 단위:
 *   - 프라임+ : 만원 × 10,000 → subsidy_krw
 *   - 공통지원금/선택약정: 만원 × 10,000 → common / select
 *   - 출고가: 원 단위 (콤마 제거)
 */

import type { ClovaResponse } from './clova-ocr';
import type { SheetExtraction, ParsedModel, ModelTier } from './vision-schema';

type Cell = { rowIndex: number; columnIndex: number; text: string };

function extractCells(resp: ClovaResponse): Cell[] {
  const img = resp.images?.[0];
  if (!img) return [];
  const tables = (img as unknown as { tables?: Array<{ cells: Array<{ rowIndex: number; columnIndex: number; cellTextLines?: Array<{ cellWords?: Array<{ inferText?: string }> }> }> }> }).tables;
  if (!tables || !tables[0]) return [];
  const out: Cell[] = [];
  for (const c of tables[0].cells) {
    const words: string[] = [];
    for (const line of c.cellTextLines ?? []) {
      for (const w of line.cellWords ?? []) {
        if (w.inferText) words.push(w.inferText);
      }
    }
    out.push({ rowIndex: c.rowIndex, columnIndex: c.columnIndex, text: words.join(' ').trim() });
  }
  return out;
}

function parseNumberOrNull(s: string): number | null {
  if (!s) return null;
  const t = s.trim();
  if (t === '' || t === '-' || t === '—' || t === '·') return null;
  const decimalComma = /^-?\d+,\d{1,2}$/.test(t);
  const cleaned = decimalComma ? t.replace(',', '.') : t.replace(/,/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const TIERS: Array<{ code: string; baseCol: number }> = [
  { code: '요금제붐업', baseCol: 3 },
  { code: 'I_100',      baseCol: 10 },
  { code: 'F_79',       baseCol: 17 },
  { code: 'L_69',       baseCol: 24 },
  { code: 'M_50',       baseCol: 31 },
  { code: 'R_43',       baseCol: 38 },
  { code: 'S_33',       baseCol: 45 },
];

export function parseClovaCheongdam(resp: ClovaResponse): SheetExtraction {
  const cells = extractCells(resp);
  const grid = new Map<string, string>();
  for (const c of cells) grid.set(`${c.rowIndex}|${c.columnIndex}`, c.text);

  let maxRow = 0;
  for (const c of cells) if (c.rowIndex > maxRow) maxRow = c.rowIndex;

  const models: ParsedModel[] = [];

  for (let r = 0; r <= maxRow; r++) {
    const modelCode = (grid.get(`${r}|0`) ?? '').trim();
    if (!/^(SM-|UIP|UAW|AT-|IP[A\d]|AIP)/.test(modelCode)) continue;

    const nickname = (grid.get(`${r}|1`) ?? '').trim();
    const retailDigits = (grid.get(`${r}|2`) ?? '').replace(/\D/g, '');
    const retail_price_krw = retailDigits ? Number(retailDigits) : null;

    const tiers: ModelTier[] = [];
    for (const t of TIERS) {
      const b = t.baseCol;
      const prime   = parseNumberOrNull(grid.get(`${r}|${b}`)     ?? '');
      const c010    = parseNumberOrNull(grid.get(`${r}|${b + 1}`) ?? '');
      const cMnp    = parseNumberOrNull(grid.get(`${r}|${b + 2}`) ?? '');
      const cChange = parseNumberOrNull(grid.get(`${r}|${b + 3}`) ?? '');
      const s010    = parseNumberOrNull(grid.get(`${r}|${b + 4}`) ?? '');
      const sMnp    = parseNumberOrNull(grid.get(`${r}|${b + 5}`) ?? '');
      const sChange = parseNumberOrNull(grid.get(`${r}|${b + 6}`) ?? '');

      const common =
        c010 == null && cMnp == null && cChange == null
          ? null
          : {
              new010: c010 != null ? Math.round(c010 * 10_000) : null,
              mnp: cMnp != null ? Math.round(cMnp * 10_000) : null,
              change: cChange != null ? Math.round(cChange * 10_000) : null,
            };
      const select =
        s010 == null && sMnp == null && sChange == null
          ? null
          : {
              new010: s010 != null ? Math.round(s010 * 10_000) : null,
              mnp: sMnp != null ? Math.round(sMnp * 10_000) : null,
              change: sChange != null ? Math.round(sChange * 10_000) : null,
            };

      if (prime == null && common == null && select == null) continue;

      tiers.push({
        plan_tier_code: t.code,
        subsidy_krw: prime != null ? Math.round(prime * 10_000) : null,
        common,
        select,
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
