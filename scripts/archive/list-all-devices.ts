import { getSupabaseAdmin } from '../src/lib/supabase';

async function main() {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('price_devices').select('model_code, nickname, active').order('model_code');
  console.log(`총 ${data?.length}건`);
  for (const d of data ?? []) {
    console.log(`  ${d.active ? '✓' : '✗'} ${d.model_code.padEnd(22)} ${d.nickname}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
