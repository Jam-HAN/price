/**
 * 모든 디바이스의 nickname을 canonicalNickname()으로 표준화.
 * 매핑 없는 family는 원본 유지.
 *
 * 실행: npx dotenv -e .env.local -- npx tsx scripts/normalize-nicknames.ts
 */

import { createClient } from '@supabase/supabase-js';
import { canonicalNickname } from '../src/lib/device-normalize';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function run() {
  const { data: devices } = await sb
    .from('price_devices')
    .select('id, model_code, nickname')
    .eq('active', true);

  let updated = 0;
  let skipped = 0;
  for (const d of devices ?? []) {
    const canon = canonicalNickname(d.model_code);
    if (!canon) { skipped++; continue; }
    if (canon === d.nickname) { skipped++; continue; }
    const { error } = await sb.from('price_devices').update({ nickname: canon }).eq('id', d.id);
    if (error) {
      console.log(`  실패 ${d.model_code}: ${error.message}`);
    } else {
      console.log(`  ${d.model_code}: "${d.nickname}" → "${canon}"`);
      updated++;
    }
  }
  console.log(`\n=== 완료 · 변경 ${updated} · 유지 ${skipped} ===`);
}

run().catch((e) => { console.error(e); process.exit(1); });
