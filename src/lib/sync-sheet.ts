import type { SheetExtraction } from './vision-schema';
import { getSupabaseAdmin } from './supabase';
import { normalizeDeviceCode, canonicalCandidates } from './device-normalize';

/**
 * raw_ocr_json을 price_vendor_quotes / subsidies / policies로 동기화.
 * 매번 기존 행을 delete 후 insert (idempotent).
 *
 * 이전에 확정(confirmSheet)으로 수동 절차였던 걸 업로드·편집 시마다 자동 호출.
 */
export async function syncSheetToNormalized(sheetId: string) {
  const sb = getSupabaseAdmin();

  const { data: sheet, error: sheetErr } = await sb
    .from('price_vendor_quote_sheets')
    .select('id, vendor_id, raw_ocr_json, vendor:price_vendors(carrier)')
    .eq('id', sheetId)
    .single();
  if (sheetErr || !sheet) throw new Error('sheet를 찾을 수 없습니다');
  const vendor = Array.isArray(sheet.vendor) ? sheet.vendor[0] : sheet.vendor;
  const carrier = vendor?.carrier;
  if (!carrier) throw new Error('거래처 통신사 정보 없음');

  const raw = sheet.raw_ocr_json as SheetExtraction | null;
  if (!raw) return { quotes: 0, subsidies: 0, policies: 0, unmapped: 0 };

  const [{ data: aliases }, { data: devices }, { data: tiers }] = await Promise.all([
    sb.from('price_device_aliases').select('vendor_code, device_id').eq('vendor_id', sheet.vendor_id),
    sb.from('price_devices').select('id, model_code, nickname').eq('active', true),
    sb.from('price_plan_tiers').select('id, code, carrier').eq('carrier', carrier),
  ]);
  const aliasMap = new Map((aliases ?? []).map((a) => [a.vendor_code, a.device_id]));
  const deviceByCode = new Map((devices ?? []).map((d) => [d.model_code, d.id]));
  const deviceByNick = new Map((devices ?? []).map((d) => [d.nickname, d.id]));
  const deviceByNormalized = new Map<string, string>();
  for (const d of devices ?? []) {
    const n = normalizeDeviceCode(d.model_code);
    if (!deviceByNormalized.has(n)) deviceByNormalized.set(n, d.id);
  }
  const tierByCode = new Map((tiers ?? []).map((t) => [t.code, t.id]));

  type Quote = {
    sheet_id: string; device_id: string; plan_tier_id: string;
    contract_type: 'common' | 'select';
    activation_type: 'new010' | 'mnp' | 'change';
    amount_krw: number;
  };
  type CarrierSubsidy = {
    carrier: string; device_id: string; plan_tier_id: string; subsidy_krw: number;
    source_sheet_id: string; source_vendor_id: string;
  };

  const quotes: Quote[] = [];
  const carrierSubsidies: CarrierSubsidy[] = [];
  let unmapped = 0;

  for (const model of raw.models ?? []) {
    const candidates = canonicalCandidates(model.model_code_raw);
    let deviceId: string | undefined =
      aliasMap.get(model.model_code_raw) ?? deviceByCode.get(model.model_code_raw);
    if (!deviceId) {
      for (const c of candidates) {
        const hit = deviceByNormalized.get(c) ?? deviceByCode.get(c);
        if (hit) { deviceId = hit; break; }
      }
    }
    if (!deviceId) deviceId = deviceByNick.get(model.nickname);
    if (!deviceId) {
      unmapped++;
      continue;
    }
    for (const tier of model.tiers ?? []) {
      const tierId = tierByCode.get(tier.plan_tier_code);
      if (!tierId) {
        unmapped++;
        continue;
      }
      if (tier.subsidy_krw != null) {
        carrierSubsidies.push({
          carrier,
          device_id: deviceId,
          plan_tier_id: tierId,
          subsidy_krw: tier.subsidy_krw,
          source_sheet_id: sheetId,
          source_vendor_id: sheet.vendor_id,
        });
      }
      for (const [ct, block] of [['common', tier.common] as const, ['select', tier.select] as const]) {
        if (!block) continue;
        for (const at of ['new010', 'mnp', 'change'] as const) {
          const v = block[at];
          if (v == null) continue;
          quotes.push({
            sheet_id: sheetId,
            device_id: deviceId,
            plan_tier_id: tierId,
            contract_type: ct,
            activation_type: at,
            amount_krw: v,
          });
        }
      }
    }
  }

  // unique 키 기준 중복 제거 (Claude가 같은 모델을 여러 행으로 반환하는 경우 대응)
  const quoteMap = new Map<string, typeof quotes[number]>();
  for (const q of quotes) {
    quoteMap.set(`${q.device_id}|${q.plan_tier_id}|${q.contract_type}|${q.activation_type}`, q);
  }
  const subsidyMap = new Map<string, typeof carrierSubsidies[number]>();
  for (const s of carrierSubsidies) {
    subsidyMap.set(`${s.carrier}|${s.device_id}|${s.plan_tier_id}`, s);
  }
  const dedupedQuotes = Array.from(quoteMap.values());
  const dedupedCarrierSubsidies = Array.from(subsidyMap.values());

  // 트랜잭션 내에서 기존 quotes/policies 교체 — 중간 실패 시 롤백되어 데이터 증발 방지
  const policyRows = (raw.policies ?? []).map((p, i) => ({
    category: p.category,
    name: p.name,
    amount_krw: p.amount_krw ?? null,
    raw_text: p.conditions_text ?? null,
    display_order: i,
  }));
  const quoteRows = dedupedQuotes.map((q) => ({
    device_id: q.device_id,
    plan_tier_id: q.plan_tier_id,
    contract_type: q.contract_type,
    activation_type: q.activation_type,
    amount_krw: q.amount_krw,
  }));
  const { error: rpcErr } = await sb.rpc('price_sync_replace_sheet', {
    p_sheet_id: sheetId,
    p_quotes: quoteRows,
    p_policies: policyRows,
  });
  if (rpcErr) throw new Error(`sync_replace: ${rpcErr.message}`);

  // 공통지원금은 carrier 레벨이라 여러 시트가 덮어쓰기 (RPC 밖에서 upsert)
  if (dedupedCarrierSubsidies.length) {
    const rows = dedupedCarrierSubsidies.map((r) => ({ ...r, updated_at: new Date().toISOString() }));
    const { error } = await sb
      .from('price_carrier_subsidies')
      .upsert(rows, { onConflict: 'carrier,device_id,plan_tier_id' });
    if (error) throw new Error(`carrier_subsidies upsert: ${error.message}`);
  }

  // 공통지원금 단위 자동 보정(기존 vendor_subsidies 기준 — 신규 구조에서는 no-op 가능)
  await sb.rpc('price_autocorrect_subsidy_units', { p_sheet_id: sheetId });

  // 매트릭스/단가표 뷰에 노출되도록 상태를 'confirmed'로 마킹. 별도 확정 단계 없이 자동.
  await sb
    .from('price_vendor_quote_sheets')
    .update({ parse_status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', sheetId);

  return { quotes: dedupedQuotes.length, carrier_subsidies: dedupedCarrierSubsidies.length, policies: raw.policies?.length ?? 0, unmapped };
}
