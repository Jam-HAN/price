import { readFileSync } from 'fs';
import path from 'path';
import { parseClovaNear } from '../src/lib/clova-parse-kt-near';
import type { ClovaResponse } from '../src/lib/clova-ocr';

function main() {
  const arg = process.argv[2];
  if (!arg) { console.error('usage: tsx test-clova-parse-near.ts <json>'); process.exit(1); }
  const resp = JSON.parse(readFileSync(path.resolve(arg), 'utf8')) as ClovaResponse;
  const result = parseClovaNear(resp);
  console.log(`파싱된 모델: ${result.models.length}개\n`);
  for (const m of result.models.slice(0, 12)) {
    console.log(`── ${m.model_code_raw} · 출고가 ${(m.retail_price_krw ?? 0).toLocaleString()}`);
    for (const t of m.tiers) {
      const c = t.common!;
      console.log(
        `   ${t.plan_tier_code.padEnd(5)} 공시 ${(t.subsidy_krw ?? 0).toLocaleString().padStart(8)} | ` +
        `010 ${(c.new010 ?? 0).toLocaleString().padStart(7)} | ` +
        `MNP ${(c.mnp ?? 0).toLocaleString().padStart(7)} | ` +
        `기변 ${(c.change ?? 0).toLocaleString().padStart(7)}`
      );
    }
    console.log();
  }
  console.log(`...총 ${result.models.length}개 모델`);
}
main();
