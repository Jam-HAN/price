/**
 * CLOVA OCR 타일 분할 호출 + 결과 합치기.
 *
 * 단일 이미지가 너무 커서 CLOVA 15s timeout(DEADLINE_EXCEEDED)을 넘는 경우,
 * 활성 영역(yRatio0~yRatio1)을 N개로 세로 분할해 각각 호출하고
 * tables[0].cells 좌표를 원본 픽셀 좌표로 환원해 단일 이미지처럼 합친다.
 *
 * 합친 결과를 ClovaImage 형태로 반환하여 기존 거래처별 파서를 그대로 재사용.
 */

import { cropAndResize, type CropSpec } from './image-crop';
import { clovaExtract, type ClovaImage } from './clova-ocr';

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

type StagedCell = {
  origX: number;
  origY: number;
  columnIndex: number;
  text: string;
  confidence: number;
};

const Y_TOLERANCE_ORIG_PX = 12;
const OVERLAP_RATIO = 0.05;

function cellAvgPos(cell: RawCell): Vertex | null {
  const cellVerts = cell.boundingPoly?.vertices ?? [];
  if (cellVerts.length) {
    return {
      x: cellVerts.reduce((s, v) => s + v.x, 0) / cellVerts.length,
      y: cellVerts.reduce((s, v) => s + v.y, 0) / cellVerts.length,
    };
  }
  const wordVerts: Vertex[] = [];
  for (const line of cell.cellTextLines ?? []) {
    for (const w of line.cellWords ?? []) {
      const vs = w.boundingPoly?.vertices ?? [];
      for (const v of vs) wordVerts.push(v);
    }
  }
  if (!wordVerts.length) return null;
  return {
    x: wordVerts.reduce((s, v) => s + v.x, 0) / wordVerts.length,
    y: wordVerts.reduce((s, v) => s + v.y, 0) / wordVerts.length,
  };
}

function extractCellText(cell: RawCell): { text: string; confidence: number } {
  const parts: string[] = [];
  const confs: number[] = [];
  for (const line of cell.cellTextLines ?? []) {
    for (const w of line.cellWords ?? []) {
      if (w.inferText) parts.push(w.inferText);
      if (typeof w.inferConfidence === 'number') confs.push(w.inferConfidence);
    }
  }
  const conf = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0;
  return { text: parts.join(' ').trim(), confidence: conf };
}

export async function tileAndExtract(opts: {
  imageBytes: Buffer;
  spec: CropSpec;
  tileCount: 2 | 3;
}): Promise<ClovaImage> {
  const sharp = (await import('sharp')).default;
  const meta = await sharp(opts.imageBytes).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (!W || !H) throw new Error('이미지 메타데이터 없음');

  const x0 = opts.spec.xRatio0 ?? 0;
  const x1 = opts.spec.xRatio1 ?? 1;
  const yA = opts.spec.yRatio0;
  const yB = opts.spec.yRatio1;
  const N = opts.tileCount;
  const targetW = opts.spec.targetWidth;

  const overlap = (yB - yA) * OVERLAP_RATIO;
  const tileH = (yB - yA) / N;

  const staged: StagedCell[] = [];

  for (let i = 0; i < N; i++) {
    const tileY0 = Math.max(0, yA + i * tileH - (i > 0 ? overlap : 0));
    const tileY1 = Math.min(1, yA + (i + 1) * tileH + (i < N - 1 ? overlap : 0));

    const tileSpec: CropSpec = {
      yRatio0: tileY0,
      yRatio1: tileY1,
      xRatio0: x0,
      xRatio1: x1,
      targetWidth: targetW,
    };

    const tileBytes = await cropAndResize(opts.imageBytes, tileSpec);
    const img = await clovaExtract({ imageBytes: tileBytes, format: 'png' });

    // 원본 좌표계로 환산하기 위한 기준점 + 스케일
    const origLeft = Math.max(0, Math.round(W * x0));
    const origRight = Math.min(W, Math.round(W * x1));
    const origTop = Math.max(0, Math.round(H * tileY0));
    const origBottom = Math.min(H, Math.round(H * tileY1));
    const origCropW = Math.max(1, origRight - origLeft);
    const origCropH = Math.max(1, origBottom - origTop);
    // sharp resize({ width: targetW, fit: 'inside' }) — 가로를 targetW로 맞추고 비율 유지.
    // 단, 이미 가로가 작은 경우 그대로 둠 → 실측 비례로 scale 산출.
    const scale = targetW <= origCropW ? targetW / origCropW : 1;

    // 오버랩 dedup: tile_i가 책임지는 origY 범위
    const halfOverlapPx = (overlap * H) / 2;
    const keepTop = i === 0 ? origTop : origTop + halfOverlapPx;
    const keepBottom = i === N - 1 ? origBottom : origBottom - halfOverlapPx;

    const tables = (img as unknown as { tables?: Array<{ cells: RawCell[] }> }).tables;
    const cells: RawCell[] = tables?.[0]?.cells ?? [];

    for (const cell of cells) {
      const pos = cellAvgPos(cell);
      if (!pos) continue;
      const origY = pos.y / scale + origTop;
      const origX = pos.x / scale + origLeft;
      if (origY < keepTop || origY > keepBottom) continue;
      const { text, confidence } = extractCellText(cell);
      if (!text) continue;
      staged.push({
        origX,
        origY,
        columnIndex: cell.columnIndex,
        text,
        confidence,
      });
    }
  }

  // y 좌표로 row 재클러스터링 (원본 좌표 기준 yTolerance)
  staged.sort((a, b) => a.origY - b.origY);
  const rows: StagedCell[][] = [];
  let current: StagedCell[] = [];
  let avgY = -Infinity;
  for (const c of staged) {
    if (current.length === 0 || Math.abs(c.origY - avgY) <= Y_TOLERANCE_ORIG_PX) {
      current.push(c);
      avgY = current.reduce((s, x) => s + x.origY, 0) / current.length;
    } else {
      rows.push(current);
      current = [c];
      avgY = c.origY;
    }
  }
  if (current.length) rows.push(current);

  // 각 row 내 columnIndex 충돌(오버랩 edge) 시 confidence 우선
  const mergedCells: RawCell[] = [];
  rows.forEach((row, rowIndex) => {
    const byCol = new Map<number, StagedCell>();
    for (const c of row) {
      const prev = byCol.get(c.columnIndex);
      if (!prev || c.confidence > prev.confidence) byCol.set(c.columnIndex, c);
    }
    const sortedCols = Array.from(byCol.values()).sort(
      (a, b) => a.columnIndex - b.columnIndex,
    );
    for (const c of sortedCols) {
      mergedCells.push({
        rowIndex,
        columnIndex: c.columnIndex,
        cellTextLines: [
          {
            cellWords: [{ inferText: c.text, inferConfidence: c.confidence }],
          },
        ],
      });
    }
  });

  // 합쳐진 단일 ClovaImage (tables[0].cells에 패키징)
  return {
    uid: 'tiled',
    name: 'tiled',
    inferResult: 'SUCCESS',
    fields: [],
    tables: [{ cells: mergedCells }],
  } as unknown as ClovaImage;
}
