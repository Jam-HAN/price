import type { SheetExtraction, ParsedModel } from './vision-schema';

/**
 * 셀 단위 이상치 감지.
 * 네 가지 규칙:
 *  1. pair_mismatch — 같은 통신사 짝거래처와 10만원 이상 차이 (red)
 *  2. day_drift    — 같은 거래처 전일 대비 15% 이상 변동 (yellow)
 *  3. monotonic    — 상위 구간 단가 < 하위 구간 단가 (단가는 보통 tier 내려갈수록 ↓) (yellow)
 *  4. range        — subsidy 0~80만 벗어남 / 단가 -10만~80만 벗어남 (red)
 */

export type CellField =
  | 'retail_price_krw'
  | 'subsidy_krw'
  | 'common.new010' | 'common.mnp' | 'common.change'
  | 'select.new010' | 'select.mnp' | 'select.change';

export type Severity = 'red' | 'yellow';

export type FlagReason = 'pair_mismatch' | 'day_drift' | 'monotonic' | 'range';

export type CellFlag = {
  model_code_raw: string;
  plan_tier_code: string | null;
  field: CellField;
  value: number | null;
  severity: Severity;
  reason: FlagReason;
  detail: string;
};

const FIELDS_RESERVED = {
  SUBSIDY_MIN: 0,
  SUBSIDY_MAX: 800000,
  QUOTE_MIN: -100000,
  QUOTE_MAX: 800000,
  PAIR_DIFF_LIMIT: 100000,   // 10만원
  DAY_DRIFT_PCT: 0.15,       // 15%
};

// ─── 셀 추출 헬퍼 ────────────────────────────────────────────────

function getCellValue(model: ParsedModel, tierCode: string, field: CellField): number | null {
  if (field === 'retail_price_krw') return model.retail_price_krw ?? null;
  const tier = model.tiers?.find((t) => t.plan_tier_code === tierCode);
  if (!tier) return null;
  if (field === 'subsidy_krw') return tier.subsidy_krw ?? null;
  const [blockKey, actKey] = field.split('.') as [
    'common' | 'select',
    'new010' | 'mnp' | 'change',
  ];
  const block = tier[blockKey];
  return block ? (block[actKey] ?? null) : null;
}

export const ALL_QUOTE_FIELDS: CellField[] = [
  'subsidy_krw',
  'common.new010', 'common.mnp', 'common.change',
  'select.new010', 'select.mnp', 'select.change',
];

// ─── 1. 범위 검증 ────────────────────────────────────────────────

function checkRange(sheet: SheetExtraction): CellFlag[] {
  const flags: CellFlag[] = [];
  for (const m of sheet.models ?? []) {
    for (const t of m.tiers ?? []) {
      // subsidy
      if (t.subsidy_krw != null) {
        if (t.subsidy_krw < FIELDS_RESERVED.SUBSIDY_MIN || t.subsidy_krw > FIELDS_RESERVED.SUBSIDY_MAX) {
          flags.push({
            model_code_raw: m.model_code_raw,
            plan_tier_code: t.plan_tier_code,
            field: 'subsidy_krw',
            value: t.subsidy_krw,
            severity: 'red',
            reason: 'range',
            detail: `공시지원금 범위 이탈 (${t.subsidy_krw.toLocaleString()}원, 허용 0~80만)`,
          });
        }
      }
      // quote cells
      for (const blockKey of ['common', 'select'] as const) {
        const block = t[blockKey];
        if (!block) continue;
        for (const actKey of ['new010', 'mnp', 'change'] as const) {
          const v = block[actKey];
          if (v == null) continue;
          if (v < FIELDS_RESERVED.QUOTE_MIN || v > FIELDS_RESERVED.QUOTE_MAX) {
            flags.push({
              model_code_raw: m.model_code_raw,
              plan_tier_code: t.plan_tier_code,
              field: `${blockKey}.${actKey}` as CellField,
              value: v,
              severity: 'red',
              reason: 'range',
              detail: `단가 범위 이탈 (${v.toLocaleString()}원)`,
            });
          }
        }
      }
    }
  }
  return flags;
}

// ─── 2. 단조성 검증 ──────────────────────────────────────────────
// 보통 tier 내려갈수록 단가 ↓, subsidy ↓. 위반 시 yellow.

function checkMonotonic(sheet: SheetExtraction, tierOrder: string[]): CellFlag[] {
  const flags: CellFlag[] = [];
  for (const m of sheet.models ?? []) {
    // tiers를 정해진 순서로 정렬
    const ordered = tierOrder
      .map((code) => m.tiers?.find((t) => t.plan_tier_code === code))
      .filter((t): t is NonNullable<typeof t> => !!t);
    if (ordered.length < 3) continue;

    // subsidy monotonic (상위 tier subsidy >= 하위 tier subsidy 가정)
    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1];
      const curr = ordered[i];
      if (prev.subsidy_krw != null && curr.subsidy_krw != null) {
        if (curr.subsidy_krw > prev.subsidy_krw + 50000) {
          flags.push({
            model_code_raw: m.model_code_raw,
            plan_tier_code: curr.plan_tier_code,
            field: 'subsidy_krw',
            value: curr.subsidy_krw,
            severity: 'yellow',
            reason: 'monotonic',
            detail: `${curr.plan_tier_code} 공시(${curr.subsidy_krw / 1000}천) > ${prev.plan_tier_code} 공시(${prev.subsidy_krw / 1000}천)`,
          });
        }
      }
    }

    // 단가(quote)의 monotonic 방향은 거래처 구조에 따라 달라서 false positive 많음 → 제외.
    // subsidy 단조성만 유지.
  }
  return flags;
}

