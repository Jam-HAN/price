/**
 * 피에스 최신 sheet의 원본 이미지를 다시 CLOVA로 파싱하여
 * table cells(raw text)를 grid로 덤프. 파서 출력과 대조.
 */
import { getSupabaseAdmin } from '../src/lib/supabase';
import { downloadSheet } from '../src/lib/storage';
import { clovaExtract } from '../src/lib/clova-ocr';
import { cropAndResize, type CropSpec } from '../src/lib/image-crop';

async function main() {
  const sb = getSupabaseAdmin();
  const { data: v } = await sb.from('price_vendors').select('id, crop_spec').eq('name', '피에스').single();
  const { data: sheet } = await sb
    .from('price_vendor_quote_sheets')
    .select('id, image_url')
    .eq('vendor_id', v!.id)
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .single();
  if (!sheet?.image_url) { console.log('피에스 sheet/image 없음'); return; }

  console.log(`sheet=${sheet.id.slice(0,8)} image=${sheet.image_url}`);
  const bytes = await downloadSheet(sheet.image_url);
  const crop = v!.crop_spec as CropSpec | null;
  const cropped = crop ? await cropAndResize(bytes, crop) : bytes;
  console.log(`crop=${JSON.stringify(crop)} · OCR 호출…`);
  const t0 = Date.now();
  const img = await clovaExtract({ imageBytes: cropped, format: 'png' });
  console.log(`  ${Date.now() - t0}ms`);

  type Cell = { rowIndex: number; columnIndex: number; text: string };
  const tables = (img as unknown as { tables?: Array<{ cells: Array<{ rowIndex: number; columnIndex: number; cellTextLines?: Array<{ cellWords?: Array<{ inferText?: string }> }> }> }> }).tables;
  if (!tables?.[0]) { console.log('tables 없음'); return; }
  const cells: Cell[] = [];
  for (const c of tables[0].cells) {
    const words: string[] = [];
    for (const line of c.cellTextLines ?? []) {
      for (const w of line.cellWords ?? []) if (w.inferText) words.push(w.inferText);
    }
    cells.push({ rowIndex: c.rowIndex, columnIndex: c.columnIndex, text: words.join(' ').trim() });
  }

  const maxRow = Math.max(...cells.map((c) => c.rowIndex));
  const maxCol = Math.max(...cells.map((c) => c.columnIndex));
  console.log(`\ntable ${maxRow + 1} × ${maxCol + 1} (총 cells=${cells.length})`);

  const grid = new Map<string, string>();
  for (const c of cells) grid.set(`${c.rowIndex}|${c.columnIndex}`, c.text);

  // 모델 행만 추려서 각 tier 기준 첫 5열 표시
  console.log('\n=== 모델 행 × 첫 2 tier(T109, I_100) raw cells ===');
  console.log('(r/c)    code           출고가    T109:sub 010 MNP 기변 / 010 MNP 기변   I_100:sub 010 MNP 기변 / 010 MNP 기변');
  let modelRowsFound = 0;
  for (let r = 0; r <= maxRow; r++) {
    const modelCode = (grid.get(`${r}|1`) ?? '').trim();
    if (!/^(SM-|UIP|UAW|AT-|IP[A\d]|AIP)/.test(modelCode)) continue;
    modelRowsFound++;
    const retail = grid.get(`${r}|3`) ?? '';
    const t109 = [4, 5, 6, 7, 8, 9, 10].map((c) => grid.get(`${r}|${c}`) ?? '').map((s) => s || '∅');
    const i100 = [11, 12, 13, 14, 15, 16, 17].map((c) => grid.get(`${r}|${c}`) ?? '').map((s) => s || '∅');
    console.log(`r=${String(r).padStart(2)} ${modelCode.padEnd(14)} ${retail.padEnd(7)}  ${t109.join(' ')}   |   ${i100.join(' ')}`);
  }
  console.log(`\n총 모델 행 ${modelRowsFound}건`);

  // 행 길이 분포 — merged cell 때문에 길이가 다르면 오프셋 밀림
  console.log('\n=== 행별 컬럼 수 분포 ===');
  const rowColCount = new Map<number, number>();
  for (const c of cells) rowColCount.set(c.rowIndex, (rowColCount.get(c.rowIndex) ?? 0) + 1);
  const colCountDist = new Map<number, number>();
  for (const cnt of rowColCount.values()) colCountDist.set(cnt, (colCountDist.get(cnt) ?? 0) + 1);
  for (const [colCount, freq] of [...colCountDist.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${colCount}컬럼 × ${freq}행`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
