/**
 * 3차 중복 병합 — 용량 미표기(SM-XXXN)와 256G 명시(SM-XXXN_256G)는 같은 기본 모델.
 * 예:
 *   SM-S948N + SM-S948N_256G → SM-S948N_256G (canonical)
 *   SM-S942N + SM-S942N_256G → SM-S942N_256G
 *   SM-S947N + SM-S947N_256G → SM-S947N_256G
 *
 * 실행: npx dotenv -e .env.local -- npx tsx scripts/merge-base-256g.ts
 */

import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function migrate(fromId: string, toId: string) {
  const { data: aliases } = await sb.from('price_device_aliases').select('id, vendor_id, vendor_code').eq('device_id', fromId);
  for (const a of aliases ?? []) {
    const { data: cf } = await sb.from('price_device_aliases').select('id')
      .eq('device_id', toId).eq('vendor_id', a.vendor_id).eq('vendor_code', a.vendor_code).maybeSingle();
    if (cf) await sb.from('price_device_aliases').delete().eq('id', a.id);
    else await sb.from('price_device_aliases').update({ device_id: toId }).eq('id', a.id);
  }
  const { data: quotes } = await sb.from('price_vendor_quotes').select('id, sheet_id, plan_tier_id, contract_type, activation_type').eq('device_id', fromId);
  for (const q of quotes ?? []) {
    const { data: cf } = await sb.from('price_vendor_quotes').select('id')
      .eq('device_id', toId).eq('sheet_id', q.sheet_id).eq('plan_tier_id', q.plan_tier_id)
      .eq('contract_type', q.contract_type).eq('activation_type', q.activation_type).maybeSingle();
    if (cf) await sb.from('price_vendor_quotes').delete().eq('id', q.id);
    else await sb.from('price_vendor_quotes').update({ device_id: toId }).eq('id', q.id);
  }
  const { data: subs } = await sb.from('price_carrier_subsidies').select('id, carrier, plan_tier_id').eq('device_id', fromId);
  for (const s of subs ?? []) {
    const { data: cf } = await sb.from('price_carrier_subsidies').select('id')
      .eq('carrier', s.carrier).eq('device_id', toId).eq('plan_tier_id', s.plan_tier_id).maybeSingle();
    if (cf) await sb.from('price_carrier_subsidies').delete().eq('id', s.id);
    else await sb.from('price_carrier_subsidies').update({ device_id: toId }).eq('id', s.id);
  }
  const { data: margins } = await sb.from('price_device_margins').select('id').eq('device_id', fromId);
  for (const m of margins ?? []) {
    await sb.from('price_device_margins').delete().eq('id', m.id);
  }
}

async function run() {
  // 용량 없는 code 전부 찾기 (워치·이어폰·이어링 등 non-phone 제외)
  const { data: bareDevices } = await sb
    .from('price_devices')
    .select('id, model_code, nickname, series, retail_price_krw')
    .eq('active', true)
    .is('storage', null);

  let merged = 0;
  for (const base of bareDevices ?? []) {
    // 워치·태블릿·무선기기는 규칙 적용 제외 (256G 개념 자체가 없음)
    const series = base.series ?? '';
    if (series === 'wearable' || series === 'tablet' || series === 'misc') continue;
    const nick = base.nickname.toLowerCase();
    if (nick.includes('워치') || nick.includes('탭') || nick.includes('링') || nick.includes('ring')) continue;

    const target = `${base.model_code}_256G`;
    const { data: sibling } = await sb
      .from('price_devices')
      .select('id, model_code, nickname, retail_price_krw')
      .eq('model_code', target)
      .maybeSingle();
    if (!sibling) continue;

    console.log(`[${base.model_code} ${base.retail_price_krw}] → ${sibling.model_code} ${sibling.retail_price_krw}`);
    await migrate(base.id, sibling.id);
    await sb.from('price_devices').delete().eq('id', base.id);
    merged++;
  }
  console.log(`\n완료 · ${merged}건 병합`);
}

run().catch((e) => { console.error(e); process.exit(1); });
