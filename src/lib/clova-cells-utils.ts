/**
 * CLOVA OCR table cells 추출 + 좌표 기반 column 재매핑 공유 유틸.
 *
 * 문제: CLOVA가 시트마다 표 인식하면서 컬럼을 합치거나 시프트시키는 케이스 발생.
 * 그러면 columnIndex가 시각적 컬럼과 어긋나, 파서의 hardcoded 컬럼 idx 매핑이 깨짐.
 *
 * 해결: 각 cell의 boundingPoly 좌표(origX)로 anchor row(가장 cell 많은 row)를 찾고,
 * anchor의 i번째 cell origX 평균을 column representative로 잡아 모든 cell을 가장 가까운
 * rep으로 재할당. 결과적으로 columnIndex가 시각적 컬럼 위치와 일치하게 보정됨.
 *
 * boundingPoly 정보 없으면 원본 columnIndex로 안전 fallback.
 */

import type { ClovaResponse } from './clova-ocr';

type Vertex = { x: number; y: number };
type RawCell = {
  rowIndex: number;
  columnIndex: number;
  boundingPoly?: { vertices?: Vertex[] };
  cellTextLines?: Array<{
    cellWords?: Array<{
      inferText?: string;
      inferConfidence?: number;
      boundingPoly?: { vertices?: Vertex[] };
    }>;
  }>;
};

export type Cell = {
  rowIndex: number;
  columnIndex: number;
  text: string;
};

function cellAvgX(cell: RawCell): number | null {
  const cellVerts = cell.boundingPoly?.vertices ?? [];
  if (cellVerts.length) {
    return cellVerts.reduce((s, v) => s + v.x, 0) / cellVerts.length;
  }
  const wordVerts: Vertex[] = [];
  for (const line of cell.cellTextLines ?? []) {
    for (const w of line.cellWords ?? []) {
      const vs = w.boundingPoly?.vertices ?? [];
      for (const v of vs) wordVerts.push(v);
    }
  }
  if (!wordVerts.length) return null;
  return wordVerts.reduce((s, v) => s + v.x, 0) / wordVerts.length;
}

function extractCellText(cell: RawCell): string {
  const parts: string[] = [];
  for (const line of cell.cellTextLines ?? []) {
    for (const w of line.cellWords ?? []) {
      if (w.inferText) parts.push(w.inferText);
    }
  }
  return parts.join(' ').trim();
}

function buildColumnReps(rowCellsList: Array<Array<{ origX: number }>>): number[] {
  if (rowCellsList.length === 0) return [];
  const counts = rowCellsList.map((r) => r.length).filter((n) => n >= 2);
  if (counts.length === 0) return [];
  const sorted = [...counts].sort((a, b) => b - a);
  const topN = Math.max(1, Math.floor(sorted.length * 0.1));
  const K = Math.round(sorted.slice(0, topN).reduce((s, n) => s + n, 0) / topN);
  if (K < 2) return [];

  const anchors = rowCellsList.filter((r) => Math.abs(r.length - K) <= 1 && r.length >= 2);
  if (anchors.length === 0) return [];

  const sortedAnchors = anchors
    .map((r) => [...r].sort((a, b) => a.origX - b.origX))
    .sort((a, b) => b.length - a.length);

  const reps: number[] = [];
  for (let i = 0; i < K; i++) {
    const xs: number[] = [];
    for (const r of sortedAnchors) {
      if (i < r.length) xs.push(r[i].origX);
    }
    if (xs.length === 0) {
      const prev = reps[i - 1];
      reps.push(prev != null ? prev + 30 : 0);
    } else {
      reps.push(xs.reduce((s, x) => s + x, 0) / xs.length);
    }
  }
  return reps;
}

function assignToColumn(x: number, reps: number[]): number {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < reps.length; i++) {
    const d = Math.abs(x - reps[i]);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * CLOVA tables[0].cells에서 cells 추출 (원본 columnIndex 유지).
 * 단일 CLOVA 호출에서는 columnIndex가 이미 시각적 컬럼과 일치하므로 remap 불필요.
 *
 * 모든 거래처별 단일호출 파서가 사용하는 표준 진입점.
 */
export function extractCells(resp: ClovaResponse): Cell[] {
  const img = resp.images?.[0];
  if (!img) return [];
  const tables = (img as unknown as { tables?: Array<{ cells: RawCell[] }> }).tables;
  if (!tables || !tables[0]) return [];
  return tables[0].cells.map((c) => ({
    rowIndex: c.rowIndex,
    columnIndex: c.columnIndex,
    text: extractCellText(c),
  }));
}

/**
 * **타일 모드 전용** 좌표 기반 column 재매핑.
 *
 * 여러 CLOVA 호출 결과를 합칠 때(tile mode) 각 tile의 columnIndex가 서로 다른 인덱스
 * 체계를 갖기 때문에 origX 좌표로 재정렬 필요. 단일 호출에는 사용하지 말 것 — 빈 컬럼이
 * 있는 시트에서 K가 잘못 추정되어 cell 위치를 압축시킴.
 */
export function extractCellsRemapped(resp: ClovaResponse): Cell[] {
  const img = resp.images?.[0];
  if (!img) return [];
  const tables = (img as unknown as { tables?: Array<{ cells: RawCell[] }> }).tables;
  if (!tables || !tables[0]) return [];

  const rawCells = tables[0].cells.map((c) => ({
    rowIndex: c.rowIndex,
    columnIndex: c.columnIndex,
    text: extractCellText(c),
    origX: cellAvgX(c),
  }));

  // rowIndex로 그룹핑 (CLOVA의 row 인식은 보통 정확)
  const rowMap = new Map<number, Array<{ columnIndex: number; text: string; origX: number }>>();
  for (const c of rawCells) {
    if (c.origX == null) continue;
    if (!rowMap.has(c.rowIndex)) rowMap.set(c.rowIndex, []);
    rowMap.get(c.rowIndex)!.push({
      columnIndex: c.columnIndex,
      text: c.text,
      origX: c.origX,
    });
  }
  const rowCellsList = Array.from(rowMap.values());
  const reps = buildColumnReps(rowCellsList);
  const useReps = reps.length >= 2;

  const out: Cell[] = [];
  for (const c of rawCells) {
    let columnIndex = c.columnIndex;
    if (useReps && c.origX != null) {
      columnIndex = assignToColumn(c.origX, reps);
    }
    out.push({
      rowIndex: c.rowIndex,
      columnIndex,
      text: c.text,
    });
  }
  return out;
}
