'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { SheetExtraction } from '@/lib/vision-schema';
import { syncSheetToNormalized } from '@/lib/sync-sheet';

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

  // 새로 등록된 모델이 있으면 동기화 재실행
  if (created > 0) {
    await syncSheetToNormalized(sheetId);
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
  await syncSheetToNormalized(sheetId);
  revalidatePath(`/uploads/${sheetId}`);
  revalidatePath('/publish');
  revalidatePath('/matrix');
}

/**
 * 단일 셀 값 수정. raw_ocr_json 갱신 + 정답 쌍 기록 + normalized 테이블 즉시 동기화.
 */
export async function updateCell(input: {
  sheet_id: string;
  model_code_raw: string;
  plan_tier_code: string | null;
  field:
    | 'retail_price_krw'
    | 'subsidy_krw'
    | 'common.new010' | 'common.mnp' | 'common.change'
    | 'select.new010' | 'select.mnp' | 'select.change';
  after_value: number | null;
  flag_reason?: string | null;
}) {
  const sb = getSupabaseAdmin();
  const { data: sheet, error } = await sb
    .from('price_vendor_quote_sheets')
    .select('raw_ocr_json')
    .eq('id', input.sheet_id)
    .single();
  if (error || !sheet) throw new Error('sheet 조회 실패');

  const raw = sheet.raw_ocr_json as SheetExtraction | null;
  if (!raw) throw new Error('파싱 결과 없음');

  const modelIdx = (raw.models ?? []).findIndex((m) => m.model_code_raw === input.model_code_raw);
  if (modelIdx < 0) throw new Error(`모델 ${input.model_code_raw} 없음`);
  const model = raw.models[modelIdx];

  let before: number | null = null;

  if (input.field === 'retail_price_krw') {
    before = model.retail_price_krw ?? null;
    model.retail_price_krw = input.after_value ?? 0;
  } else {
    if (!input.plan_tier_code) throw new Error('plan_tier_code 필요');
    const tierIdx = (model.tiers ?? []).findIndex((t) => t.plan_tier_code === input.plan_tier_code);
    if (tierIdx < 0) throw new Error(`tier ${input.plan_tier_code} 없음`);
    const tier = model.tiers[tierIdx];

    if (input.field === 'subsidy_krw') {
      before = tier.subsidy_krw ?? null;
      tier.subsidy_krw = input.after_value;
    } else {
      const [blockKey, actKey] = input.field.split('.') as [
        'common' | 'select',
        'new010' | 'mnp' | 'change',
      ];
      if (!tier[blockKey]) {
        tier[blockKey] = { new010: null, mnp: null, change: null };
      }
      const block = tier[blockKey]!;
      before = block[actKey] ?? null;
      block[actKey] = input.after_value;
    }
  }

  const { error: updateErr } = await sb
    .from('price_vendor_quote_sheets')
    .update({ raw_ocr_json: raw })
    .eq('id', input.sheet_id);
  if (updateErr) throw new Error(updateErr.message);

  await sb.from('price_cell_corrections').insert({
    sheet_id: input.sheet_id,
    model_code_raw: input.model_code_raw,
    plan_tier_code: input.plan_tier_code,
    field: input.field,
    before_value: before,
    after_value: input.after_value,
    flag_reason: input.flag_reason ?? 'manual',
  });

  // 즉시 normalized 테이블 동기화 → matrix/publish에 즉시 반영
  await syncSheetToNormalized(input.sheet_id);

  revalidatePath(`/uploads/${input.sheet_id}`);
  revalidatePath('/publish');
  revalidatePath('/matrix');
  return { before, after: input.after_value };
}