// ─── 3. 페어 거래처 간 비교 ────────────────────────────────────

export function checkPairMismatch(
  current: SheetExtraction,
  pair: SheetExtraction | null,
  tierOrder: string[],
): CellFlag[] {
  if (!pair) return [];
  const flags: CellFlag[] = [];
  // 페어 모델 매핑: nickname 기준 (거래처별 raw 코드 다를 수 있음)
  const pairByNick = new Map<string, ParsedModel>();
  for (const pm of pair.models ?? []) pairByNick.set(pm.nickname, pm);

  for (const m of current.models ?? []) {
    const pm = pairByNick.get(m.nickname);
    if (!pm) continue;
    for (const tierCode of tierOrder) {
      for (const f of ALL_QUOTE_FIELDS) {
        const a = getCellValue(m, tierCode, f);
        const b = getCellValue(pm, tierCode, f);
        if (a == null || b == null) continue;
        const diff = Math.abs(a - b);
        if (diff > FIELDS_RESERVED.PAIR_DIFF_LIMIT) {
          flags.push({
            model_code_raw: m.model_code_raw,
            plan_tier_code: tierCode,
            field: f,
            value: a,
            severity: 'red',
            reason: 'pair_mismatch',
            detail: `페어 대비 ${diff.toLocaleString()}원 차이 (이쪽=${a.toLocaleString()}, 페어=${b.toLocaleString()})`,
          });
        }
      }
    }
  }
  return flags;
}

// ─── 4. 전일 대비 ────────────────────────────────────────────────

export function checkDayDrift(
  current: SheetExtraction,
  previous: SheetExtraction | null,
  tierOrder: string[],
): CellFlag[] {
  if (!previous) return [];
  const flags: CellFlag[] = [];
  const prevByCode = new Map<string, ParsedModel>();
  for (const pm of previous.models ?? []) prevByCode.set(pm.model_code_raw, pm);

  for (const m of current.models ?? []) {
    const pm = prevByCode.get(m.model_code_raw);
    if (!pm) continue;
    for (const tierCode of tierOrder) {
      for (const f of ALL_QUOTE_FIELDS) {
        const a = getCellValue(m, tierCode, f);
        const b = getCellValue(pm, tierCode, f);
        if (a == null || b == null) continue;
        if (Math.abs(b) < 10000) continue; // 기준값 너무 작으면 %편차 부정확
        const pct = Math.abs(a - b) / Math.abs(b);
        if (pct > FIELDS_RESERVED.DAY_DRIFT_PCT) {
          flags.push({
            model_code_raw: m.model_code_raw,
            plan_tier_code: tierCode,
            field: f,
            value: a,
            severity: 'yellow',
            reason: 'day_drift',
            detail: `전일 대비 ${Math.round(pct * 100)}% 변동 (${b.toLocaleString()} → ${a.toLocaleString()})`,
          });
        }
      }
    }
  }
  return flags;
}

// ─── 합본 ─────────────────────────────────────────────────────────

export function runAllChecks(params: {
  sheet: SheetExtraction;
  pair: SheetExtraction | null;
  previous: SheetExtraction | null;
  carrier: 'SKT' | 'KT' | 'LGU+';
}): CellFlag[] {
  const tierOrder = TIER_ORDER[params.carrier];
  return [
    ...checkRange(params.sheet),
    ...checkMonotonic(params.sheet, tierOrder),
    ...checkPairMismatch(params.sheet, params.pair, tierOrder),
    ...checkDayDrift(params.sheet, params.previous, tierOrder),
  ];
}

/** 셀 단위 flag 키 */
export function flagKey(f: { model_code_raw: string; plan_tier_code: string | null; field: CellField }) {
  return `${f.model_code_raw}|${f.plan_tier_code ?? ''}|${f.field}`;
}

/** 같은 셀에 여러 flag가 있으면 red 우선 */
export function dedupeFlagsByCell(flags: CellFlag[]): Map<string, CellFlag> {
  const map = new Map<string, CellFlag>();
  for (const f of flags) {
    const k = flagKey(f);
    const existing = map.get(k);
    if (!existing || (f.severity === 'red' && existing.severity !== 'red')) {
      map.set(k, f);
    }
  }
  return map;
}

const TIER_ORDER: Record<'SKT' | 'KT' | 'LGU+', string[]> = {
  SKT: ['BASE', 'I_100', 'F_79', 'L_69', 'M_50', 'R_43', 'S_33'],
  KT: ['T110', 'T100', 'SLIM14', 'T61', 'T37'],
  'LGU+': ['G115', 'G105', 'G95', 'G85', 'G69', 'G55', 'G33'],
};
