import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { uploadSheetImage, downloadSheet } from '@/lib/storage';
import { parseSheetImage, type Carrier } from '@/lib/vision-parse';

export const maxDuration = 300;

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
    .select('id, name, carrier')
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
    const imageBytes = await downloadSheet(path);
    const parsed = await parseSheetImage({
      imageBytes,
      carrier: vendor.carrier as Carrier,
      vendorName: vendor.name,
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
      .eq('id', sheetId);
    return NextResponse.json({ ok: true, sheet_id: sheetId, parsed_models: parsed.models.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb
      .from('price_vendor_quote_sheets')
      .update({ parse_status: 'error', error_message: msg })
      .eq('id', sheetId);
    return NextResponse.json({ error: msg, sheet_id: sheetId }, { status: 500 });
  }
}
