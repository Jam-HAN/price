import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { downloadSheet } from '@/lib/storage';
import { parseSheetImage, type Carrier, VISION_MODEL_CLAUDE, VISION_MODEL_GEMINI } from '@/lib/vision-parse';

export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { model } = (await req.json().catch(() => ({}))) as { model?: 'gemini' | 'claude' };
    const selectedModel = model === 'claude' ? VISION_MODEL_CLAUDE : VISION_MODEL_GEMINI;

    const sb = getSupabaseAdmin();
    const { data: sheet, error } = await sb
      .from('price_vendor_quote_sheets')
      .select('id, vendor_id, image_url, vendor:price_vendors(name, carrier)')
      .eq('id', id)
      .single();
    if (error || !sheet) return NextResponse.json({ error: 'sheet 조회 실패' }, { status: 404 });
    const vendor = Array.isArray(sheet.vendor) ? sheet.vendor[0] : sheet.vendor;
    if (!sheet.image_url) return NextResponse.json({ error: '원본 이미지 없음' }, { status: 400 });

    const imageBytes = await downloadSheet(sheet.image_url);
    const parsed = await parseSheetImage({
      imageBytes,
      carrier: vendor.carrier as Carrier,
      vendorName: vendor.name,
      model: selectedModel,
    });

    await sb
      .from('price_vendor_quote_sheets')
      .update({
        raw_ocr_json: parsed,
        policy_round: parsed.policy_round,
        effective_time: parsed.effective_time,
        parse_status: 'parsed',
        parsed_at: new Date().toISOString(),
      })
      .eq('id', id);

    return NextResponse.json({
      ok: true,
      model: selectedModel,
      parsed_models: parsed.models.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
