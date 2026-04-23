import { getSupabaseAdmin } from '../src/lib/supabase';

async function main() {
  const sb = getSupabaseAdmin();
  const { data: v } = await sb
    .from('price_vendors')
    .select('id, name, crop_spec')
    .eq('name', '피에스')
    .single();
  if (!v) throw new Error('피에스 vendor not found');
  const before = v.crop_spec;
  const next = { ...(before ?? {}), targetWidth: 1300 };
  const { error } = await sb.from('price_vendors').update({ crop_spec: next }).eq('id', v.id);
  if (error) throw error;
  console.log('피에스 crop_spec updated:');
  console.log('  before =', JSON.stringify(before));
  console.log('  after  =', JSON.stringify(next));
}
main().catch((e) => { console.error(e); process.exit(1); });
