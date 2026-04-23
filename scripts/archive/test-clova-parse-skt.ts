import { readFileSync } from 'fs';
import path from 'path';
import { parseClovaCheongdam } from '../src/lib/clova-parse-skt-cheongdam';
import { parseClovaPes } from '../src/lib/clova-parse-skt-pes';
import type { ClovaResponse } from '../src/lib/clova-ocr';

function main() {
  const which = process.argv[2]; // 'cheongdam' | 'pes'
  const jsonPath = process.argv[3];
  if (!which || !jsonPath) {
    console.error('usage: tsx test-clova-parse-skt.ts <cheongdam|pes> <json>');
    process.exit(1);
  }
  const resp = JSON.parse(readFileSync(path.resolve(jsonPath), 'utf8')) as ClovaResponse;
  const result = which === 'cheongdam' ? parseClovaCheongdam(resp) : parseClovaPes(resp);
  console.log(`파싱된 모델: ${result.models.length}개\n`);
  for (const m of result.models.slice(0, 10)) {
    console.log(`── ${m.model_code_raw} · ${m.nickname} · 출고가 ${(m.retail_price_krw ?? 0).toLocaleString()}`);
    for (const t of m.tiers) {
      const c = t.common;
      const s = t.select;
      console.log(
        `   ${t.plan_tier_code.padEnd(5)} 공시 ${(t.subsidy_krw ?? 0).toLocaleString().padStart(8)} | ` +
        `공통[010/MNP/기변] ${[c?.new010, c?.mnp, c?.change].map(v => (v ?? 0).toLocaleString().padStart(7)).join('/')} | ` +
        `선약[010/MNP/기변] ${[s?.new010, s?.mnp, s?.change].map(v => (v ?? 0).toLocaleString().padStart(7)).join('/')}`
      );
    }
    console.log();
  }
  console.log(`...총 ${result.models.length}개 모델`);
}
main();
