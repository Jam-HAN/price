import { getSupabaseAdmin } from '../src/lib/supabase';

type Model = { model_code_raw: string; nickname?: string; tiers?: unknown[] };

async function main() {
  const sb = getSupabaseAdmin();
  const { data: v } = await sb.from('price_vendors').select('id').eq('name', '피에스').single();
  const { data: sheets } = await sb
    .from('price_vendor_quote_sheets')
    .select('id, raw_ocr_json, effective_date, uploaded_at, parse_status')
    .eq('vendor_id', v!.id)
    .order('uploaded_at', { ascending: false })
    .limit(1);
  const sheet = sheets?.[0];
  if (!sheet) { console.log('sheet 없음'); return; }

  const raw = sheet.raw_ocr_json as { models?: Model[] } | null;
  const models = raw?.models ?? [];

  console.log(`sheet ${sheet.id.slice(0,8)} · ${sheet.effective_date} · ${sheet.parse_status}`);
  console.log(`OCR 총 ${models.length} 모델\n`);

  console.log('=== 모든 OCR raw code (순서대로) ===');
  for (const [i, m] of models.entries()) {
    const nt = m.tiers?.length ?? 0;
    console.log(`  ${String(i+1).padStart(2)}. ${m.model_code_raw.padEnd(22)} "${m.nickname ?? ''}" (tiers=${nt})`);
  }

  console.log('\n=== IPA 포함 여부 ===');
  const ipa = models.filter((m) => /^IP[A]|AIR/i.test(m.model_code_raw));
  console.log(`  ${ipa.length}건`);
  for (const m of ipa) console.log(`    ${m.model_code_raw} ${m.nickname}`);

  console.log('\n=== quotes 총 건수 (현재 DB) ===');
  const { count } = await sb.from('price_vendor_quotes').select('*', { count: 'exact', head: true }).eq('sheet_id', sheet.id);
  console.log(`  ${count}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
