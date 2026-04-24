import { getSupabaseAdmin } from '../src/lib/supabase';
import { normalizeDeviceCode, canonicalCandidates } from '../src/lib/device-normalize';

type Model = { model_code_raw: string; nickname?: string; retail_price_krw?: number | null };

async function main() {
  const sb = getSupabaseAdmin();

  // DB에 IPA 계열 device 확인
  const { data: devs } = await sb
    .from('price_devices')
    .select('id, model_code, nickname, active')
    .or('model_code.ilike.%IPA%,nickname.ilike.%AIR%,nickname.ilike.%에어%')
    .order('model_code');
  console.log('=== DB 아이폰 에어 계열 devices ===');
  console.table(devs);

  // 최근 confirmed sheet들의 raw_ocr_json 에서 IPA 관련 모델 추출
  const { data: sheets } = await sb
    .from('price_vendor_quote_sheets')
    .select('id, raw_ocr_json, vendor:price_vendors(name)')
    .eq('parse_status', 'confirmed');

  console.log('\n=== OCR 시트에서 아이폰 에어 관련 raw 모델 ===');
  for (const s of sheets ?? []) {
    const v = Array.isArray(s.vendor) ? s.vendor[0] : s.vendor;
    const raw = s.raw_ocr_json as { models?: Model[] } | null;
    const models = raw?.models ?? [];
    const airRelated = models.filter((m) =>
      /IPA|AIR|에어|air/i.test(`${m.model_code_raw} ${m.nickname ?? ''}`)
    );
    console.log(`\n[${v?.name}] OCR 모델 ${models.length}건 — 에어 관련 ${airRelated.length}건`);
    for (const m of airRelated) {
      const norm = normalizeDeviceCode(m.model_code_raw);
      const cands = canonicalCandidates(m.model_code_raw);
      console.log(`  raw="${m.model_code_raw}" nick="${m.nickname}" retail=${m.retail_price_krw}`);
      console.log(`     normalize → ${norm}, candidates=${cands.join(',')}`);
    }
  }

  // IPA device별 quotes 건수
  console.log('\n=== IPA 계열 device별 quotes 건수 ===');
  for (const d of devs ?? []) {
    const { count } = await sb
      .from('price_vendor_quotes')
      .select('*', { count: 'exact', head: true })
      .eq('device_id', d.id);
    console.log(`  ${d.model_code.padEnd(12)} ${d.nickname.padEnd(22)} quotes=${count}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
