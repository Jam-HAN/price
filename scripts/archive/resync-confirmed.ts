import { getSupabaseAdmin } from '../src/lib/supabase';
import { syncSheetToNormalized } from '../src/lib/sync-sheet';

async function main() {
  const sb = getSupabaseAdmin();
  const { data: sheets } = await sb
    .from('price_vendor_quote_sheets')
    .select('id, vendor:price_vendors(name)')
    .eq('parse_status', 'confirmed')
    .order('uploaded_at', { ascending: false });
  for (const s of sheets ?? []) {
    const v = Array.isArray(s.vendor) ? s.vendor[0] : s.vendor;
    try {
      const r = await syncSheetToNormalized(s.id);
      console.log(`[${v?.name}] sheet=${s.id.slice(0, 8)} quotes=${r.quotes} subs=${r.carrier_subsidies ?? 0} unmapped=${r.unmapped}`);
    } catch (e) {
      console.error(`[${v?.name}] FAIL:`, e instanceof Error ? e.message : e);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
