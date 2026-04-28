/**
 * CLOVA OCR 응답 → LGU+ 안성 SheetExtraction 매핑.
 *
 * 안성 시트 표 구조 (71행 × 36열):
 *   col 0: 모델명 (SM-xxx)
 *   col 1: 출고가 (raw 숫자)
 *   col 2: 모델명2 (팻네임)
 *   col 3: 차등 (비거나 "O")
 *
 *   그룹별 컬럼 — 각 3셀 [010, MNP, 기변]. 사이에 빈 컬럼 섞여 있음:
 *   col 4~7:   최고가군 (115군 이상) = G115
 *   col 8~11:  고가군 (95/105군) = G105
 *   col 12~14: 중저가군 (75/85군) = G85
 *   col 15~19: 저가군 (61/69군) = G69
 *   col 20~25: 최저가군 (44/55군) = G55
 *   col 26~30: 33군 청소년 = G33
 *
 *   col 32~35: 이통사지원금 (공시) — MNP 115군/55군 + 010 115군/55군
 *
 * 주의:
 *   - 단가 단위 ×10,000 (만원)
 *   - 공시지원금 원 단위로 이미 저장됨 (예: 500000)
 *   - 빈 col 존재 (CLOVA 표 인식이 일부 공백 칸을 셀로 잡음)
 */

import type { ClovaResponse } from './clova-ocr';
import type { SheetExtraction, ParsedModel, ModelTier } from './vision-schema';
import { extractCellsRemapped, type Cell } from './clova-cells-utils';

function parseNumberOrNull(s: string): number | null {
  if (!s) return null;
  const t = s.trim();
  if (t === '' || t === '-' || t === '—' || t === '·') return null;
  const decimalComma = /^-?\d+,\d{1,2}$/.test(t);
  const cleaned = decimalComma ? t.replace(',', '.') : t.replace(/,/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** 안성 그룹 정의: 각 그룹의 [010, MNP, 기변] 컬럼 인덱스 */
const GROUPS: Array<{ tier: string; cols: [number, number, number] }> = [
  { tier: 'G115', cols: [4, 6, 7] },
  { tier: 'G105', cols: [9, 10, 11] },
  { tier: 'G85',  cols: [12, 13, 14] },
  { tier: 'G69',  cols: [16, 18, 19] },
  { tier: 'G55',  cols: [21, 24, 25] },
  { tier: 'G33',  cols: [27, 29, 30] },
];

export function parseClovaAnseong(resp: ClovaResponse): SheetExtraction {
  const cells = extractCellsRemapped(resp);
  const grid = new Map<string, string>();
  for (const c of cells) grid.set(`${c.rowIndex}|${c.columnIndex}`, c.text);

  let maxRow = 0;
  for (const c of cells) if (c.rowIndex > maxRow) maxRow = c.rowIndex;

  const models: ParsedModel[] = [];

  for (let r = 0; r <= maxRow; r++) {
    const modelCode = (grid.get(`${r}|0`) ?? '').trim();
    if (!/^(SM-|UIP|UAW|AT-|IP)/.test(modelCode)) continue;

    const retail = parseNumberOrNull(grid.get(`${r}|1`) ?? '');
    const nickname = (grid.get(`${r}|2`) ?? '').trim();

    // 공시지원금: 이통사지원금 블록 (col 32~35)
    // col 32 = 이통사지원금 MNP 115군
    // col 33 = 이통사지원금 MNP 55군
    // col 34 = 이통사지원금 010 115군
    // col 35 = 이통사지원금 010 55군
    const subsidyMnp115 = parseNumberOrNull(grid.get(`${r}|32`) ?? '');
    const subsidyMnp55 = parseNumberOrNull(grid.get(`${r}|33`) ?? '');
    const subsidy010_115 = parseNumberOrNull(grid.get(`${r}|34`) ?? '');
    const subsidy010_55 = parseNumberOrNull(grid.get(`${r}|35`) ?? '');

    // 안성은 MNP 공시와 010 공시가 다를 수 있지만 단일 subsidy_krw 저장은 MNP 기준으로 저장 (관례)
    // 추후 스키마 확장 시 activation 별 subsidy 분리 가능
    const getSubsidy = (tier: string): number | null => {
      // 115군 = 최고가군, 55군 = 최저가군. 중간 tier 는 데이터 없음
      if (tier === 'G115' || tier === 'G105' || tier === 'G95' || tier === 'G85') {
        return subsidyMnp115;
      }
      return subsidyMnp55;
    };

    const tiers: ModelTier[] = [];
    for (const g of GROUPS) {
      const [c010, cMnp, cChange] = g.cols;
      const v010 = parseNumberOrNull(grid.get(`${r}|${c010}`) ?? '');
      const vMnp = parseNumberOrNull(grid.get(`${r}|${cMnp}`) ?? '');
      const vChange = parseNumberOrNull(grid.get(`${r}|${cChange}`) ?? '');

      if (v010 == null && vMnp == null && vChange == null) continue;

      tiers.push({
        plan_tier_code: g.tier,
        subsidy_krw: getSubsidy(g.tier),
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
