import { getSupabaseAdmin } from '../src/lib/supabase';

async function main() {
  const sb = getSupabaseAdmin();

  console.log('=== devices (전체) ===');
  const { data: devs } = await sb
    .from('price_devices')
    .select('id, model_code, nickname, active, created_at, display_order')
    .order('created_at', { ascending: false });
  console.log(`총 ${devs?.length ?? 0}건 — active=${(devs ?? []).filter((d) => d.active).length}건`);
  console.table(
    (devs ?? []).slice(0, 15).map((d) => ({
      created: d.created_at?.slice(0, 16),
      model_code: d.model_code,
      nickname: d.nickname,
      active: d.active,
    })),
  );

  console.log('\n=== 최근 시트 & 파싱 unmapped 수 ===');
  const { data: sheets } = await sb
    .from('price_vendor_quote_sheets')
    .select('id, uploaded_at, parse_status, raw_ocr_json, vendor:price_vendors(name, carrier)')
    .order('uploaded_at', { ascending: false })
    .limit(5);
  for (const s of sheets ?? []) {
    const v = Array.isArray(s.vendor) ? s.vendor[0] : s.vendor;
    const raw = s.raw_ocr_json as { models?: Array<{ model_code_raw: string; nickname?: string }> } | null;
    const models = raw?.models ?? [];
    console.log(`\n[${v?.name}(${v?.carrier}) ${s.parse_status}] @${s.uploaded_at?.slice(0, 16)} — OCR 모델 ${models.length}건`);
    if (models.length > 0) {
      console.log('  샘플 model_code_raw:');
      for (const m of models.slice(0, 6)) {
        console.log(`    "${m.model_code_raw}" / nickname="${m.nickname ?? ''}"`);
      }
    }
  }

  console.log('\n=== 현재 quotes / subsidies 건수 ===');
  const { count: quoteCount } = await sb
    .from('price_vendor_quotes')
    .select('*', { count: 'exact', head: true });
  const { count: subCount } = await sb
    .from('price_carrier_subsidies')
    .select('*', { count: 'exact', head: true });
  const { count: aliasCount } = await sb
    .from('price_device_aliases')
    .select('*', { count: 'exact', head: true });
  console.log(`  quotes=${quoteCount}, carrier_subsidies=${subCount}, aliases=${aliasCount}`);

  console.log('\n=== devices 중에서 quotes가 전혀 없는 것 (연관 없음) ===');
  const { data: quotedIds } = await sb
    .from('price_vendor_quotes')
    .select('device_id');
  const used = new Set((quotedIds ?? []).map((q) => q.device_id));
  const unused = (devs ?? []).filter((d) => d.active && !used.has(d.id));
  console.log(`active devices 중 quotes 0건인 것: ${unused.length}건`);
  for (const d of unused.slice(0, 15)) {
    console.log(`  ${d.model_code.padEnd(20)} ${d.nickname}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
