import { getSupabaseAdmin } from '../src/lib/supabase';

async function main() {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('price_vendors')
    .select('name, carrier, crop_spec, active')
    .eq('active', true)
    .order('display_order');
  console.table(
    data?.map((v) => ({
      name: v.name,
      carrier: v.carrier,
      crop_spec: v.crop_spec ? JSON.stringify(v.crop_spec) : '(none)',
    })),
  );

  const { data: recent } = await sb
    .from('price_vendor_quote_sheets')
    .select('id, effective_date, parse_status, error_message, uploaded_at, vendor:price_vendors(name, carrier)')
    .order('uploaded_at', { ascending: false })
    .limit(5);
  console.log('\nRecent 5 uploads:');
  for (const r of recent ?? []) {
    const v = Array.isArray(r.vendor) ? r.vendor[0] : r.vendor;
    console.log(`- ${r.uploaded_at} | ${v?.name}(${v?.carrier}) | ${r.parse_status} | ${r.error_message ?? ''}`);
  }
}
main().catch(console.error);
