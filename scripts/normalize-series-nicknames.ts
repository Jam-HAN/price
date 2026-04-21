/**
 * 모든 디바이스의 series + nickname을 일괄 재정규화.
 * 실행: npx dotenv -e .env.local -- npx tsx scripts/normalize-series-nicknames.ts
 */

import { createClient } from '@supabase/supabase-js';
import { canonicalNickname, canonicalSeries } from '../src/lib/device-normalize';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function run() {
  const { data: devices } = await sb
    .from('price_devices')
    .select('id, model_code, nickname, series')
    .eq('active', true);

  let nickChanged = 0;
  let seriesChanged = 0;
  for (const d of devices ?? []) {
    const newNick = canonicalNickname(d.model_code);
    const newSeries = canonicalSeries(d.model_code);
    const update: Record<string, string> = {};
    if (newNick && newNick !== d.nickname) update.nickname = newNick;
    if (newSeries && newSeries !== d.series) update.series = newSeries;
    if (Object.keys(update).length === 0) continue;

    const { error } = await sb.from('price_devices').update(update).eq('id', d.id);
    if (error) {
      console.log(`  실패 ${d.model_code}: ${error.message}`);
    } else {
      const notes: string[] = [];
      if ('nickname' in update) { nickChanged++; notes.push(`nick "${d.nickname}"→"${newNick}"`); }
      if ('series' in update) { seriesChanged++; notes.push(`series ${d.series ?? '-'}→${newSeries}`); }
      console.log(`  ${d.model_code}: ${notes.join(' · ')}`);
    }
  }
  console.log(`\n=== 완료 · nickname ${nickChanged} · series ${seriesChanged} ===`);
}

run().catch((e) => { console.error(e); process.exit(1); });
