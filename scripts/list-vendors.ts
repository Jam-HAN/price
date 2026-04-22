import { getSupabaseAdmin } from '../src/lib/supabase';
async function main() {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('price_vendors').select('id, name, carrier').order('carrier').order('name');
  console.table(data);
}
main().catch(console.error);
