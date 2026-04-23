import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { downloadSheet } from '@/lib/storage';
import { clovaExtract } from '@/lib/clova-ocr';
import { resolveClovaParser } from '@/lib/clova-parse-router';
import { cropAndResize, type CropSpec } from '@/lib/image-crop';
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
  return { yRatio0: y0, yRatio1: y1, targetWidth: Math.round(w) };
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
    const bytesForOcr = effectiveCrop ? await cropAndResize(imageBytes, effectiveCrop) : imageBytes;
    const formatForOcr = effectiveCrop
      ? 'png'
      : sheet.image_url.endsWith('.jpg') || sheet.image_url.endsWith('.jpeg')
        ? 'jpg'
        : 'png';

    const clovaImg = await clovaExtract({ imageBytes: bytesForOcr, format: formatForOcr });
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
