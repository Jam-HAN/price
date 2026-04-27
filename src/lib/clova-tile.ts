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

/**
 * 분할 모드 매핑 — UX 단순화를 위해 항상 가로 2분할 고정.
 *   2분할 = 2x1 (좌/우 반)
 *   4분할 = 2x2
 *   6분할 = 2x3 (긴 시트용)
 */
function tileGrid(tileCount: 2 | 4 | 6): { cols: number; rows: number } {
  if (tileCount === 2) return { cols: 2, rows: 1 };
  if (tileCount === 4) return { cols: 2, rows: 2 };
  return { cols: 2, rows: 3 };
}

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

/**
 * 행별 cell 수의 mode = K(컬럼 개수)로 추정.
 * cell 수가 K인 row들을 anchor로 잡고, anchor의 i번째 cell origX 평균을 column i representative로.
 * mode 신뢰가 낮으면(K<2 또는 anchor 비율 낮음) 빈 배열 반환 → caller가 columnIndex로 fallback.
 */
function buildColumnRepresentatives(rows: StagedCell[][]): number[] {
  if (rows.length === 0) return [];

  const counts = rows.map((r) => r.length);
  const freq = new Map<number, number>();
  for (const n of counts) freq.set(n, (freq.get(n) ?? 0) + 1);

  let K = 0;
  let bestFreq = 0;
  for (const [n, f] of freq) {
    if (n >= 2 && f > bestFreq) {
      K = n;
      bestFreq = f;
    }
  }
  if (K < 2) return [];

  const anchors = rows.filter((r) => r.length === K);
  if (anchors.length === 0) return [];

  const sortedAnchors = anchors.map((r) => [...r].sort((a, b) => a.origX - b.origX));
  const reps: number[] = [];
  for (let i = 0; i < K; i++) {
    let sum = 0;
    for (const r of sortedAnchors) sum += r[i].origX;
    reps.push(sum / sortedAnchors.length);
  }
  console.log(
    `[clova-tile] column reps K=${K} from ${anchors.length}/${rows.length} anchor rows (modeFreq=${bestFreq})`,
  );
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
  tileCount: 2 | 4 | 6;
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
  const targetW = opts.spec.targetWidth;

  // 분할 모드: 항상 가로 2분할 + 세로 1/2/3 = 2/4/6 tile.
  const grid = tileGrid(opts.tileCount);
  const overlapY = (yB - yA) * OVERLAP_RATIO;
  const overlapX = (x1 - x0) * OVERLAP_RATIO;
  const tileH = (yB - yA) / grid.rows;
  const tileXW = (x1 - x0) / grid.cols;

  const staged: StagedCell[] = [];

  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const tileY0 = Math.max(0, yA + r * tileH - (r > 0 ? overlapY : 0));
      const tileY1 = Math.min(1, yA + (r + 1) * tileH + (r < grid.rows - 1 ? overlapY : 0));
      const tileX0 = Math.max(0, x0 + c * tileXW - (c > 0 ? overlapX : 0));
      const tileX1 = Math.min(1, x0 + (c + 1) * tileXW + (c < grid.cols - 1 ? overlapX : 0));

      const tileSpec: CropSpec = {
        yRatio0: tileY0,
        yRatio1: tileY1,
        xRatio0: tileX0,
        xRatio1: tileX1,
        targetWidth: targetW,
      };

      const tileBytes = await cropAndResize(opts.imageBytes, tileSpec);
      const img = await clovaExtract({ imageBytes: tileBytes, format: 'png' });

      const origLeft = Math.max(0, Math.round(W * tileX0));
      const origRight = Math.min(W, Math.round(W * tileX1));
      const origTop = Math.max(0, Math.round(H * tileY0));
      const origBottom = Math.min(H, Math.round(H * tileY1));
      const origCropW = Math.max(1, origRight - origLeft);
      const scale = targetW <= origCropW ? targetW / origCropW : 1;

      const halfOverlapYPx = (overlapY * H) / 2;
      const halfOverlapXPx = (overlapX * W) / 2;
      const keepTop = r === 0 ? origTop : origTop + halfOverlapYPx;
      const keepBottom = r === grid.rows - 1 ? origBottom : origBottom - halfOverlapYPx;
      const keepLeft = c === 0 ? origLeft : origLeft + halfOverlapXPx;
      const keepRight = c === grid.cols - 1 ? origRight : origRight - halfOverlapXPx;

      const tables = (img as unknown as { tables?: Array<{ cells: RawCell[] }> }).tables;
      const cells: RawCell[] = tables?.[0]?.cells ?? [];
      const fields = img.fields ?? [];

      let stagedFromTile = 0;

      if (cells.length > 0) {
        // 정상 경로: tables[0].cells 사용
        for (const cell of cells) {
          const pos = cellAvgPos(cell);
          if (!pos) continue;
          const origY = pos.y / scale + origTop;
          const origX = pos.x / scale + origLeft;
          if (origY < keepTop || origY > keepBottom) continue;
          if (origX < keepLeft || origX > keepRight) continue;
          const { text, confidence } = extractCellText(cell);
          if (!text) continue;
          staged.push({
            origX,
            origY,
            columnIndex: cell.columnIndex,
            text,
            confidence,
          });
          stagedFromTile++;
        }
      } else {
        // Fallback: CLOVA가 절반 자른 tile에서 표 인식 실패 → fields 토큰 사용
        for (const f of fields) {
          const verts = f.boundingPoly?.vertices ?? [];
          if (!verts.length) continue;
          const avgX = verts.reduce((s, v) => s + v.x, 0) / verts.length;
          const avgY = verts.reduce((s, v) => s + v.y, 0) / verts.length;
          const origY = avgY / scale + origTop;
          const origX = avgX / scale + origLeft;
          if (origY < keepTop || origY > keepBottom) continue;
          if (origX < keepLeft || origX > keepRight) continue;
          const text = (f.inferText ?? '').trim();
          if (!text) continue;
          staged.push({
            origX,
            origY,
            columnIndex: -1, // 무의미 — 이후 column reclustering이 처리
            text,
            confidence: f.inferConfidence ?? 0,
          });
          stagedFromTile++;
        }
      }

      console.log(
        `[clova-tile] tile r=${r} c=${c} tableCells=${cells.length} fields=${fields.length} staged=${stagedFromTile}`,
      );
    }
  }

  console.log(`[clova-tile] total staged=${staged.length} before row clustering`);

  // y 좌표로 row 재클러스터링 (원본 좌표 기준 yTolerance)
  staged.sort((a, b) => a.origY - b.origY);
  const rawRows: StagedCell[][] = [];
  let current: StagedCell[] = [];
  let avgY = -Infinity;
  for (const c of staged) {
    if (current.length === 0 || Math.abs(c.origY - avgY) <= Y_TOLERANCE_ORIG_PX) {
      current.push(c);
      avgY = current.reduce((s, x) => s + x.origY, 0) / current.length;
    } else {
      rawRows.push(current);
      current = [c];
      avgY = c.origY;
    }
  }
  if (current.length) rawRows.push(current);

  // Token stitching: fields-fallback에선 같은 셀의 토큰들이 origX 0~수px 차이로 분리됨.
  // row 안에서 origX 정렬 후 인접 차이가 작으면 하나의 cell로 결합.
  const STITCH_X_GAP_PX = 8;
  const rows: StagedCell[][] = rawRows.map((row) => {
    const sorted = [...row].sort((a, b) => a.origX - b.origX);
    const merged: StagedCell[] = [];
    for (const c of sorted) {
      const prev = merged[merged.length - 1];
      if (prev && c.origX - prev.origX < STITCH_X_GAP_PX) {
        prev.text = (prev.text + ' ' + c.text).trim();
        prev.origX = (prev.origX + c.origX) / 2;
        prev.confidence = Math.max(prev.confidence, c.confidence);
      } else {
        merged.push({ ...c });
      }
    }
    return merged;
  });
  console.log(`[clova-tile] rows=${rows.length} (rawRows=${rawRows.length})`);

  // 좌표 기반 column 재클러스터링.
  // tile마다 CLOVA columnIndex가 다르게 나올 수 있으므로 (예: tile A=22열, tile B=21열),
  // 행별 cell 수의 mode를 column count K로 추정 → K개 row를 anchor로 → 각 anchor의
  // origX 평균으로 column representative를 만들고 모든 cell을 가장 가까운 rep에 재할당.
  const reps = buildColumnRepresentatives(rows);
  const useReps = reps.length >= 2;

  const mergedCells: RawCell[] = [];
  rows.forEach((row, rowIndex) => {
    const byCol = new Map<number, StagedCell>();
    if (useReps) {
      for (const c of row) {
        const colIdx = assignToColumn(c.origX, reps);
        const prev = byCol.get(colIdx);
        if (!prev || c.confidence > prev.confidence) byCol.set(colIdx, c);
      }
    } else {
      // 최종 fallback: row 안에서 origX 순으로 columnIndex 부여.
      // Global하게 정렬되진 않지만 collapse(-1로 수렴)는 방지.
      const sorted = [...row].sort((a, b) => a.origX - b.origX);
      sorted.forEach((c, i) => byCol.set(i, c));
    }
    const sortedCols = Array.from(byCol.entries()).sort((a, b) => a[0] - b[0]);
    for (const [colIdx, c] of sortedCols) {
      mergedCells.push({
        rowIndex,
        columnIndex: colIdx,
        cellTextLines: [
          {
            cellWords: [{ inferText: c.text, inferConfidence: c.confidence }],
          },
        ],
      });
    }
  });
  console.log(
    `[clova-tile] mergedCells=${mergedCells.length} useReps=${useReps} K=${reps.length}`,
  );

  // 합쳐진 단일 ClovaImage (tables[0].cells에 패키징)
  return {
    uid: 'tiled',
    name: 'tiled',
    inferResult: 'SUCCESS',
    fields: [],
    tables: [{ cells: mergedCells }],
  } as unknown as ClovaImage;
}
