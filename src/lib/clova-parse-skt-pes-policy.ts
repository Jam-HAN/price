/**
 * SKT 피에스 시트 정책 영역 파서.
 * 정책 차수 / 적용 일시 / 적용 시간 추출 (clova-parse-skt-policy-utils 공유).
 */

import type { ClovaResponse } from './clova-ocr';
import type { SheetExtraction } from './vision-schema';
import { extractSktPolicyMeta } from './clova-parse-skt-policy-utils';

export function parseClovaPesPolicy(resp: ClovaResponse): SheetExtraction {
  const meta = extractSktPolicyMeta(resp);
  return {
    policy_round: meta.policy_round,
    effective_date: meta.effective_date,
    effective_time: meta.effective_time,
    models: [],
    policies: [],
  };
}
