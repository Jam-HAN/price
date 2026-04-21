/**
 * 모든 디바이스의 model_code를 정규화된 형태로 업데이트.
 * 중복이 아니라도 code 자체가 canonical form이 아니면 rename.
 * 예: SM-S926N512G → SM-S926N_512G
 *
 * 실행: npx dotenv -e .env.local -- npx tsx scripts/normalize-all-codes.ts
 */

import { createClient } from '@supabase/supabase-js';
import { normalizeDeviceCode } from '../src/lib/device-normalize';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const { data: devices } = await sb
    .from('price_devices')
    .select('id, model_code, nickname')
    .eq('active', true);

  let renamed = 0;
  let skipped = 0;
  for (const d of devices ?? []) {
    const norm = normalizeDeviceCode(d.model_code);
    if (norm === d.model_code) {
      skipped++;
      continue;
    }
    // 다른 디바이스가 이미 이 canonical을 쓰고 있는지 체크
    const { data: conflict } = await sb
      .from('price_devices')
      .select('id')
      .eq('model_code', norm)
      .maybeSingle();
    if (conflict) {
      console.log(`  충돌: ${d.model_code} → ${norm} (이미 존재 · dedupe 필요)`);
      continue;
    }
    const { error } = await sb.from('price_devices').update({ model_code: norm }).eq('id', d.id);
    if (error) {
      console.log(`  실패 ${d.model_code}: ${error.message}`);
    } else {
      console.log(`  ${d.model_code} → ${norm} (${d.nickname})`);
      renamed++;
    }
  }
  console.log(`\n=== 완료 · 변경 ${renamed} · 유지 ${skipped} ===`);
}

main().catch((e) => { console.error(e); process.exit(1); });
