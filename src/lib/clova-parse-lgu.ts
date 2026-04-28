/**
 * CLOVA OCR 응답 → LGU+ SheetExtraction 매핑.
 *
 * LGU+ 대산 시트 표 구조 (60행 × 33열):
 *   col 0: 모델명 (SM-xxx)
 *   col 1: 팻네임 / 저장용량 포함 (예: "S26 512GB")
 *   col 2: 재고
 *   col 3: 출고가 (콤마 포함)
 *   col 4: 차등
 *   col 5~8:  그룹1 (115군) [공시, 신규, MNP, 재가입]
 *   col 9~12: 그룹2 (105군)
 *   col 13~16: 그룹3 (95군)
 *   col 17~20: 그룹4 (85군)
 *   col 21~24: 그룹5 (61군)
 *   col 25~28: 그룹6 (55군)
 *   col 29~32: 그룹7 (29군)
 *
 * plan_tier_code 매핑:
 *   그룹1 → G115, 그룹2 → G105, 그룹3 → G95, 그룹4 → G85,
 *   그룹5 → G69, 그룹6 → G55, 그룹7 → G33
 */

import type { ClovaResponse } from './clova-ocr';
import type { SheetExtraction, ParsedModel, ModelTier } from './vision-schema';

const LGU_GROUP_TO_TIER: Record<number, string> = {
  1: 'G115',
  2: 'G105',
  3: 'G95',
  4: 'G85',
  5: 'G69',
  6: 'G55',
  7: 'G33',
};

import { extractCells, type Cell } from './clova-cells-utils';

function toGrid(cells: Cell[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of cells) {
    m.set(`${c.rowIndex}|${c.columnIndex}`, c.text);
  }
  return m;
}

function parseNumberOrNull(s: string): number | null {
  if (!s) return null;
  const t = s.trim();
  if (t === '' || t === '-' || t === '—' || t === '·') return null;
  // "50,0" 같은 한국 소수점 쉼표 (OCR 노이즈) — 쉼표 뒤 1~2자리면 소수
  // "1,254,000" 같은 천단위 — 쉼표 뒤 3자리씩
  const decimalComma = /^-?\d+,\d{1,2}$/.test(t);
  const cleaned = decimalComma ? t.replace(',', '.') : t.replace(/,/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * LGU+ 시트 표 → SheetExtraction 변환.
 *
 * 헤더 행(대개 row 0~4) 스킵하고 col 0 에 모델코드가 있는 행부터 데이터 행으로 간주.
 */
export function parseClovaLGU(resp: ClovaResponse): SheetExtraction {
  const cells = extractCells(resp);
  const grid = toGrid(cells);

  // 그리드의 최대 행/열 파악
  let maxRow = 0;
  for (const c of cells) if (c.rowIndex > maxRow) maxRow = c.rowIndex;

  const models: ParsedModel[] = [];

  for (let r = 0; r <= maxRow; r++) {
    const modelCode = (grid.get(`${r}|0`) ?? '').trim();
    // 모델 코드 패턴: SM- 로 시작하거나, UIP/AT 등 벤더 프리픽스
    if (!/^(SM-|UIP|UAW|AT-|IP)/.test(modelCode)) continue;

    const nickname = (grid.get(`${r}|1`) ?? '').trim();
    const retailRaw = (grid.get(`${r}|3`) ?? '').trim();
    const retail = parseNumberOrNull(retailRaw);

    const tiers: ModelTier[] = [];
    for (let g = 1; g <= 7; g++) {
      const baseCol = 5 + (g - 1) * 4;
      const subsidyRaw = grid.get(`${r}|${baseCol}`) ?? '';
      const newRaw = grid.get(`${r}|${baseCol + 1}`) ?? '';
      const mnpRaw = grid.get(`${r}|${baseCol + 2}`) ?? '';
      const changeRaw = grid.get(`${r}|${baseCol + 3}`) ?? '';

      const subsidyVal = parseNumberOrNull(subsidyRaw);
      const newVal = parseNumberOrNull(newRaw);
      const mnpVal = parseNumberOrNull(mnpRaw);
      const changeVal = parseNumberOrNull(changeRaw);

      // subsidy: 만원 단위 ×10,000 (대산은 "50.0" = 500,000원)
      const subsidy_krw = subsidyVal != null ? Math.round(subsidyVal * 10_000) : null;
      // 단가: 만원 단위 ×10,000
      const commonNew = newVal != null ? Math.round(newVal * 10_000) : null;
      const commonMnp = mnpVal != null ? Math.round(mnpVal * 10_000) : null;
      const commonChange = changeVal != null ? Math.round(changeVal * 10_000) : null;

      // 행 전체가 비어있으면 스킵
      if (subsidy_krw == null && commonNew == null && commonMnp == null && commonChange == null) continue;

      tiers.push({
        plan_tier_code: LGU_GROUP_TO_TIER[g],
        subsidy_krw,
        common: {
          new010: commonNew,
          mnp: commonMnp,
          change: commonChange,
        },
        select: null,
      });
    }

    if (tiers.length === 0) continue;

    models.push({
      model_code_raw: modelCode,
      nickname,
      storage: null,
      retail_price_krw: retail ?? 0,
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
