import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { downloadSheet } from '@/lib/storage';
import { clovaExtract } from '@/lib/clova-ocr';
import { resolveClovaParser } from '@/lib/clova-parse-router';
import { cropAndResize, type CropSpec, type CropRegion } from '@/lib/image-crop';
import { tileAndExtract } from '@/lib/clova-tile';
import type { SheetExtraction } from '@/lib/vision-schema';
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
  const tile = tileRaw === 2 || tileRaw === 4 || tileRaw === 6 ? tileRaw : undefined;

  const regions = parseRegions(o.regions);

  return {
    yRatio0: y0,
    yRatio1: y1,
    xRatio0: xValid ? x0 : 0,
    xRatio1: xValid ? x1 : 1,
    targetWidth: Math.round(w),
    ...(tile ? { tile } : {}),
    ...(regions ? { regions } : {}),
  };
}

function parseRegions(input: unknown): CropRegion[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const out: CropRegion[] = [];
  for (const r of input) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name : '';
    const y0 = Number(o.yRatio0);
    const y1 = Number(o.yRatio1);
    if (!name || !Number.isFinite(y0) || !Number.isFinite(y1)) continue;
    if (y0 < 0 || y0 >= 1 || y1 <= y0 || y1 > 1) continue;
    const x0 = o.xRatio0 == null ? undefined : Number(o.xRatio0);
    const x1 = o.xRatio1 == null ? undefined : Number(o.xRatio1);
    const tw = o.targetWidth == null ? undefined : Number(o.targetWidth);
    const pk = typeof o.parser_key === 'string' ? o.parser_key : undefined;
    out.push({
      name,
      yRatio0: y0,
      yRatio1: y1,
      ...(x0 != null && Number.isFinite(x0) ? { xRatio0: x0 } : {}),
      ...(x1 != null && Number.isFinite(x1) ? { xRatio1: x1 } : {}),
      ...(tw != null && Number.isFinite(tw) ? { targetWidth: Math.round(tw) } : {}),
      ...(pk ? { parser_key: pk } : {}),
    });
  }
  return out.length > 0 ? out : undefined;
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

    let parsed: SheetExtraction;

    if (effectiveCrop?.regions && effectiveCrop.regions.length > 0) {
      const merged: SheetExtraction = {
        policy_round: null,
        effective_date: null,
        effective_time: null,
        models: [],
        policies: [],
      };
      for (const region of effectiveCrop.regions) {
        const subSpec: CropSpec = {
          yRatio0: region.yRatio0,
          yRatio1: region.yRatio1,
          xRatio0: region.xRatio0 ?? effectiveCrop.xRatio0 ?? 0,
          xRatio1: region.xRatio1 ?? effectiveCrop.xRatio1 ?? 1,
          targetWidth: region.targetWidth ?? effectiveCrop.targetWidth,
        };
        const bytesForOcr = await cropAndResize(imageBytes, subSpec);
        const regionImg = await clovaExtract({ imageBytes: bytesForOcr, format: 'png' });
        const regionRoute = resolveClovaParser(region.parser_key ?? vendor.parser_key);
        if (!regionRoute) continue;
        const regionParsed = regionRoute.parser({
          version: 'V2',
          requestId: '',
          timestamp: Date.now(),
          images: [regionImg],
        });
        merged.models.push(...regionParsed.models);
        merged.policies.push(...regionParsed.policies);
        if (regionParsed.policy_round && !merged.policy_round) merged.policy_round = regionParsed.policy_round;
        if (regionParsed.effective_date && !merged.effective_date) merged.effective_date = regionParsed.effective_date;
        if (regionParsed.effective_time && !merged.effective_time) merged.effective_time = regionParsed.effective_time;
      }
      parsed = merged;
    } else {
      let clovaImg;
      if (effectiveCrop?.tile === 2 || effectiveCrop?.tile === 4 || effectiveCrop?.tile === 6) {
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
      parsed = clovaRoute.parser({
        version: 'V2',
        requestId: '',
        timestamp: Date.now(),
        images: [clovaImg],
      });
    }

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
