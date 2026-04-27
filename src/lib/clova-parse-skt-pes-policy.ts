/**
 * SKT 피에스 시트의 정책/공시 영역 파서 (placeholder).
 *
 * regions 모드에서 model_table 영역과 분리해 정책·공시지원금·effective_date 등을 별도 파싱하기 위한 파서.
 *
 * 현재 구현은 placeholder — 빈 결과를 반환.
 * 실제 정책 영역 OCR 결과(`_regions_debug.policy.sampleCells`)를 보고 작성 예정.
 */

import type { ClovaResponse } from './clova-ocr';
import type { SheetExtraction } from './vision-schema';

export function parseClovaPesPolicy(_resp: ClovaResponse): SheetExtraction {
  return {
    policy_round: null,
    effective_date: null,
    effective_time: null,
    models: [],
    policies: [],
  };
}
