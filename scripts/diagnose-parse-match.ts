import { getSupabaseAdmin } from '../src/lib/supabase';
import { normalizeDeviceCode, canonicalCandidates } from '../src/lib/device-normalize';

async function main() {
  const sb = getSupabaseAdmin();

  const [{ data: devices }, { data: aliases }, { data: sheets }] = await Promise.all([
    sb.from('price_devices').select('id, model_code, nickname, active'),
    sb.from('price_device_aliases').select('vendor_id, vendor_code, device_id'),
    sb
      .from('price_vendor_quote_sheets')
      .select('id, vendor_id, raw_ocr_json, parse_status, uploaded_at, vendor:price_vendors(name, carrier)')
      .eq('parse_status', 'confirmed')
      .order('uploaded_at', { ascending: false }),
  ]);

  const deviceByCode = new Map((devices ?? []).map((d) => [d.model_code, d]));
  const deviceByNick = new Map((devices ?? []).map((d) => [d.nickname, d]));
  const deviceByNormalized = new Map<string, typeof devices[number] | undefined>();
  for (const d of devices ?? []) {
    const n = normalizeDeviceCode(d.model_code);
    if (!deviceByNormalized.has(n)) deviceByNormalized.set(n, d);
  }

  for (const sheet of sheets ?? []) {
    const v = Array.isArray(sheet.vendor) ? sheet.vendor[0] : sheet.vendor;
    const raw = sheet.raw_ocr_json as { models?: Array<{ model_code_raw: string; nickname?: string }> } | null;
    const models = raw?.models ?? [];
    const sheetAliases = new Map(
      (aliases ?? []).filter((a) => a.vendor_id === sheet.vendor_id).map((a) => [a.vendor_code, a.device_id]),
    );
    console.log(`\n========== ${v?.name}(${v?.carrier}) sheet=${sheet.id.slice(0, 8)} ==========`);
    let matched = 0;
    let unmatched = 0;
    const unmatchedList: { raw: string; nick: string }[] = [];
    for (const m of models) {
      const candidates = canonicalCandidates(m.model_code_raw);
      let matchedBy: string | null = null;
      if (sheetAliases.has(m.model_code_raw)) matchedBy = `alias`;
      else if (deviceByCode.has(m.model_code_raw)) matchedBy = `exact`;
      else {
        for (const c of candidates) {
          if (deviceByNormalized.has(c) || deviceByCode.has(c)) { matchedBy = `norm(${c})`; break; }
        }
      }
      if (!matchedBy && m.nickname && deviceByNick.has(m.nickname)) matchedBy = `nick`;
      if (matchedBy) matched++;
      else {
        unmatched++;
        unmatchedList.push({ raw: m.model_code_raw, nick: m.nickname ?? '' });
      }
    }
    console.log(`OCR 모델 ${models.length}건 · 매칭 ${matched}건 · unmapped ${unmatched}건`);
    if (unmatchedList.length) {
      console.log('미매칭:');
      for (const u of unmatchedList) {
        console.log(`  raw="${u.raw}" nick="${u.nick}" (candidates=${canonicalCandidates(u.raw).join(',')})`);
      }
    }
  }

  console.log('\n========== active 모델인데 quote 없는 것 ==========');
  const { data: quotedIds } = await sb.from('price_vendor_quotes').select('device_id');
  const used = new Set((quotedIds ?? []).map((q) => q.device_id));
  const activeNoQuote = (devices ?? []).filter((d) => d.active && !used.has(d.id));
  for (const d of activeNoQuote) {
    console.log(`  ${d.model_code.padEnd(22)} ${d.nickname}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
