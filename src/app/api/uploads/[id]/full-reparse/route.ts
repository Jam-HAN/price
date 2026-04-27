import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { downloadSheet } from '@/lib/storage';
import { clovaExtract } from '@/lib/clova-ocr';
import { resolveClovaParser } from '@/lib/clova-parse-router';
import { cropAndResize, type CropSpec } from '@/lib/image-crop';
import { tileAndExtract } from '@/lib/clova-tile';
import { syncSheetToNormalized } from '@/lib/sync-sheet';

export const maxDuration = 300;

function parseCropSpec(raw: unknown): CropSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const y0 = Number(o.yRatio0);
  const y1 = Number(o.yRatio1);
  const w = Number(o.targetWidth);
  if (!Number.isFinite(y0) || !Number.isFinite(y1) || !Number.isFinite(w)) return null;
  if (y0 < 0 || y0 >= 1 || y1 <= y0 || y1 > 1) return null;
  if (w < 400 || w > 4000) return null;

  const x0Raw = o.xRatio0;
  const x1Raw = o.xRatio1;
  const x0 = x0Raw == null ? 0 : Number(x0Raw);
  const x1 = x1Raw == null ? 1 : Number(x1Raw);
  const xValid =
    Number.isFinite(x0) && Number.isFinite(x1) &&
    x0 >= 0 && x0 < 1 && x1 > x0 && x1 <= 1;

  const tileRaw = Number(o.tile);
  const tile = tileRaw === 2 || tileRaw === 3 ? tileRaw : undefined;

  return {
    yRatio0: y0,
    yRatio1: y1,
    xRatio0: xValid ? x0 : 0,
    xRatio1: xValid ? x1 : 1,
    targetWidth: Math.round(w),
    ...(tile ? { tile } : {}),
  };
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const sb = getSupabaseAdmin();
    const { data: sheet, error } = await sb
      .from('price_vendor_quote_sheets')
      .select('id, vendor_id, image_url, vendor:price_vendors(name, carrier, crop_spec, parser_key)')
      .eq('id', id)
      .single();
    if (error || !sheet) return NextResponse.json({ error: 'sheet 조회 실패' }, { status: 404 });
    const vendor = Array.isArray(sheet.vendor) ? sheet.vendor[0] : sheet.vendor;
    if (!sheet.image_url) return NextResponse.json({ error: '원본 이미지 없음' }, { status: 400 });

    const clovaRoute = resolveClovaParser(vendor.parser_key);
    if (!clovaRoute) {
      return NextResponse.json(
        { error: `CLOVA 파서 미등록 거래처: ${vendor.name} (parser_key=${vendor.parser_key ?? 'null'})` },
        { status: 400 },
      );
    }

    const imageBytes = await downloadSheet(sheet.image_url);
    const effectiveCrop = parseCropSpec(vendor.crop_spec);

    let clovaImg;
    if (effectiveCrop?.tile === 2 || effectiveCrop?.tile === 3) {
      clovaImg = await tileAndExtract({
        imageBytes,
        spec: effectiveCrop,
        tileCount: effectiveCrop.tile,
      });
    } else {
      const bytesForOcr = effectiveCrop ? await cropAndResize(imageBytes, effectiveCrop) : imageBytes;
      const formatForOcr = effectiveCrop
        ? 'png'
        : sheet.image_url.endsWith('.jpg') || sheet.image_url.endsWith('.jpeg')
          ? 'jpg'
          : 'png';
      clovaImg = await clovaExtract({ imageBytes: bytesForOcr, format: formatForOcr });
    }
    const parsed = clovaRoute.parser({
      version: 'V2',
      requestId: '',
      timestamp: Date.now(),
      images: [clovaImg],
    });

    await sb
      .from('price_vendor_quote_sheets')
      .update({
        raw_ocr_json: parsed,
        policy_round: parsed.policy_round,
        effective_time: parsed.effective_time,
        parse_status: 'parsed',
        parsed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', id);

    const syncResult = await syncSheetToNormalized(id);

    return NextResponse.json({
      ok: true,
      engine: 'clova',
      route: clovaRoute.label,
      parsed_models: parsed.models.length,
      synced: syncResult,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
