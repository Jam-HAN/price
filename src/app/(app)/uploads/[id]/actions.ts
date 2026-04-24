'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { SheetExtraction } from '@/lib/vision-schema';
import { syncSheetToNormalized } from '@/lib/sync-sheet';
import { normalizeDeviceCode, canonicalCandidates, canonicalNickname } from '@/lib/device-normalize';

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
 * 화이트리스트 모드 — 신규 디바이스는 만들지 않음.
 * 파싱된 벤더 raw code를 정규화하여 기존 마스터에 매칭되면 alias만 자동 추가.
 * 마스터에 없으면 스킵 (사용자가 /devices에서 수동 추가해야 반영됨).
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
  const { data: devices } = await sb.from('price_devices').select('id, model_code, nickname').eq('active', true);
  const deviceByCode = new Map((devices ?? []).map((d) => [d.model_code, d.id]));
  const deviceByNick = new Map((devices ?? []).map((d) => [d.nickname, d.id]));
  const deviceByNormalized = new Map<string, string>();
  for (const d of devices ?? []) {
    const n = normalizeDeviceCode(d.model_code);
    if (!deviceByNormalized.has(n)) deviceByNormalized.set(n, d.id);
  }

  let linked = 0;
  const skipped: string[] = [];
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
      skipped.push(`${model.model_code_raw} · ${model.nickname}`);
      continue;
    }
    if (!aliasMap.has(model.model_code_raw)) {
      const { error: aliasErr } = await sb
        .from('price_device_aliases')
        .insert({
          device_id: deviceId,
          vendor_id: sheet.vendor_id,
          vendor_code: model.model_code_raw,
        });
      if (!aliasErr) {
        linked++;
        aliasMap.set(model.model_code_raw, deviceId);
      }
    }
  }

  // alias가 추가됐으면 기존 sync에서 매칭 못 했던 행들이 이번엔 잡힘 → 재동기화
  if (linked > 0) {
    await syncSheetToNormalized(sheetId);
  }

  revalidatePath(`/uploads/${sheetId}`);
  revalidatePath('/devices');
  revalidatePath('/aliases');
  redirect(`/uploads/${sheetId}?auto_registered=0_${linked}_${skipped.length}`);
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
