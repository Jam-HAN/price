/**
 * 잘못 정규화된 code를 올바른 canonical로 복구.
 * target이 이미 존재하면 자식(aliases/quotes/subsidies) 이관 후 broken device 삭제.
 */

import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const FIXES: Array<[string, string]> = [
  ['SM-F7662N_56G', 'SM-F766N_256G'],
  ['SM-F7665N_12G', 'SM-F766N_512G'],
  ['SM-F9662N_56G', 'SM-F966N_256G'],
  ['SM-S9312N_56G', 'SM-S931N_256G'],
  ['SM-S9372N_56G', 'SM-S937N_256G'],
  ['SM-S9382N_56G', 'SM-S938N_256G'],
  ['SM-S9422N_56G', 'SM-S942N_256G'],
  ['SM-S9425N_12G', 'SM-S942N_512G'],
  ['SM-S9472N_56G', 'SM-S947N_256G'],
  ['SM-S9475N_12G', 'SM-S947N_512G'],
  ['SM-S9482N_56G', 'SM-S948N_256G'],
  ['SM-S9485N_12G', 'SM-S948N_512G'],
  ['SM-X236N_0G',   'SM-X236N'],
];

async function migrateChildren(fromId: string, toId: string) {
  // aliases
  const { data: aliases } = await sb.from('price_device_aliases').select('id, vendor_id, vendor_code').eq('device_id', fromId);
  for (const a of aliases ?? []) {
    const { data: conflict } = await sb.from('price_device_aliases').select('id')
      .eq('device_id', toId).eq('vendor_id', a.vendor_id).eq('vendor_code', a.vendor_code).maybeSingle();
    if (conflict) await sb.from('price_device_aliases').delete().eq('id', a.id);
    else await sb.from('price_device_aliases').update({ device_id: toId }).eq('id', a.id);
  }
  // quotes
  const { data: quotes } = await sb.from('price_vendor_quotes').select('id, sheet_id, plan_tier_id, contract_type, activation_type').eq('device_id', fromId);
  for (const q of quotes ?? []) {
    const { data: conflict } = await sb.from('price_vendor_quotes').select('id')
      .eq('device_id', toId).eq('sheet_id', q.sheet_id).eq('plan_tier_id', q.plan_tier_id)
      .eq('contract_type', q.contract_type).eq('activation_type', q.activation_type).maybeSingle();
    if (conflict) await sb.from('price_vendor_quotes').delete().eq('id', q.id);
    else await sb.from('price_vendor_quotes').update({ device_id: toId }).eq('id', q.id);
  }
  // carrier_subsidies
  const { data: subs } = await sb.from('price_carrier_subsidies').select('id, carrier, plan_tier_id').eq('device_id', fromId);
  for (const s of subs ?? []) {
    const { data: conflict } = await sb.from('price_carrier_subsidies').select('id')
      .eq('carrier', s.carrier).eq('device_id', toId).eq('plan_tier_id', s.plan_tier_id).maybeSingle();
    if (conflict) await sb.from('price_carrier_subsidies').delete().eq('id', s.id);
    else await sb.from('price_carrier_subsidies').update({ device_id: toId }).eq('id', s.id);
  }
  // margins
  const { data: margins } = await sb.from('price_device_margins').select('id').eq('device_id', fromId);
  for (const m of margins ?? []) {
    await sb.from('price_device_margins').delete().eq('id', m.id);
  }
}

async function run() {
  for (const [broken, canonical] of FIXES) {
    const { data: brokenDev } = await sb.from('price_devices').select('id').eq('model_code', broken).maybeSingle();
    if (!brokenDev) { console.log(`  ${broken}: 이미 없음`); continue; }
    const { data: canonDev } = await sb.from('price_devices').select('id').eq('model_code', canonical).maybeSingle();
    if (canonDev) {
      console.log(`  ${broken} → ${canonical} (병합)`);
      await migrateChildren(brokenDev.id, canonDev.id);
      await sb.from('price_devices').delete().eq('id', brokenDev.id);
    } else {
      console.log(`  ${broken} → ${canonical} (rename)`);
      await sb.from('price_devices').update({ model_code: canonical }).eq('id', brokenDev.id);
    }
  }
  console.log('완료');
}

run().catch((e) => { console.error(e); process.exit(1); });
