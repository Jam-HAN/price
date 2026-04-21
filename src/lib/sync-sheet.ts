import type { SheetExtraction } from './vision-schema';
import { getSupabaseAdmin } from './supabase';

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
    sb.from('price_devices').select('id, model_code, nickname'),
    sb.from('price_plan_tiers').select('id, code, carrier').eq('carrier', carrier),
  ]);
  const aliasMap = new Map((aliases ?? []).map((a) => [a.vendor_code, a.device_id]));
  const deviceByCode = new Map((devices ?? []).map((d) => [d.model_code, d.id]));
  const deviceByNick = new Map((devices ?? []).map((d) => [d.nickname, d.id]));
  const tierByCode = new Map((tiers ?? []).map((t) => [t.code, t.id]));

  type Quote = {
    sheet_id: string; device_id: string; plan_tier_id: string;
    contract_type: 'common' | 'select';
    activation_type: 'new010' | 'mnp' | 'change';
    amount_krw: number;
  };
  type Subsidy = { sheet_id: string; device_id: string; plan_tier_id: string; subsidy_krw: number };

  const quotes: Quote[] = [];
  const subsidies: Subsidy[] = [];
  let unmapped = 0;

  for (const model of raw.models ?? []) {
    const deviceId =
      aliasMap.get(model.model_code_raw) ??
      deviceByCode.get(model.model_code_raw) ??
      deviceByNick.get(model.nickname);
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
        subsidies.push({ sheet_id: sheetId, device_id: deviceId, plan_tier_id: tierId, subsidy_krw: tier.subsidy_krw });
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

  await sb.from('price_vendor_quotes').delete().eq('sheet_id', sheetId);
  await sb.from('price_vendor_subsidies').delete().eq('sheet_id', sheetId);
  await sb.from('price_vendor_policies').delete().eq('sheet_id', sheetId);

  if (quotes.length) {
    const { error } = await sb.from('price_vendor_quotes').insert(quotes);
    if (error) throw new Error(`quotes insert: ${error.message}`);
  }
  if (subsidies.length) {
    const { error } = await sb.from('price_vendor_subsidies').insert(subsidies);
    if (error) throw new Error(`subsidies insert: ${error.message}`);
  }
  if (raw.policies?.length) {
    const policyRows = raw.policies.map((p, i) => ({
      sheet_id: sheetId,
      category: p.category,
      name: p.name,
      amount_krw: p.amount_krw ?? null,
      raw_text: p.conditions_text ?? null,
      display_order: i,
    }));
    const { error } = await sb.from('price_vendor_policies').insert(policyRows);
    if (error) throw new Error(`policies insert: ${error.message}`);
  }

  // 공시지원금 단위 자동 보정
  await sb.rpc('price_autocorrect_subsidy_units', { p_sheet_id: sheetId });

  // 매트릭스/단가표 뷰에 노출되도록 상태를 'confirmed'로 마킹. 별도 확정 단계 없이 자동.
  await sb
    .from('price_vendor_quote_sheets')
    .update({ parse_status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', sheetId);

  return { quotes: quotes.length, subsidies: subsidies.length, policies: raw.policies?.length ?? 0, unmapped };
}
