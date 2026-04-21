import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { downloadSheet } from '@/lib/storage';
import { reparseRows, type Carrier } from '@/lib/vision-parse';
import { mergeReparsedModels, detectSuspiciousModels } from '@/lib/quality';
import type { SheetExtraction } from '@/lib/vision-schema';

export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { model_codes } = (await req.json().catch(() => ({}))) as { model_codes?: string[] };
    const sb = getSupabaseAdmin();

    const { data: sheet, error } = await sb
      .from('price_vendor_quote_sheets')
      .select('id, vendor_id, image_url, raw_ocr_json, vendor:price_vendors(name, carrier)')
      .eq('id', id)
      .single();
    if (error || !sheet) return NextResponse.json({ error: 'sheet 조회 실패' }, { status: 404 });
    const vendor = Array.isArray(sheet.vendor) ? sheet.vendor[0] : sheet.vendor;
    if (!sheet.image_url) return NextResponse.json({ error: '원본 이미지 없음' }, { status: 400 });

    const raw = sheet.raw_ocr_json as SheetExtraction | null;
    if (!raw) return NextResponse.json({ error: '파싱 결과 없음' }, { status: 400 });

    // model_codes가 없으면 자동 감지된 suspicious 전부
    let targets = model_codes && model_codes.length > 0 ? model_codes : null;
    if (!targets) {
      const flags = detectSuspiciousModels(raw);
      targets = flags.map((f) => f.model_code);
    }
    if (targets.length === 0) {
      return NextResponse.json({ ok: true, reparsed: 0, message: '재파싱 필요한 모델 없음' });
    }
    // 한 번에 너무 많으면 집중력 떨어지므로 10개 이하 권장
    targets = targets.slice(0, 15);

    const imageBytes = await downloadSheet(sheet.image_url);
    const reparsed = await reparseRows({
      imageBytes,
      carrier: vendor.carrier as Carrier,
      vendorName: vendor.name,
      targetModelCodes: targets,
    });

    const merged = mergeReparsedModels(raw, reparsed);
    await sb
      .from('price_vendor_quote_sheets')
      .update({ raw_ocr_json: merged, parse_status: 'parsed', parsed_at: new Date().toISOString() })
      .eq('id', id);

    return NextResponse.json({
      ok: true,
      reparsed: reparsed.length,
      targets,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
