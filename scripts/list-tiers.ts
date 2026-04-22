import { getSupabaseAdmin } from '../src/lib/supabase';
async function main() {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('price_plan_tiers').select('code, carrier, label, monthly_fee_krw, aliases, display_order').order('carrier').order('display_order');
  console.table(data);
}
main().catch(console.error);
