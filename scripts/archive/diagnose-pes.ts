import { getSupabaseAdmin } from '../src/lib/supabase';
import { normalizeDeviceCode, canonicalCandidates } from '../src/lib/device-normalize';

type Model = { model_code_raw: string; nickname?: string };

async function main() {
  const sb = getSupabaseAdmin();

  // 피에스 vendor
  const { data: v } = await sb.from('price_vendors').select('id, name, parser_key, crop_spec').eq('name', '피에스').single();
  console.log(`피에스 parser_key=${v?.parser_key} crop=${JSON.stringify(v?.crop_spec)}`);

  // 최근 피에스 sheet 전체 (error 포함)
  const { data: sheets } = await sb
    .from('price_vendor_quote_sheets')
    .select('id, effective_date, parse_status, error_message, uploaded_at, raw_ocr_json')
    .eq('vendor_id', v!.id)
    .order('uploaded_at', { ascending: false });

  console.log(`\n=== 피에스 시트 ${sheets?.length ?? 0}건 ===`);
  for (const s of sheets ?? []) {
    const raw = s.raw_ocr_json as { models?: Model[] } | null;
    const mcnt = raw?.models?.length ?? 0;
    console.log(`  ${s.uploaded_at.slice(0,16)} · ${s.effective_date} · ${s.parse_status} · 모델${mcnt}건`);
    if (s.error_message) console.log(`    err: ${s.error_message.slice(0, 120)}`);
  }

  // 가장 최근 피에스 confirmed 시트의 매칭
  const latest = (sheets ?? []).find((s) => s.parse_status === 'confirmed');
  if (!latest) { console.log('\nconfirmed 피에스 시트 없음'); return; }

  const [{ data: devices }, { data: aliases }] = await Promise.all([
    sb.from('price_devices').select('id, model_code, nickname, active'),
    sb.from('price_device_aliases').select('vendor_code, device_id').eq('vendor_id', v!.id),
  ]);
  const deviceByCode = new Map((devices ?? []).map((d) => [d.model_code, d]));
  const deviceByNick = new Map((devices ?? []).map((d) => [d.nickname, d]));
  const deviceByNorm = new Map<string, typeof devices[number]>();
  for (const d of devices ?? []) {
    const n = normalizeDeviceCode(d.model_code);
    if (!deviceByNorm.has(n)) deviceByNorm.set(n, d);
  }
  const aliasMap = new Map((aliases ?? []).map((a) => [a.vendor_code, a.device_id]));

  const raw = latest.raw_ocr_json as { models?: Model[] } | null;
  const models = raw?.models ?? [];
  let matched = 0;
  const unmatched: { raw: string; nick: string; norm: string; cands: string }[] = [];
  for (const m of models) {
    const cands = canonicalCandidates(m.model_code_raw);
    let hit: typeof devices[number] | string | undefined =
      aliasMap.get(m.model_code_raw) ?? deviceByCode.get(m.model_code_raw);
    if (!hit) for (const c of cands) { const h = deviceByNorm.get(c) ?? deviceByCode.get(c); if (h) { hit = h; break; } }
    if (!hit && m.nickname) hit = deviceByNick.get(m.nickname);
    if (hit) matched++;
    else unmatched.push({ raw: m.model_code_raw, nick: m.nickname ?? '', norm: normalizeDeviceCode(m.model_code_raw), cands: cands.join(',') });
  }
  console.log(`\n=== 최근 confirmed 피에스 sheet ${latest.id.slice(0,8)} (${latest.effective_date}) ===`);
  console.log(`OCR 모델 ${models.length}건 · 매칭 ${matched}건 · unmapped ${unmatched.length}건`);
  if (unmatched.length) {
    console.log('미매칭:');
    for (const u of unmatched) {
      console.log(`  raw="${u.raw}" nick="${u.nick}"`);
      console.log(`    → normalize=${u.norm}, candidates=[${u.cands}]`);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
