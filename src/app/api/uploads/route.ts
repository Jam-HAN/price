import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { uploadSheetImage, downloadSheet } from '@/lib/storage';
import { clovaExtract } from '@/lib/clova-ocr';
import { resolveClovaParser } from '@/lib/clova-parse-router';
import { cropAndResize, type CropSpec } from '@/lib/image-crop';
import { syncSheetToNormalized } from '@/lib/sync-sheet';

export const maxDuration = 300;

function parseCropSpec(input: unknown): CropSpec | null {
  if (input == null) return null;
  let raw: unknown = input;
  if (typeof input === 'string') {
    if (input.trim() === '') return null;
    try { raw = JSON.parse(input); } catch { return null; }
  }
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const y0 = Number(o.yRatio0);
  const y1 = Number(o.yRatio1);
  const w = Number(o.targetWidth);
  if (!Number.isFinite(y0) || !Number.isFinite(y1) || !Number.isFinite(w)) return null;
  if (y0 < 0 || y0 >= 1 || y1 <= y0 || y1 > 1) return null;
  if (w < 400 || w > 4000) return null;
  return { yRatio0: y0, yRatio1: y1, targetWidth: Math.round(w) };
}

const EXT_MAP: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export async function POST(req: Request) {
  try {
    return await handle(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    console.error('[api/uploads] fatal', msg, stack);
    return NextResponse.json({ error: msg, where: 'outer', stack }, { status: 500 });
  }
}

async function handle(req: Request) {
  const form = await req.formData();
  const vendorId = String(form.get('vendor_id') ?? '');
  const effectiveDate = String(form.get('effective_date') ?? new Date().toISOString().slice(0, 10));
  const file = form.get('file') as File | null;
  // 프론트에서 크롭 영역을 직접 넘기면 벤더 기본값을 오버라이드. 없으면 vendor.crop_spec 사용.
  const cropSpecFromForm = parseCropSpec(form.get('crop_spec'));
  const saveCropSpec = form.get('save_crop_spec') === '1';
  if (!vendorId || !file) {
    return NextResponse.json({ error: 'vendor_id, file 필수' }, { status: 400 });
  }
  const ext = EXT_MAP[file.type];
  if (!ext) {
    return NextResponse.json({ error: `지원하지 않는 이미지 타입: ${file.type}` }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data: vendor, error: vErr } = await sb
    .from('price_vendors')
    .select('id, name, carrier, crop_spec')
    .eq('id', vendorId)
    .single();
  if (vErr || !vendor) {
    return NextResponse.json({ error: '거래처를 찾을 수 없습니다' }, { status: 404 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const { path } = await uploadSheetImage({
    vendorId: vendor.id,
    effectiveDate,
    bytes,
    contentType: file.type,
    extension: ext,
  });

  const { data: existing } = await sb
    .from('price_vendor_quote_sheets')
    .select('id')
    .eq('vendor_id', vendor.id)
    .eq('effective_date', effectiveDate)
    .maybeSingle();

  let sheetId: string;
  if (existing) {
    sheetId = existing.id;
    await sb
      .from('price_vendor_quote_sheets')
      .update({
        image_url: path,
        parse_status: 'parsing',
        raw_ocr_json: null,
        error_message: null,
        parsed_at: null,
        confirmed_at: null,
      })
      .eq('id', existing.id);
  } else {
    const { data: inserted, error: insErr } = await sb
      .from('price_vendor_quote_sheets')
      .insert({
        vendor_id: vendor.id,
        effective_date: effectiveDate,
        image_url: path,
        parse_status: 'parsing',
      })
      .select('id')
      .single();
    if (insErr || !inserted) {
      return NextResponse.json({ error: insErr?.message ?? 'insert failed' }, { status: 500 });
    }
    sheetId = inserted.id;
  }

  // 동기 파싱 (긴 이미지는 최대 ~1분 소요)
  try {
    const clovaRoute = resolveClovaParser(vendor.name);
    if (!clovaRoute) {
      throw new Error(`CLOVA 파서 미등록 거래처: ${vendor.name}`);
    }

    const imageBytes = await downloadSheet(path);
    // crop 우선순위: form 전달값 → vendor 기본값(crop_spec). 없으면 원본 그대로.
    const effectiveCrop: CropSpec | null = cropSpecFromForm ?? parseCropSpec(vendor.crop_spec);
    const bytesForOcr = effectiveCrop ? await cropAndResize(imageBytes, effectiveCrop) : imageBytes;
    const formatForOcr = effectiveCrop ? 'png' : (ext === 'jpg' ? 'jpg' : (ext as 'png' | 'jpeg'));

    // 사용자가 "기본값으로 저장" 체크한 경우 벤더 crop_spec 업데이트
    if (saveCropSpec && cropSpecFromForm) {
      await sb.from('price_vendors').update({ crop_spec: cropSpecFromForm }).eq('id', vendor.id);
    }

    const clovaImg = await clovaExtract({ imageBytes: bytesForOcr, format: formatForOcr });
    const parsed = clovaRoute.parser({
      version: 'V2',
      requestId: '',
      timestamp: Date.now(),
      images: [clovaImg],
    });
    console.log(`[uploads] CLOVA route=${clovaRoute.label} models=${parsed.models.length}`);

    await sb
      .from('price_vendor_quote_sheets')
      .update({
        raw_ocr_json: parsed,
        policy_round: parsed.policy_round,
        effective_time: parsed.effective_time,
        parse_status: 'parsed',
        parsed_at: new Date().toISOString(),
      })
      .eq('id', sheetId);

    // 자동 동기화: 확정 단계 없이 곧바로 quotes/subsidies에 반영
    const syncResult = await syncSheetToNormalized(sheetId);

    return NextResponse.json({
      ok: true,
      sheet_id: sheetId,
      parsed_models: parsed.models.length,
      route: clovaRoute.label,
      crop_applied: effectiveCrop ?? null,
      synced: syncResult,
    });
  } catch (e) {
    const rawMsg = e instanceof Error ? e.message : String(e);
    const msg = /DEADLINE_EXCEEDED/i.test(rawMsg)
      ? `${rawMsg}\n\nCLOVA가 15초 안에 표를 읽지 못했습니다. 이미지 밀도가 너무 높습니다. 크롭 영역을 더 좁히거나(모델표만 남기기) 업로드 폼에서 '가로' 값을 1000~1300px로 낮춰 재시도하세요.`
      : rawMsg;
    await sb
      .from('price_vendor_quote_sheets')
      .update({ parse_status: 'error', error_message: msg })
      .eq('id', sheetId);
    return NextResponse.json({ error: msg, sheet_id: sheetId }, { status: 500 });
  }
}
