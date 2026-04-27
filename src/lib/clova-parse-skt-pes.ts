/**
 * CLOVA OCR → SKT 피에스 SheetExtraction.
 *
 * 피에스 시트 (42행 × 53열 · 모델표만 crop된 후):
 *   col 0: 통신구분 (5G/LTE/S/D 등 — meta)
 *   col 1: 모델코드 (SM-xxx, IP17, AT-Mxxx 등)
 *   col 2: 팻네임 (갤럭시 S26, 아이폰17 등)
 *   col 3: 출고가 (천단위 — "1,254.0" → 1,254,000원)
 *
 *   각 구간 7셀 [공시지원금(천원), 공통 010/MNP/기변, 선약 010/MNP/기변]:
 *   col  4~10: 신규요금제불입정책 (5GX 프리미엄/클래티넘)  → T109
 *   col 11~17: I_100 (5GX 프라임 플러스/T플랜 액스)        → T100
 *   col 18~24: F_79  (5GX 프라임)                           → T79
 *   col 25~31: L_69  (5GX 레귤러 플러스/T플랜 스페셜)       → T69
 *   col 32~38: M_50  (베이직 플러스/T플랜 미디엄)           → T50
 *   col 39~45: R_43  (컴팩트/0틴 5G)                        → T43
 *   col 46~52: S_33  (T플랜 세이브/ZEM 플랜)                → T33
 *
 * 값 단위:
 *   - 공시지원금: 천원 × 1,000 → subsidy_krw (예: "500" → 500,000원)
 *   - 공통/선약: 만원 × 10,000 → common / select
 *   - 출고가: "1,254.0" = 1,254천원 = 1,254,000원 → 소수점 제거 후 × 1,000
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

/**
 * 피에스 파서 전용 sanity check.
 * 공통/선약 만원 단위 raw 값. 정상 0~80, 1000(=1천만원) 초과는 OCR 이상으로 간주 → null.
 */
function parseManAmountOrNull(s: string): number | null {
  const n = parseNumberOrNull(s);
  if (n == null) return null;
  if (n < 0 || n > 1000) return null;
  return n;
}

/**
 * 공시지원금 천원 단위 raw 값. 정상 0~500 정도, 10000(=1천만원) 초과는 OCR 이상.
 */
function parseChunAmountOrNull(s: string): number | null {
  const n = parseNumberOrNull(s);
  if (n == null) return null;
  if (n < 0 || n > 10_000) return null;
  return n;
}

const TIERS: Array<{ code: string; baseCol: number }> = [
  { code: '요금제붐업', baseCol: 4 },
  { code: 'I_100',      baseCol: 11 },
  { code: 'F_79',       baseCol: 18 },
  { code: 'L_69',       baseCol: 25 },
  { code: 'M_50',       baseCol: 32 },
  { code: 'R_43',       baseCol: 39 },
  { code: 'S_33',       baseCol: 46 },
];

export function parseClovaPes(resp: ClovaResponse): SheetExtraction {
  const cells = extractCells(resp);
  const grid = new Map<string, string>();
  for (const c of cells) grid.set(`${c.rowIndex}|${c.columnIndex}`, c.text);

  let maxRow = 0;
  for (const c of cells) if (c.rowIndex > maxRow) maxRow = c.rowIndex;

  const models: ParsedModel[] = [];

  for (let r = 0; r <= maxRow; r++) {
    // OCR이 인접 행 모델코드를 한 셀에 합치는 케이스 → 첫 토큰만 채택
    const modelCode = (grid.get(`${r}|1`) ?? '').trim().split(/\s+/)[0];
    if (!/^(SM-|UIP|UAW|AT-|IP[A\d]|AIP)/.test(modelCode)) continue;

    const nickname = (grid.get(`${r}|2`) ?? '').trim();
    // 출고가: "1,254.0" (천단위) → 1,254,000원. "1.254.0" 오인식도 수용 (숫자만 추출 후 × 1000)
    const retailRaw = (grid.get(`${r}|3`) ?? '').trim();
    const retailThousands = parseNumberOrNull(retailRaw);
    const retailComputed =
      retailThousands != null
        ? Math.round(retailThousands * 1_000)
        : (() => {
            const digits = retailRaw.replace(/\D/g, '');
            return digits ? Number(digits) : null;
          })();
    // 출고가 sanity: 0~1억원 범위 (1억 초과는 OCR 오류)
    const retail_price_krw =
      retailComputed != null && retailComputed >= 0 && retailComputed <= 100_000_000
        ? retailComputed
        : null;

    const tiers: ModelTier[] = [];
    for (const t of TIERS) {
      const b = t.baseCol;
      const subsidy = parseChunAmountOrNull(grid.get(`${r}|${b}`)     ?? '');
      const c010    = parseManAmountOrNull(grid.get(`${r}|${b + 1}`) ?? '');
      const cMnp    = parseManAmountOrNull(grid.get(`${r}|${b + 2}`) ?? '');
      const cChange = parseManAmountOrNull(grid.get(`${r}|${b + 3}`) ?? '');
      const s010    = parseManAmountOrNull(grid.get(`${r}|${b + 4}`) ?? '');
      const sMnp    = parseManAmountOrNull(grid.get(`${r}|${b + 5}`) ?? '');
      const sChange = parseManAmountOrNull(grid.get(`${r}|${b + 6}`) ?? '');

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

      if (subsidy == null && common == null && select == null) continue;

      tiers.push({
        plan_tier_code: t.code,
        subsidy_krw: subsidy != null ? Math.round(subsidy * 1_000) : null,
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
