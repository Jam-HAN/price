import { getSupabaseAdmin } from '../src/lib/supabase';
async function main() {
  const sb = getSupabaseAdmin();
  // tiers: check all rows
  const t = await sb.from('price_plan_tiers').select('*', { count: 'exact' });
  console.log('price_plan_tiers count=', t.count, 'error=', t.error?.message, 'sample=', t.data?.slice(0, 3));
  const q = await sb.from('price_vendor_quotes').select('*', { count: 'exact' }).limit(3);
  console.log('price_vendor_quotes count=', q.count, 'sample=', q.data?.slice(0, 3));
  const s = await sb.from('price_carrier_subsidies').select('*', { count: 'exact' }).limit(3);
  console.log('price_carrier_subsidies count=', s.count, 'sample=', s.data?.slice(0, 3));
  const sheets = await sb.from('price_vendor_quote_sheets').select('id, vendor_id, effective_date, parse_status, created_at').order('created_at', { ascending: false }).limit(10);
  console.log('recent sheets:');
  console.table(sheets.data);
}
main().catch(console.error);
