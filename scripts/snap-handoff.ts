import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'https://price.dbphone.co.kr';
const PW = process.env.INTERNAL_PASSWORD || 'aaa000111*';
const OUT = '/tmp/price-handoff';

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true })).newPage();
  await page.goto(`${BASE}/login`);
  await page.fill('input[type=password]', PW);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));

  const pages: [string, string][] = [
    ['/dashboard', '01-dashboard'],
    ['/devices', '02-devices'],
    ['/publish?mode=cust&carrier=SKT&contract=common', '03-publish-cust'],
    ['/publish?mode=net&carrier=SKT&contract=common', '04-publish-net'],
    ['/uploads', '05-uploads'],
    ['/subsidies', '06-subsidies'],
  ];
  for (const [p, f] of pages) {
    await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle', timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${f}.png`, fullPage: false });
    console.log('snap', f);
  }
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
