/**
 * 모든 confirmed 시트를 재동기화. 디바이스 정규화 후 alias가 자동 생성되도록.
 * 실행: npx dotenv -e .env.local -- npx tsx scripts/resync-all-sheets.ts
 */

import { createClient } from '@supabase/supabase-js';
import { normalizeDeviceCode } from '../src/lib/device-normalize';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const { data: sheets } = await sb
    .from('price_vendor_quote_sheets')
    .select('id, vendor_id, vendor:price_vendors(name, carrier), raw_ocr_json')
    .eq('parse_status', 'confirmed');

  console.log(`재동기화 대상: ${sheets?.length ?? 0}`);

  for (const s of sheets ?? []) {
    const vendor = Array.isArray(s.vendor) ? s.vendor[0] : s.vendor;
    const raw = s.raw_ocr_json as { models?: { model_code_raw: string; nickname: string }[] } | null;
    if (!raw) continue;

    // 1) 각 raw code에 대해 alias 자동 생성 (정규화 후 canonical device 매칭)
    const { data: allDevices } = await sb.from('price_devices').select('id, model_code, nickname');
    const byCode = new Map((allDevices ?? []).map((d) => [d.model_code, d.id]));
    const byNick = new Map((allDevices ?? []).map((d) => [d.nickname, d.id]));
    const byNorm = new Map<string, string>();
    for (const d of allDevices ?? []) {
      const n = normalizeDeviceCode(d.model_code);
      if (!byNorm.has(n)) byNorm.set(n, d.id);
    }

    const { data: existingAliases } = await sb
      .from('price_device_aliases')
      .select('vendor_code')
      .eq('vendor_id', s.vendor_id);
    const existingAliasSet = new Set((existingAliases ?? []).map((a) => a.vendor_code));

    let aliasAdded = 0;
    for (const m of raw.models ?? []) {
      if (existingAliasSet.has(m.model_code_raw)) continue;
      const deviceId =
        byCode.get(m.model_code_raw) ??
        byNorm.get(normalizeDeviceCode(m.model_code_raw)) ??
        byNick.get(m.nickname);
      if (!deviceId) continue;

      const { error } = await sb.from('price_device_aliases').insert({
        device_id: deviceId,
        vendor_id: s.vendor_id,
        vendor_code: m.model_code_raw,
      });
      if (!error) {
        aliasAdded++;
        existingAliasSet.add(m.model_code_raw);
      }
    }

    console.log(`${vendor.name} (${vendor.carrier}): alias 추가 ${aliasAdded}건`);

    // 2) 재동기화 — quotes/subsidies를 canonical device_id로 다시 써주기
    // sync-sheet.ts의 로직을 서비스롤 클라이언트로 직접 재현
    const { data: sheet } = await sb
      .from('price_vendor_quote_sheets')
      .select('id, vendor_id, raw_ocr_json, vendor:price_vendors(carrier)')
      .eq('id', s.id)
      .single();
    if (!sheet) continue;
    const carrier = (Array.isArray(sheet.vendor) ? sheet.vendor[0] : sheet.vendor)?.carrier;
    if (!carrier) continue;

    const { data: aliases2 } = await sb
      .from('price_device_aliases')
      .select('vendor_code, device_id')
      .eq('vendor_id', s.vendor_id);
    const aliasMap = new Map((aliases2 ?? []).map((a) => [a.vendor_code, a.device_id]));
    const { data: tiers } = await sb
      .from('price_plan_tiers')
      .select('id, code')
      .eq('carrier', carrier);
    const tierByCode = new Map((tiers ?? []).map((t) => [t.code, t.id]));

    type Q = { sheet_id: string; device_id: string; plan_tier_id: string; contract_type: 'common'|'select'; activation_type: 'new010'|'mnp'|'change'; amount_krw: number };
    type CS = { carrier: string; device_id: string; plan_tier_id: string; subsidy_krw: number; source_sheet_id: string; source_vendor_id: string };
    const quotes: Q[] = [];
    const carrierSubs: CS[] = [];
    const raw2 = sheet.raw_ocr_json as {
      models?: Array<{
        model_code_raw: string;
        nickname: string;
        tiers?: Array<{
          plan_tier_code: string;
          subsidy_krw: number | null;
          common: { new010: number | null; mnp: number | null; change: number | null } | null;
          select: { new010: number | null; mnp: number | null; change: number | null } | null;
        }>;
      }>;
    } | null;
    if (!raw2) continue;

    for (const model of raw2.models ?? []) {
      const deviceId =
        aliasMap.get(model.model_code_raw) ??
        byCode.get(model.model_code_raw) ??
        byNorm.get(normalizeDeviceCode(model.model_code_raw)) ??
        byNick.get(model.nickname);
      if (!deviceId) continue;
      for (const t of model.tiers ?? []) {
        const tid = tierByCode.get(t.plan_tier_code);
        if (!tid) continue;
        if (t.subsidy_krw != null) {
          carrierSubs.push({
            carrier, device_id: deviceId, plan_tier_id: tid,
            subsidy_krw: t.subsidy_krw, source_sheet_id: s.id, source_vendor_id: s.vendor_id,
          });
        }
        for (const [ct, block] of [['common', t.common] as const, ['select', t.select] as const]) {
          if (!block) continue;
          for (const at of ['new010', 'mnp', 'change'] as const) {
            const v = block[at];
            if (v == null) continue;
            quotes.push({
              sheet_id: s.id, device_id: deviceId, plan_tier_id: tid,
              contract_type: ct, activation_type: at, amount_krw: v,
            });
          }
        }
      }
    }

    // dedupe
    const qMap = new Map<string, Q>();
    for (const q of quotes) qMap.set(`${q.device_id}|${q.plan_tier_id}|${q.contract_type}|${q.activation_type}`, q);
    const csMap = new Map<string, CS>();
    for (const c of carrierSubs) csMap.set(`${c.carrier}|${c.device_id}|${c.plan_tier_id}`, c);

    await sb.from('price_vendor_quotes').delete().eq('sheet_id', s.id);
    if (qMap.size > 0) {
      const { error } = await sb.from('price_vendor_quotes').insert(Array.from(qMap.values()));
      if (error) console.error(`  quotes insert error: ${error.message}`);
    }
    if (csMap.size > 0) {
      const rows = Array.from(csMap.values()).map((r) => ({ ...r, updated_at: new Date().toISOString() }));
      const { error } = await sb.from('price_carrier_subsidies').upsert(rows, {
        onConflict: 'carrier,device_id,plan_tier_id',
      });
      if (error) console.error(`  subs upsert error: ${error.message}`);
    }
    console.log(`  → quotes=${qMap.size}, subsidies=${csMap.size}`);
  }

  console.log('완료');
}

main().catch((e) => { console.error(e); process.exit(1); });
