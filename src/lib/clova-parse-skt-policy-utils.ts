/**
 * SKT 청담/피에스 정책 영역 공통 파싱 유틸.
 *
 * 정책 region OCR 결과에서 추출:
 *   - policy_round: "04월 11차" 같은 정책 차수
 *   - effective_date: "04월 23일" → "YYYY-MM-DD"
 *   - effective_time: "00시 00분" → "HH:MM"
 *
 * 청담/피에스 정책 텍스트 구조 동일 ("정책 차수 : ", "적용 일시 : ").
 */

import type { ClovaResponse } from './clova-ocr';

export type PolicyMeta = {
  policy_round: string | null;
  effective_date: string | null;
  effective_time: string | null;
};

function extractAllText(resp: ClovaResponse): string {
  const img = resp.images?.[0];
  if (!img) return '';
  const tables = (img as unknown as {
    tables?: Array<{
      cells: Array<{
        cellTextLines?: Array<{ cellWords?: Array<{ inferText?: string }> }>;
      }>;
    }>;
  }).tables;
  const parts: string[] = [];
  for (const table of tables ?? []) {
    for (const cell of table.cells) {
      for (const line of cell.cellTextLines ?? []) {
        for (const w of line.cellWords ?? []) {
          if (w.inferText) parts.push(w.inferText);
        }
      }
    }
  }
  for (const f of img.fields ?? []) {
    if (f.inferText) parts.push(f.inferText);
  }
  return parts.join(' ');
}

function parseKoreanDate(monthDay: string): string | null {
  const m = monthDay.match(/(\d+)월\s*(\d+)일/);
  if (!m) return null;
  const month = m[1].padStart(2, '0');
  const day = m[2].padStart(2, '0');
  const year = new Date().getFullYear();
  return `${year}-${month}-${day}`;
}

function parseKoreanTime(timeStr: string): string | null {
  const m = timeStr.match(/(\d+)시\s*(\d+)분/);
  if (!m) return null;
  const h = m[1].padStart(2, '0');
  const min = m[2].padStart(2, '0');
  return `${h}:${min}`;
}

export function extractSktPolicyMeta(resp: ClovaResponse): PolicyMeta {
  const fullText = extractAllText(resp);

  const roundMatch =
    fullText.match(/정책\s*차수\s*[:：]?\s*(\d+월\s*\d+차)/) ??
    fullText.match(/(\d+월\s*\d+차)/);
  const policy_round = roundMatch ? roundMatch[1].replace(/\s+/g, ' ').trim() : null;

  const dateMatch = fullText.match(/적용\s*일시\s*[:：]?\s*(\d+월\s*\d+일)/);
  const effective_date = dateMatch ? parseKoreanDate(dateMatch[1]) : null;

  // 적용일시 라인 안에서 시간 추출 (다른 시간이 섞이지 않도록)
  const dateTimeBlock = fullText.match(/적용\s*일시[^]*?(\d+월\s*\d+일[^]*?\d+시\s*\d+분)/);
  const timeMatch = dateTimeBlock ? dateTimeBlock[1].match(/(\d+시\s*\d+분)/) : null;
  const effective_time = timeMatch ? parseKoreanTime(timeMatch[1]) : null;

  return { policy_round, effective_date, effective_time };
}
