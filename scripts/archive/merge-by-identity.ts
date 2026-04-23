/**
 * 2차 중복 병합 — 정규화된 code만으로는 못 잡는 중복 처리.
 * 기준: 같은 series + storage + retail_price_krw + 비슷한 nickname → 같은 물리 모델로 간주.
 *
 * 예: SM-S926N_512G (Claude가 S942를 S926으로 잘못 읽음) vs SM-S942N_512G
 *    둘 다 nickname="갤럭시 S26 512G", storage="512G", retail=1,507,000 → 같은 폰
 *    정규화된 code (SM-S942N_512G)를 canonical로 남기고 나머지 삭제.
 *
 * 실행: npx dotenv -e .env.local -- npx tsx scripts/merge-by-identity.ts
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
  const { data: devices } = await sb
    .from('price_devices')
    .select('id, model_code, nickname, series, storage, retail_price_krw')
    .eq('active', true);

  // 키: (series, storage, retail_price, 정규화된 nickname)
  const normNick = (s: string) =>
    s.toLowerCase()
      .replace(/\s+/g, '')
      .replace(/ultra/g, '울트라')
      .replace(/galaxy/g, '갤럭시');

  type Device = NonNullable<typeof devices>[number];
  const groups = new Map<string, Device[]>();
  for (const d of devices ?? []) {
    const key = `${d.series ?? ''}|${d.storage ?? ''}|${d.retail_price_krw}|${normNick(d.nickname)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(d);
  }

  let merged = 0;
  for (const [, members] of groups) {
    if (members.length < 2) continue;
    // canonical: model_code가 SM-XXXN_YYYG 패턴과 매칭되면 우선
    members.sort((a, b) => {
      const aMatch = /^SM-[A-Z]\d{3}N(_\d+[GT]?)?$/.test(a.model_code) ? 0 : 1;
      const bMatch = /^SM-[A-Z]\d{3}N(_\d+[GT]?)?$/.test(b.model_code) ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      return a.model_code.length - b.model_code.length;
    });
    const canonical = members[0];
    console.log(`\n[${canonical.model_code}] ${canonical.nickname} · ${canonical.storage ?? '-'} · ${canonical.retail_price_krw}`);
    for (const d of members.slice(1)) {
      console.log(`  ↳ merging ${d.model_code}`);
      await migrate(d.id, canonical.id);
      await sb.from('price_devices').delete().eq('id', d.id);
      merged++;
    }
  }
  console.log(`\n완료 · 병합 ${merged}건`);
}

run().catch((e) => { console.error(e); process.exit(1); });
