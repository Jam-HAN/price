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

/**
 * 피에스 파서 전용 sanity check.
 * 공통/선약 만원 단위 raw 값. CLOVA가 OCR에서 소수점을 떨어뜨리는 케이스가 빈번
 * (예: "33.3" → "333", "48.0" → "480", "1.5" → "15") → 100배 부풀려진 값 발생.
 *
 * 휴리스틱: 100 초과 + 10의 배수면 소수점 누락으로 간주 → /10 보정.
 * (100 이상 정상 값은 11, 17, 23 등 10의 배수 아닌 raw로 들어와 보호됨)
 *
 * 1000 초과는 두 자리 누락이거나 셀 합쳐짐 등 명백 오류 → null.
 */
function parseManAmountOrNull(s: string): number | null {
  const n = parseNumberOrNull(s);
  if (n == null) return null;
  if (n < 0 || n > 1000) return null;
  if (n > 100 && n % 10 === 0) return n / 10;
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

/**
 * 각 tier의 anchor(모델코드 컬럼) 기준 상대 오프셋.
 * 정상 레이아웃: anchor=col 1, 통신구분 col 0, 팻네임 col 2, 출고가 col 3, 요금제붐업 col 4~10, ...
 *   → 요금제붐업 baseCol=4 = anchor(1) + 3.
 * CLOVA가 통신구분 컬럼을 검출 못 한 region에서는 anchor=col 0 → baseCol = anchor + 3 = 3.
 */
const TIERS: Array<{ code: string; relOffset: number }> = [
  { code: '요금제붐업', relOffset: 3 },
  { code: 'I_100',      relOffset: 10 },
  { code: 'F_79',       relOffset: 17 },
  { code: 'L_69',       relOffset: 24 },
  { code: 'M_50',       relOffset: 31 },
  { code: 'R_43',       relOffset: 38 },
  { code: 'S_33',       relOffset: 45 },
];

export function parseClovaPes(resp: ClovaResponse): SheetExtraction {
  const cells = extractCells(resp);
  const grid = new Map<string, string>();
  for (const c of cells) grid.set(`${c.rowIndex}|${c.columnIndex}`, c.text);

  let maxRow = 0;
  for (const c of cells) if (c.rowIndex > maxRow) maxRow = c.rowIndex;

  const models: ParsedModel[] = [];

  const modelCodeRegex = /^(SM-|UIP|UAW|AT-|IP[A\d]|AIP)/;

  // anchor 컬럼 자동 감지: 모델코드 매치가 가장 많은 leftmost 컬럼.
  // CLOVA가 region마다 다른 컬럼 구조로 인식해 모델코드가 col 0 또는 col 1에 있을 수 있음.
  const colMatchCount = new Map<number, number>();
  for (const c of cells) {
    const tokens = c.text.trim().split(/\s+/);
    for (const t of tokens) {
      if (modelCodeRegex.test(t)) {
        colMatchCount.set(c.columnIndex, (colMatchCount.get(c.columnIndex) ?? 0) + 1);
        break;
      }
    }
  }
  let anchorCol = -1;
  let bestCount = 0;
  // leftmost가 우선이지만 매치 수도 충분해야 함 (>=2)
  const sortedCols = Array.from(colMatchCount.keys()).sort((a, b) => a - b);
  for (const col of sortedCols) {
    const cnt = colMatchCount.get(col) ?? 0;
    if (cnt >= 2 && cnt > bestCount * 0.7) {
      // leftmost 우선이지만, 우측에 더 많은 매치가 있으면 그쪽 채택
      if (cnt > bestCount) {
        anchorCol = col;
        bestCount = cnt;
      } else if (anchorCol < 0) {
        anchorCol = col;
        bestCount = cnt;
      }
    }
  }
  if (anchorCol < 0) anchorCol = 1; // fallback

  for (let r = 0; r <= maxRow; r++) {
    const rawAnchor = (grid.get(`${r}|${anchorCol}`) ?? '').trim();
    if (!rawAnchor) continue;

    // 한 셀에 여러 모델코드 (예: "SM-L325N SM-L335N") → 모두 추출
    const tokens = rawAnchor.split(/\s+/).filter((t) => modelCodeRegex.test(t));
    if (tokens.length === 0) continue;

    for (let tIdx = 0; tIdx < tokens.length; tIdx++) {
      const modelCode = tokens[tIdx];
      let dataRow = r;
      if (tIdx > 0) {
        const candidate = r + tIdx;
        if (candidate <= maxRow) {
          const candidateAnchor = (grid.get(`${candidate}|${anchorCol}`) ?? '').trim();
          if (!candidateAnchor) dataRow = candidate;
        }
      }

      const nickname = (grid.get(`${dataRow}|${anchorCol + 1}`) ?? '').trim();
      const retailRaw = (grid.get(`${dataRow}|${anchorCol + 2}`) ?? '').trim();
      const retailThousands = parseNumberOrNull(retailRaw);
      const retailComputed =
        retailThousands != null
          ? Math.round(retailThousands * 1_000)
          : (() => {
              const digits = retailRaw.replace(/\D/g, '');
              return digits ? Number(digits) : null;
            })();
      const retail_price_krw =
        retailComputed != null && retailComputed >= 0 && retailComputed <= 100_000_000
          ? retailComputed
          : null;

      const tiers: ModelTier[] = [];
      for (const t of TIERS) {
        const b = anchorCol + t.relOffset;
        const subsidy = parseChunAmountOrNull(grid.get(`${dataRow}|${b}`)     ?? '');
        const c010    = parseManAmountOrNull(grid.get(`${dataRow}|${b + 1}`) ?? '');
        const cMnp    = parseManAmountOrNull(grid.get(`${dataRow}|${b + 2}`) ?? '');
        const cChange = parseManAmountOrNull(grid.get(`${dataRow}|${b + 3}`) ?? '');
        const s010    = parseManAmountOrNull(grid.get(`${dataRow}|${b + 4}`) ?? '');
        const sMnp    = parseManAmountOrNull(grid.get(`${dataRow}|${b + 5}`) ?? '');
        const sChange = parseManAmountOrNull(grid.get(`${dataRow}|${b + 6}`) ?? '');

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
  }

  return {
    policy_round: null,
    effective_date: null,
    effective_time: null,
    models,
    policies: [],
  };
}
