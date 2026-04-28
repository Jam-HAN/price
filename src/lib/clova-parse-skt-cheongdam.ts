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
 * 청담 파서 전용 sanity check. 단가/공시지원금은 모두 만원 단위로 들어오며
 * 정상 범위는 0~80만원(=raw n 0~80). 보수적으로 1천만원(=raw n 1000) 초과는 OCR
 * 이상으로 간주하고 null 처리. 운영DB sync에서 견적이 망가지는 사고 방지.
 *
 * 발견된 OCR 오류 예시: raw "3050400000" 같은 30억 단위 값.
 */
/**
 * nickname/retail이 한 셀에 여러 개 합쳐진 경우 토큰 수만큼 split.
 */
function splitNicknameTokens(nick: string, count: number): string[] {
  if (count <= 1 || !nick) return [nick];
  const PREFIXES = ['갤럭시', 'IPHONE', '아이폰', 'Z플립', 'Z폴드', '갤S', 'ZEM'];
  for (const prefix of PREFIXES) {
    if (!nick.includes(prefix)) continue;
    const parts = nick
      .split(new RegExp(`\\s*(?=${prefix})`, 'g'))
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (parts.length === count) return parts;
  }
  return [];
}

function splitRetailTokens(raw: string, count: number): string[] {
  if (count <= 1 || !raw) return [raw];
  const parts = raw.split(/\s+/).filter((s) => /[0-9]/.test(s));
  return parts.length === count ? parts : [];
}

function parseManAmountOrNull(s: string): number | null {
  const n = parseNumberOrNull(s);
  if (n == null) return null;
  if (n < 0 || n > 1000) return null;
  return n;
}

/**
 * 각 tier의 anchor(모델코드 컬럼) 기준 상대 오프셋.
 * 청담 정상 레이아웃: anchor=col 0, 팻네임 col 1, 출고가 col 2, 요금제붐업 col 3~9, ...
 * CLOVA가 region마다 통신구분 같은 부가 컬럼을 검출하면 anchor=col 1 → baseCol = anchor + 3 = 4.
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

export function parseClovaCheongdam(resp: ClovaResponse): SheetExtraction {
  const cells = extractCells(resp);
  const grid = new Map<string, string>();
  for (const c of cells) grid.set(`${c.rowIndex}|${c.columnIndex}`, c.text);

  let maxRow = 0;
  for (const c of cells) if (c.rowIndex > maxRow) maxRow = c.rowIndex;

  const models: ParsedModel[] = [];

  const modelCodeRegex = /^(SM-|UIP|UAW|AT-|IP[A\d]|AIP)/;

  // anchor 컬럼 자동 감지 (모델코드 매치가 가장 많은 컬럼)
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
  const sortedCols = Array.from(colMatchCount.keys()).sort((a, b) => a - b);
  for (const col of sortedCols) {
    const cnt = colMatchCount.get(col) ?? 0;
    if (cnt >= 2 && cnt > bestCount * 0.7) {
      if (cnt > bestCount) {
        anchorCol = col;
        bestCount = cnt;
      } else if (anchorCol < 0) {
        anchorCol = col;
        bestCount = cnt;
      }
    }
  }
  if (anchorCol < 0) anchorCol = 0; // fallback (cheongdam 기본)

  for (let r = 0; r <= maxRow; r++) {
    const rawAnchor = (grid.get(`${r}|${anchorCol}`) ?? '').trim();
    if (!rawAnchor) continue;

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

      // nickname: 통합 셀 분할 우선, 실패 시 dataRow에서
      let nickname = '';
      const fullNick = (grid.get(`${r}|${anchorCol + 1}`) ?? '').trim();
      if (tokens.length > 1) {
        const nickParts = splitNicknameTokens(fullNick, tokens.length);
        if (nickParts.length === tokens.length) {
          nickname = nickParts[tIdx];
        }
      }
      if (!nickname) {
        nickname = (grid.get(`${dataRow}|${anchorCol + 1}`) ?? '').trim();
      }

      // retail: 동일 패턴 (청담은 원 단위 정수)
      let retailRawText = '';
      const fullRetail = (grid.get(`${r}|${anchorCol + 2}`) ?? '').trim();
      if (tokens.length > 1) {
        const retailParts = splitRetailTokens(fullRetail, tokens.length);
        if (retailParts.length === tokens.length) {
          retailRawText = retailParts[tIdx];
        }
      }
      if (!retailRawText) {
        retailRawText = (grid.get(`${dataRow}|${anchorCol + 2}`) ?? '').trim();
      }
      const retailDigits = retailRawText.replace(/\D/g, '');
      const retailRaw = retailDigits ? Number(retailDigits) : null;
      const retail_price_krw =
        retailRaw != null && retailRaw >= 0 && retailRaw <= 100_000_000 ? retailRaw : null;

      // 워치(SM-Lxxx) row는 OCR 컨테미네이션이 잦음.
      // 같은 row의 모든 tier 만원 값들을 모아 median × 10을 outlier cap으로 사용.
      // (자의적 임계값이 아닌 row 자체 분포 기반 — 고가 워치도 자동 적응)
      const isWatch = /^SM-L\d/.test(modelCode);
      let watchCap = Infinity;
      if (isWatch) {
        const rowVals: number[] = [];
        for (const t of TIERS) {
          const b = anchorCol + t.relOffset;
          for (let off = 0; off <= 6; off++) {
            const v = parseManAmountOrNull(grid.get(`${dataRow}|${b + off}`) ?? '');
            if (v != null) rowVals.push(v);
          }
        }
        if (rowVals.length >= 5) {
          const sorted = [...rowVals].sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length / 2)];
          watchCap = Math.max(median * 10, 10); // 최소 cap 10만원 보장
        }
      }
      const watchClamp = (v: number | null): number | null =>
        v != null && v > watchCap ? null : v;

      const tiers: ModelTier[] = [];
      for (const t of TIERS) {
        const b = anchorCol + t.relOffset;
        const prime   = watchClamp(parseManAmountOrNull(grid.get(`${dataRow}|${b}`)     ?? ''));
        const c010    = watchClamp(parseManAmountOrNull(grid.get(`${dataRow}|${b + 1}`) ?? ''));
        const cMnp    = watchClamp(parseManAmountOrNull(grid.get(`${dataRow}|${b + 2}`) ?? ''));
        const cChange = watchClamp(parseManAmountOrNull(grid.get(`${dataRow}|${b + 3}`) ?? ''));
        const s010    = watchClamp(parseManAmountOrNull(grid.get(`${dataRow}|${b + 4}`) ?? ''));
        const sMnp    = watchClamp(parseManAmountOrNull(grid.get(`${dataRow}|${b + 5}`) ?? ''));
        const sChange = watchClamp(parseManAmountOrNull(grid.get(`${dataRow}|${b + 6}`) ?? ''));

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
  }

  return {
    policy_round: null,
    effective_date: null,
    effective_time: null,
    models,
    policies: [],
  };
}
