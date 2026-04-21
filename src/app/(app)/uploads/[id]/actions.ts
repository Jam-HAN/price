'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { SheetExtraction } from '@/lib/vision-schema';

/**
 * 파싱 결과를 검수 후 확정: raw_ocr_json의 models/policies를
 * price_vendor_quotes, price_vendor_subsidies, price_vendor_policies로 넣고 status='confirmed'.
 * device_id/plan_tier_id가 매핑되지 않은 행은 SKIP하고 에러 카운트 리턴.
 */
export async function confirmSheet(formData: FormData) {
  const sheetId = String(formData.get('sheet_id') ?? '');
  if (!sheetId) throw new Error('sheet_id 누락');

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
  if (!raw) throw new Error('파싱 결과(raw_ocr_json) 없음');

  // 디바이스 alias 로드 (거래처별) + 전체 모델 매핑 참고용
  const [{ data: aliases }, { data: devices }, { data: tiers }] = await Promise.all([
    sb.from('price_device_aliases').select('vendor_code, device_id').eq('vendor_id', sheet.vendor_id),
    sb.from('price_devices').select('id, model_code, nickname'),
    sb.from('price_plan_tiers').select('id, code, carrier').eq('carrier', carrier),
  ]);
  const aliasMap = new Map((aliases ?? []).map((a) => [a.vendor_code, a.device_id]));
  const deviceByCode = new Map((devices ?? []).map((d) => [d.model_code, d.id]));
  const deviceByNick = new Map((devices ?? []).map((d) => [d.nickname, d.id]));
  const tierByCode = new Map((tiers ?? []).map((t) => [t.code, t.id]));

  type Quote = { sheet_id: string; device_id: string; plan_tier_id: string; contract_type: 'common'|'select'; activation_type: 'new010'|'mnp'|'change'; amount_krw: number };
  type Subsidy = { sheet_id: string; device_id: string; plan_tier_id: string; subsidy_krw: number };
  const quotes: Quote[] = [];
  const subsidies: Subsidy[] = [];
  const unmapped: string[] = [];

  for (const model of raw.models ?? []) {
    const deviceId =
      aliasMap.get(model.model_code_raw) ??
      deviceByCode.get(model.model_code_raw) ??
      deviceByNick.get(model.nickname);
    if (!deviceId) {
      unmapped.push(`모델 매핑 없음: ${model.model_code_raw} / ${model.nickname}`);
      continue;
    }
    for (const tier of model.tiers ?? []) {
      const tierId = tierByCode.get(tier.plan_tier_code);
      if (!tierId) {
        unmapped.push(`요금제 구간 매핑 없음: ${tier.plan_tier_code} (모델=${model.nickname})`);
        continue;
      }
      if (tier.subsidy_krw != null) {
        subsidies.push({ sheet_id: sheetId, device_id: deviceId, plan_tier_id: tierId, subsidy_krw: tier.subsidy_krw });
      }
      const types = [
        ['common', tier.common] as const,
        ['select', tier.select] as const,
      ];
      for (const [ct, block] of types) {
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

  // 기존 행 제거 후 insert (재확정 대응)
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

  // 공시지원금 단위 자동 보정: (sheet, tier) 묶음의 avg < 100,000 AND tier.monthly_fee >= 60,000 → ×10
  // Claude Vision이 "천원 단위" 표기를 놓쳐서 ×1,000 대신 ×10,000으로 변환하는 경우 대응.
  const { data: corrected } = await sb.rpc('price_autocorrect_subsidy_units', { p_sheet_id: sheetId });
  const correctedCount = typeof corrected === 'number' ? corrected : 0;

  const noteParts: string[] = [];
  if (unmapped.length) noteParts.push(`매핑 누락 ${unmapped.length}건:\n${unmapped.slice(0, 20).join('\n')}`);
  if (correctedCount > 0) noteParts.push(`공시지원금 단위 자동 보정: ${correctedCount}건 ×10 적용`);

  await sb
    .from('price_vendor_quote_sheets')
    .update({
      parse_status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      notes: noteParts.length ? noteParts.join('\n\n') : null,
    })
    .eq('id', sheetId);

  revalidatePath(`/uploads/${sheetId}`);
  revalidatePath('/uploads');
  redirect(`/uploads/${sheetId}?confirmed=1`);
}

export async function deleteSheet(formData: FormData) {
  const sheetId = String(formData.get('sheet_id') ?? '');
  if (!sheetId) throw new Error('sheet_id 누락');
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('price_vendor_quote_sheets').delete().eq('id', sheetId);
  if (error) throw new Error(error.message);
  revalidatePath('/uploads');
  redirect('/uploads');
}

/**
 * 파싱된 모델 중 내부 마스터에 없는 것들을 자동 등록 + 거래처 alias 추가.
 * 중복은 스킵. 카테고리는 nickname에서 추정.
 */
export async function autoRegisterMissingDevices(formData: FormData) {
  const sheetId = String(formData.get('sheet_id') ?? '');
  if (!sheetId) throw new Error('sheet_id 누락');
  const sb = getSupabaseAdmin();
  const { data: sheet, error } = await sb
    .from('price_vendor_quote_sheets')
    .select('id, vendor_id, raw_ocr_json')
    .eq('id', sheetId)
    .single();
  if (error || !sheet) throw new Error('sheet 조회 실패');
  const raw = sheet.raw_ocr_json as SheetExtraction | null;
  if (!raw) throw new Error('파싱 결과 없음');

  const { data: existingAliases } = await sb
    .from('price_device_aliases')
    .select('vendor_code, device_id')
    .eq('vendor_id', sheet.vendor_id);
  const aliasMap = new Map((existingAliases ?? []).map((a) => [a.vendor_code, a.device_id]));
  const { data: devices } = await sb.from('price_devices').select('id, model_code, nickname');
  const deviceByCode = new Map((devices ?? []).map((d) => [d.model_code, d.id]));
  const deviceByNick = new Map((devices ?? []).map((d) => [d.nickname, d.id]));

  let created = 0;
  let linked = 0;
  for (const model of raw.models ?? []) {
    const already =
      aliasMap.get(model.model_code_raw) ??
      deviceByCode.get(model.model_code_raw) ??
      deviceByNick.get(model.nickname);
    if (already) continue;

    // 카테고리 추정
    const n = model.nickname.toLowerCase();
    let category = '5G';
    if (n.includes('워치') || n.includes('탭')) category = 'S-D';
    else if (n.includes('lte') || n.includes('스타일폴더')) category = 'LTE';

    const manufacturer =
      n.includes('아이폰') || n.includes('iphone') ? 'Apple' : n.includes('갤럭시') ? 'Samsung' : null;
    const seriesHints: Record<string, string> = {
      's26': 'galaxyS26',
      's25': 'galaxyS25',
      '폴드7': 'fold7',
      '플립7': 'flip7',
      '아이폰17': 'iphone17',
      '아이폰16': 'iphone16',
      '아이폰 에어': 'iphoneAir',
    };
    const series = Object.keys(seriesHints).find((k) => model.nickname.includes(k))
      ? seriesHints[Object.keys(seriesHints).find((k) => model.nickname.includes(k))!]
      : null;

    // unique model_code: 거래처 raw 코드 그대로 씀. 충돌 시 뒤에 카운터.
    let modelCode = model.model_code_raw;
    if (deviceByCode.has(modelCode)) modelCode = `${modelCode}_${Date.now().toString(36)}`;

    const { data: inserted, error: insErr } = await sb
      .from('price_devices')
      .insert({
        model_code: modelCode,
        nickname: model.nickname,
        manufacturer,
        series,
        storage: model.storage,
        retail_price_krw: model.retail_price_krw,
        category,
        is_new: model.is_new,
      })
      .select('id')
      .single();
    if (insErr || !inserted) continue;
    created++;
    deviceByCode.set(modelCode, inserted.id);
    deviceByNick.set(model.nickname, inserted.id);

    const { error: aliasErr } = await sb
      .from('price_device_aliases')
      .insert({ device_id: inserted.id, vendor_id: sheet.vendor_id, vendor_code: model.model_code_raw });
    if (!aliasErr) linked++;
    aliasMap.set(model.model_code_raw, inserted.id);
  }

  revalidatePath(`/uploads/${sheetId}`);
  revalidatePath('/devices');
  revalidatePath('/aliases');
  redirect(`/uploads/${sheetId}?auto_registered=${created}_${linked}`);
}

export async function updateParsed(formData: FormData) {
  const sheetId = String(formData.get('sheet_id') ?? '');
  const json = String(formData.get('raw_ocr_json') ?? '');
  if (!sheetId || !json) throw new Error('필수값 누락');
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('raw_ocr_json 파싱 실패');
  }
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from('price_vendor_quote_sheets')
    .update({ raw_ocr_json: parsed })
    .eq('id', sheetId);
  if (error) throw new Error(error.message);
  revalidatePath(`/uploads/${sheetId}`);
}
