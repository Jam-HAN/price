import type { SheetExtraction, ParsedModel } from './vision-schema';

export type SuspicionFlag = {
  model_code: string;
  nickname: string;
  issue: 'repeated_values' | 'all_null' | 'uniform_row';
  detail: string;
};

/**
 * 파싱된 models 중 "의심스러운" 행 찾기.
 * - repeated_values: 같은 (contract, activation) 조합의 값이 3개 이상 구간에서 연속 동일
 * - uniform_row: 한 구간의 6개 값(공통3+선약3)이 전부 같음
 * - all_null: common/select가 전부 null
 */
export function detectSuspiciousModels(sheet: SheetExtraction): SuspicionFlag[] {
  const flags: SuspicionFlag[] = [];
  for (const m of sheet.models ?? []) {
    const tiers = m.tiers ?? [];
    if (tiers.length === 0) continue;

    // all_null
    const anyValue = tiers.some((t) => t.common || t.select);
    if (!anyValue) {
      flags.push({
        model_code: m.model_code_raw,
        nickname: m.nickname,
        issue: 'all_null',
        detail: '모든 구간 단가 없음',
      });
      continue;
    }

    // repeated_values: (contract, activation) 축으로 세로 스캔
    const runs: string[] = [];
    for (const contract of ['common', 'select'] as const) {
      for (const act of ['new010', 'mnp', 'change'] as const) {
        const values = tiers.map((t) => (t[contract]?.[act] ?? null));
        let run = 1;
        for (let i = 1; i < values.length; i++) {
          if (values[i] != null && values[i] === values[i - 1]) {
            run++;
            if (run >= 3) {
              runs.push(`${contract}.${act} 연속 ${run}회 동일 (${values[i]})`);
              break;
            }
          } else {
            run = 1;
          }
        }
      }
    }
    if (runs.length > 0) {
      flags.push({
        model_code: m.model_code_raw,
        nickname: m.nickname,
        issue: 'repeated_values',
        detail: runs.slice(0, 3).join(' · '),
      });
    }

    // uniform_row: 한 tier의 모든 6값이 동일한 경우 (의심)
    for (const t of tiers) {
      const vals = [
        t.common?.new010,
        t.common?.mnp,
        t.common?.change,
        t.select?.new010,
        t.select?.mnp,
        t.select?.change,
      ].filter((v): v is number => v != null);
      if (vals.length >= 4 && new Set(vals).size === 1) {
        flags.push({
          model_code: m.model_code_raw,
          nickname: m.nickname,
          issue: 'uniform_row',
          detail: `${t.plan_tier_code} 구간 값 전부 ${vals[0]}`,
        });
        break; // 한 모델당 최대 1회만 flag
      }
    }
  }
  return flags;
}

/**
 * 재파싱된 모델 배열을 원본 sheet.models에 머지.
 * model_code_raw가 같으면 교체, 없으면 추가.
 */
export function mergeReparsedModels(
  original: SheetExtraction,
  reparsed: ParsedModel[],
): SheetExtraction {
  const codeSet = new Set(reparsed.map((r) => r.model_code_raw));
  const filtered = (original.models ?? []).filter((m) => !codeSet.has(m.model_code_raw));
  return {
    ...original,
    models: [...filtered, ...reparsed],
  };
}
