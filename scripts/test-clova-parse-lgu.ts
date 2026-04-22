/**
 * CLOVA JSON 파일 → LGU+ 파서 → 검증 출력
 * 실행: npx tsx scripts/test-clova-parse-lgu.ts <clova-response.json>
 */

import { readFileSync } from 'fs';
import path from 'path';
import { parseClovaLGU } from '../src/lib/clova-parse-lgu';
import type { ClovaResponse } from '../src/lib/clova-ocr';

function main() {
  const arg = process.argv[2];
  if (!arg) { console.error('usage: tsx scripts/test-clova-parse-lgu.ts <json>'); process.exit(1); }
  const resp = JSON.parse(readFileSync(path.resolve(arg), 'utf8')) as ClovaResponse;
  const result = parseClovaLGU(resp);

  console.log(`\n파싱된 모델: ${result.models.length}개\n`);
  for (const m of result.models.slice(0, 10)) {
    console.log(`── ${m.model_code_raw} · ${m.nickname} · 출고가 ${(m.retail_price_krw ?? 0).toLocaleString()}`);
    for (const t of m.tiers) {
      const c = t.common!;
      console.log(
        `   ${t.plan_tier_code.padEnd(5)} 공시 ${(t.subsidy_krw ?? 0).toLocaleString().padStart(8)} | ` +
        `신규 ${(c.new010 ?? 0).toLocaleString().padStart(7)} | ` +
        `MNP ${(c.mnp ?? 0).toLocaleString().padStart(7)} | ` +
        `기변 ${(c.change ?? 0).toLocaleString().padStart(7)}`
      );
    }
    console.log();
  }
  console.log(`...총 ${result.models.length}개 모델`);
}
main();
