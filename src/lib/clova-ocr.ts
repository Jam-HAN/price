/**
 * Naver CLOVA OCR 클라이언트.
 * 문서·영수증·표 구조 인식에 특화. LLM Vision 보다 dense numeric table에서 우위.
 *
 * 환경변수:
 *   CLOVA_OCR_INVOKE_URL  — NCP 콘솔에서 발급받은 도메인 엔드포인트
 *   CLOVA_OCR_SECRET_KEY  — API Gateway Secret Key
 *
 * General OCR 기준. Document OCR / Custom Template는 추후 확장.
 *
 * 응답 구조 요약:
 *   {
 *     version: "V2",
 *     requestId: "...",
 *     timestamp: ...,
 *     images: [{
 *       uid, name,
 *       inferResult: "SUCCESS",
 *       fields: [{
 *         valueType: "ALL",
 *         boundingPoly: { vertices: [{x,y}, ...] },
 *         inferText: "125,400",
 *         inferConfidence: 0.998,
 *         lineBreak: false
 *       }, ...]
 *     }]
 *   }
 *
 * fields 는 이미지 내 모든 텍스트 토큰의 개별 bounding box + 텍스트.
 * 표 구조는 우리가 fields 의 좌표로부터 재구성 (같은 y 대역 = 같은 행, x 좌표 순 = 컬럼).
 */

export type ClovaVertex = { x: number; y: number };
export type ClovaField = {
  valueType: 'ALL' | string;
  boundingPoly: { vertices: ClovaVertex[] };
  inferText: string;
  inferConfidence: number;
  lineBreak?: boolean;
};
export type ClovaImage = {
  uid: string;
  name: string;
  inferResult: 'SUCCESS' | 'FAILURE' | string;
  message?: string;
  fields: ClovaField[];
};
export type ClovaResponse = {
  version: string;
  requestId: string;
  timestamp: number;
  images: ClovaImage[];
};

export type ClovaConfig = {
  invokeUrl: string;
  secretKey: string;
};

function getConfig(): ClovaConfig {
  const invokeUrl = process.env.CLOVA_OCR_INVOKE_URL;
  const secretKey = process.env.CLOVA_OCR_SECRET_KEY;
  if (!invokeUrl) throw new Error('CLOVA_OCR_INVOKE_URL 환경변수 누락');
  if (!secretKey) throw new Error('CLOVA_OCR_SECRET_KEY 환경변수 누락');
  return { invokeUrl, secretKey };
}

/**
 * 이미지 bytes → CLOVA OCR 호출 → raw fields 반환.
 * General OCR V2 기준. Document OCR 사용 시 별도 엔드포인트.
 */
export async function clovaExtract(params: {
  imageBytes: Uint8Array | Buffer;
  format?: 'png' | 'jpg' | 'jpeg';
  templateIds?: number[]; // Custom template 사용 시
}): Promise<ClovaImage> {
  const { invokeUrl, secretKey } = getConfig();
  const format = params.format ?? 'png';

  const messagePayload = {
    version: 'V2',
    requestId: crypto.randomUUID(),
    timestamp: Date.now(),
    lang: 'ko',
    images: [
      {
        format,
        name: 'rebate_sheet',
        ...(params.templateIds ? { templateIds: params.templateIds } : {}),
      },
    ],
    enableTableDetection: true,
  };

  const form = new FormData();
  form.append('message', JSON.stringify(messagePayload));
  // ArrayBuffer 로 복사 후 Blob 생성 (TS 4.9+ Buffer 타입 이슈 회피)
  const src = params.imageBytes;
  const ab = new ArrayBuffer(src.byteLength);
  new Uint8Array(ab).set(src);
  const blob = new Blob([ab], { type: `image/${format}` });
  form.append('file', blob, `sheet.${format}`);

  const res = await fetch(invokeUrl, {
    method: 'POST',
    headers: {
      'X-OCR-SECRET': secretKey,
    },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CLOVA OCR ${res.status}: ${text.slice(0, 400)}`);
  }

  const json = (await res.json()) as ClovaResponse;
  const img = json.images?.[0];
  if (!img) throw new Error('CLOVA 응답에 images 없음');
  if (img.inferResult !== 'SUCCESS') {
    throw new Error(`CLOVA inferResult=${img.inferResult} · ${img.message ?? ''}`);
  }
  return img;
}

/**
 * 표 구조 재구성: fields 의 y 좌표로 row 클러스터링, 각 row 내부 x 좌표 순 정렬.
 * 같은 y 대역 허용 오차 (픽셀). 시트 이미지 해상도에 따라 조정 필요.
 */
export function groupFieldsByRow(fields: ClovaField[], yTolerance = 12): ClovaField[][] {
  const sorted = [...fields].sort((a, b) => {
    const ay = avgY(a);
    const by = avgY(b);
    return ay - by;
  });
  const rows: ClovaField[][] = [];
  let currentRow: ClovaField[] = [];
  let currentY = -Infinity;
  for (const f of sorted) {
    const y = avgY(f);
    if (currentRow.length === 0 || Math.abs(y - currentY) <= yTolerance) {
      currentRow.push(f);
      currentY = currentRow.length
        ? currentRow.reduce((s, x) => s + avgY(x), 0) / currentRow.length
        : y;
    } else {
      rows.push(currentRow.sort((a, b) => avgX(a) - avgX(b)));
      currentRow = [f];
      currentY = y;
    }
  }
  if (currentRow.length) rows.push(currentRow.sort((a, b) => avgX(a) - avgX(b)));
  return rows;
}

function avgY(f: ClovaField): number {
  const ys = f.boundingPoly.vertices.map((v) => v.y);
  return ys.reduce((s, y) => s + y, 0) / ys.length;
}
function avgX(f: ClovaField): number {
  const xs = f.boundingPoly.vertices.map((v) => v.x);
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

/** 한 row 의 텍스트들을 이어붙인 문자열 (debug/로그용) */
export function rowText(row: ClovaField[]): string {
  return row.map((f) => f.inferText).join(' | ');
}
