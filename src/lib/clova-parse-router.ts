/**
 * vendor 이름 → CLOVA parser 함수 라우팅.
 *
 * 거래처별 시트 레이아웃이 달라 공통 파서가 불가능 — 벤더명으로 매칭.
 * 이미지 crop spec은 DB `price_vendors.crop_spec` 컬럼에서 관리 (프론트에서 수정 가능).
 */

import type { ClovaResponse } from './clova-ocr';
import type { SheetExtraction } from './vision-schema';
import { parseClovaLGU } from './clova-parse-lgu';
import { parseClovaAnseong } from './clova-parse-lgu-anseong';
import { parseClovaBanchu } from './clova-parse-kt-banchu';
import { parseClovaNear } from './clova-parse-kt-near';
import { parseClovaCheongdam } from './clova-parse-skt-cheongdam';
import { parseClovaPes } from './clova-parse-skt-pes';

type ClovaParser = (resp: ClovaResponse) => SheetExtraction;

export type ClovaRouteEntry = {
  parser: ClovaParser;
  label: string;
};

const VENDOR_PARSERS: Array<{ pattern: RegExp } & ClovaRouteEntry> = [
  { pattern: /대산/,   parser: parseClovaLGU,       label: 'LGU+ 대산' },
  { pattern: /안성/,   parser: parseClovaAnseong,   label: 'LGU+ 안성' },
  { pattern: /반추/,   parser: parseClovaBanchu,    label: 'KT 반추' },
  { pattern: /니어/,   parser: parseClovaNear,      label: 'KT 니어' },
  { pattern: /청담/,   parser: parseClovaCheongdam, label: 'SKT 청담' },
  { pattern: /피에스/, parser: parseClovaPes,       label: 'SKT 피에스' },
];

export function resolveClovaParser(vendorName: string): ClovaRouteEntry | null {
  for (const entry of VENDOR_PARSERS) {
    if (entry.pattern.test(vendorName)) {
      return { parser: entry.parser, label: entry.label };
    }
  }
  return null;
}
