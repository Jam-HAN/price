/**
 * CLOVA OCR 호출 전 이미지 전처리.
 *
 * SKT처럼 세로 긴 단가표는 텍스트 밀도가 높아 CLOVA가 15초 안에 처리 못 하고
 * DEADLINE_EXCEEDED 에러가 난다. 상단 공지·하단 정책부록을 잘라내고 모델표
 * 영역만 crop + 가로 resize 하면 텍스트 양이 줄어 15초 이내로 완료된다.
 *
 * 각 벤더별 crop 비율은 거래처 시트 템플릿에 고정 의존 — 템플릿 변경 시 업데이트 필요.
 */

export type CropSpec = {
  /** 원본 세로 높이 대비 시작 비율 (0~1) */
  yRatio0: number;
  /** 원본 세로 높이 대비 끝 비율 (0~1) */
  yRatio1: number;
  /** 원본 가로 폭 대비 시작 비율 (0~1, 미지정 시 0) */
  xRatio0?: number;
  /** 원본 가로 폭 대비 끝 비율 (0~1, 미지정 시 1) */
  xRatio1?: number;
  /** 결과 이미지 가로 픽셀 (비율 유지 세로 자동) */
  targetWidth: number;
  /**
   * 활성 영역 세로 분할 개수. 0/undefined면 단일 호출.
   * 2 또는 3을 주면 N분할 후 각 tile을 CLOVA에 별도 호출 → 결과 좌표 환원 + 합치기.
   * SKT처럼 텍스트 밀도 높은 시트 전체를 써야 할 때 사용.
   */
  tile?: number;
};

export async function cropAndResize(
  bytes: Uint8Array | Buffer,
  spec: CropSpec,
): Promise<Buffer> {
  // sharp는 Next.js가 transitively 포함. dynamic import로 cold start 영향 최소화.
  const sharp = (await import('sharp')).default;
  const src = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const meta = await sharp(src).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) throw new Error('이미지 메타데이터 없음');

  const top = Math.max(0, Math.round(height * spec.yRatio0));
  const bottom = Math.min(height, Math.round(height * spec.yRatio1));
  const cropH = Math.max(1, bottom - top);

  const x0 = spec.xRatio0 ?? 0;
  const x1 = spec.xRatio1 ?? 1;
  const left = Math.max(0, Math.round(width * x0));
  const right = Math.min(width, Math.round(width * x1));
  const cropW = Math.max(1, right - left);

  return await sharp(src)
    .extract({ left, top, width: cropW, height: cropH })
    .resize({ width: spec.targetWidth, fit: 'inside' })
    .png()
    .toBuffer();
}
