/**
 * parser_key → CLOVA parser 함수 라우팅.
 *
 * 거래처별 시트 레이아웃이 달라 공통 파서가 불가능.
 * 매핑은 DB `price_vendors.parser_key` 컬럼으로 관리 (거래처 추가 시 소스 배포 불필요,
 * 다만 새 parser 함수는 여기에 등록해야 함).
 */

import type { ClovaResponse } from './clova-ocr';
import type { SheetExtraction } from './vision-schema';
import { parseClovaLGU } from './clova-parse-lgu';
import { parseClovaAnseong } from './clova-parse-lgu-anseong';
import { parseClovaBanchu } from './clova-parse-kt-banchu';
import { parseClovaNear } from './clova-parse-kt-near';
import { parseClovaCheongdam } from './clova-parse-skt-cheongdam';
import { parseClovaCheongdamPolicy } from './clova-parse-skt-cheongdam-policy';
import { parseClovaPes } from './clova-parse-skt-pes';
import { parseClovaPesPolicy } from './clova-parse-skt-pes-policy';

type ClovaParser = (resp: ClovaResponse) => SheetExtraction;

export type ClovaRouteEntry = {
  parser: ClovaParser;
  label: string;
};

const PARSERS: Record<string, ClovaRouteEntry> = {
  'lgu-daesan':    { parser: parseClovaLGU,       label: 'LGU+ 대산' },
  'lgu-anseong':   { parser: parseClovaAnseong,   label: 'LGU+ 안성' },
  'kt-banchu':     { parser: parseClovaBanchu,    label: 'KT 반추' },
  'kt-near':       { parser: parseClovaNear,      label: 'KT 니어' },
  'skt-cheongdam': { parser: parseClovaCheongdam, label: 'SKT 청담' },
  'skt-cheongdam-policy': { parser: parseClovaCheongdamPolicy, label: 'SKT 청담 정책 (placeholder)' },
  'skt-pes':       { parser: parseClovaPes,       label: 'SKT 피에스' },
  'skt-pes-policy': { parser: parseClovaPesPolicy, label: 'SKT 피에스 정책 (placeholder)' },
};

export function resolveClovaParser(parserKey: string | null | undefined): ClovaRouteEntry | null {
  if (!parserKey) return null;
  return PARSERS[parserKey] ?? null;
}

export function listParserKeys(): string[] {
  return Object.keys(PARSERS);
}
