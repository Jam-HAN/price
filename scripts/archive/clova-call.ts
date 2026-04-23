/**
 * CLOVA OCR API 직접 호출 → JSON 파일 저장.
 * usage: npx tsx scripts/clova-call.ts <이미지경로> <출력경로>
 */
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

async function main() {
  const imgPath = process.argv[2];
  const outPath = process.argv[3];
  if (!imgPath || !outPath) {
    console.error('usage: npx tsx scripts/clova-call.ts <image> <output-json>');
    process.exit(1);
  }

  const invokeUrl = process.env.CLOVA_OCR_INVOKE_URL;
  const secretKey = process.env.CLOVA_OCR_SECRET_KEY;
  if (!invokeUrl || !secretKey) {
    console.error('CLOVA_OCR_INVOKE_URL / CLOVA_OCR_SECRET_KEY 환경변수 필요');
    process.exit(1);
  }

  const bytes = readFileSync(path.resolve(imgPath));
  const ext = path.extname(imgPath).slice(1).toLowerCase() || 'png';
  const format = ext === 'jpg' ? 'jpg' : (ext as 'png' | 'jpeg');

  const enableTables = process.env.TABLES !== '0';
  const message = {
    version: 'V2',
    requestId: crypto.randomUUID(),
    timestamp: Date.now(),
    lang: 'ko',
    images: [{ format, name: path.basename(imgPath) }],
    enableTableDetection: enableTables,
  };

  const form = new FormData();
  form.append('message', JSON.stringify(message));
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  form.append('file', new Blob([ab], { type: `image/${format}` }), path.basename(imgPath));

  const t0 = Date.now();
  console.log(`→ POST ${invokeUrl}`);
  const res = await fetch(invokeUrl, {
    method: 'POST',
    headers: { 'X-OCR-SECRET': secretKey },
    body: form,
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  if (!res.ok) {
    const text = await res.text();
    console.error(`✗ HTTP ${res.status} (${elapsed}s): ${text.slice(0, 500)}`);
    process.exit(1);
  }

  const json = (await res.json()) as unknown;
  writeFileSync(path.resolve(outPath), JSON.stringify(json, null, 2));

  const img = (json as { images?: Array<{ fields?: unknown[]; tables?: Array<{ cells: unknown[] }> }> }).images?.[0];
  const fields = img?.fields?.length ?? 0;
  const tables = img?.tables?.length ?? 0;
  const cells = img?.tables?.[0]?.cells?.length ?? 0;
  console.log(`✓ ${elapsed}s · fields=${fields} · tables=${tables} · table0 cells=${cells}`);
  console.log(`저장: ${outPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
