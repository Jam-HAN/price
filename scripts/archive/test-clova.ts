/**
 * CLOVA OCR POC 테스트. 샘플 이미지 하나 보내서 응답 구조·정확도 확인.
 *
 * 실행:
 *   npx dotenv -e .env.local -- npx tsx scripts/test-clova.ts <이미지경로>
 *
 * 사전 준비 — .env.local:
 *   CLOVA_OCR_INVOKE_URL=https://xxx.apigw.ntruss.com/custom/v1/...
 *   CLOVA_OCR_SECRET_KEY=...
 */

import { readFileSync } from 'fs';
import path from 'path';
import { clovaExtract, groupFieldsByRow, rowText } from '../src/lib/clova-ocr';

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('사용법: npx tsx scripts/test-clova.ts <이미지 파일 경로>');
    process.exit(1);
  }
  const file = path.resolve(arg);
  const bytes = readFileSync(file);
  const ext = file.toLowerCase().endsWith('.jpg') || file.toLowerCase().endsWith('.jpeg') ? 'jpg' : 'png';

  console.log(`파일: ${file} · ${bytes.length} bytes · format=${ext}`);

  const t0 = Date.now();
  const img = await clovaExtract({ imageBytes: bytes, format: ext as 'png' | 'jpg' });
  const ms = Date.now() - t0;

  console.log(`\nCLOVA 응답 ${ms}ms`);
  console.log(`토큰 수: ${img.fields.length}`);
  console.log(`평균 confidence: ${(img.fields.reduce((s, f) => s + f.inferConfidence, 0) / img.fields.length).toFixed(3)}`);

  const rows = groupFieldsByRow(img.fields);
  console.log(`\n재구성된 행: ${rows.length}`);
  console.log('\n── 처음 20행 ──');
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    console.log(`[${i.toString().padStart(2)}] ${rowText(rows[i]).slice(0, 200)}`);
  }

  // confidence 낮은 토큰 몇 개
  const lowConf = img.fields
    .filter((f) => f.inferConfidence < 0.9)
    .sort((a, b) => a.inferConfidence - b.inferConfidence)
    .slice(0, 10);
  if (lowConf.length) {
    console.log('\n── confidence 낮은 토큰 (추출 신뢰도 낮음) ──');
    for (const f of lowConf) {
      console.log(`  "${f.inferText}" conf=${f.inferConfidence.toFixed(3)}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
