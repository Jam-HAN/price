/**
 * 청담 sheet full-reparse — IPA regex fix 배포 후 원본 이미지부터 OCR 재실행.
 */
import { getSupabaseAdmin } from '../src/lib/supabase';
import { chromium } from 'playwright';

const BASE = 'https://price.dbphone.co.kr';
const PW = process.env.INTERNAL_PASSWORD || 'aaa000111*';

async function main() {
  const sb = getSupabaseAdmin();
  const { data: sheets } = await sb
    .from('price_vendor_quote_sheets')
    .select('id, vendor:price_vendors(name)')
    .eq('parse_status', 'confirmed');
  const cheongdam = (sheets ?? []).find((s) => {
    const v = Array.isArray(s.vendor) ? s.vendor[0] : s.vendor;
    return v?.name === '청담';
  });
  if (!cheongdam) { console.error('청담 sheet 없음'); process.exit(1); }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill('input[type=password]', PW);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  const cookies = await ctx.cookies();
  const gate = cookies.find((c) => c.name === 'dbp_price_gate');

  console.log(`청담 sheet=${cheongdam.id.slice(0, 8)} full-reparse 시작 (최대 60s)...`);
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/uploads/${cheongdam.id}/full-reparse`, {
    method: 'POST',
    headers: {
      cookie: `dbp_price_gate=${gate?.value}`,
      'content-type': 'application/json',
    },
  });
  const json = await res.json() as { ok?: boolean; parsed_models?: number; route?: string; synced?: { quotes?: number; unmapped?: number }; error?: string };
  console.log(`  응답 ${res.status} / ${Date.now() - t0}ms`);
  console.log(`  ${JSON.stringify(json, null, 2)}`);

  await browser.close();

  // IPA quotes 재확인
  const { data: ipaDevs } = await sb
    .from('price_devices')
    .select('id, model_code, nickname')
    .ilike('model_code', 'IPA%');
  console.log('\nIPA 계열 device별 quotes 건수:');
  for (const d of ipaDevs ?? []) {
    const { count } = await sb
      .from('price_vendor_quotes')
      .select('*', { count: 'exact', head: true })
      .eq('device_id', d.id);
    console.log(`  ${d.model_code.padEnd(12)} ${d.nickname.padEnd(22)} quotes=${count}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
