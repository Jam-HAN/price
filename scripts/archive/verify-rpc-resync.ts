/**
 * price_sync_replace_sheet RPC 동작 검증:
 *   1) 기존 confirmed sheet들에 대해 syncSheetToNormalized 재실행
 *   2) quotes/policies 복원 결과 카운트
 */

import { getSupabaseAdmin } from '../src/lib/supabase';
import { syncSheetToNormalized } from '../src/lib/sync-sheet';

async function main() {
  const sb = getSupabaseAdmin();
  const { data: sheets } = await sb
    .from('price_vendor_quote_sheets')
    .select('id, vendor:price_vendors(name, parser_key)')
    .eq('parse_status', 'confirmed')
    .order('uploaded_at', { ascending: false });

  const { count: quotesBefore } = await sb.from('price_vendor_quotes').select('*', { count: 'exact', head: true });
  console.log(`재동기화 전 quotes 총 ${quotesBefore}건`);

  for (const s of sheets ?? []) {
    const v = Array.isArray(s.vendor) ? s.vendor[0] : s.vendor;
    try {
      const r = await syncSheetToNormalized(s.id);
      console.log(`✓ [${v?.name}·${v?.parser_key}] sheet=${s.id.slice(0, 8)} quotes=${r.quotes} subs=${r.carrier_subsidies ?? 0} unmapped=${r.unmapped}`);
    } catch (e) {
      console.error(`✗ [${v?.name}] FAIL:`, e instanceof Error ? e.message : e);
    }
  }

  const { count: quotesAfter } = await sb.from('price_vendor_quotes').select('*', { count: 'exact', head: true });
  console.log(`\n재동기화 후 quotes 총 ${quotesAfter}건`);
}
main().catch((e) => { console.error(e); process.exit(1); });
