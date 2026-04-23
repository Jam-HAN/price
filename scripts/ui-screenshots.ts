/**
 * 각 페이지 스크린샷 저장 + 헤더 위치 측정.
 * 실행: npx dotenv -e .env.local -- npx tsx scripts/ui-screenshots.ts
 */

import { chromium, type Page } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'https://price.dbphone.co.kr';
const PW = process.env.INTERNAL_PASSWORD || 'aaa000111*';
const OUT = '/tmp/price-screens';

async function login(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type=password]', PW);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

async function snap(page: Page, path: string, file: string) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${file}.png`, fullPage: true });
  // Measure header position
  const headerBox = await page.locator('header').first().boundingBox().catch(() => null);
  const firstContentBox = await page.locator('header').first().evaluateHandle(
    (h) => (h as HTMLElement).nextElementSibling,
  ).then(async (handle) => {
    const el = handle.asElement();
    if (!el) return null;
    return el.boundingBox();
  }).catch(() => null);
  const gap = headerBox && firstContentBox ? firstContentBox.y - (headerBox.y + headerBox.height) : null;
  console.log(`${file}: header_y=${headerBox?.y?.toFixed(0)}, content_y=${firstContentBox?.y?.toFixed(0)}, gap=${gap?.toFixed(0)}px`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await login(page);

  const pages: [string, string][] = [
    ['/dashboard', '01-dashboard'],
    ['/uploads', '02-uploads'],
    ['/subsidies', '03-subsidies'],
    ['/rebates', '04-rebates'],
    ['/matrix', '05-matrix'],
    ['/margins', '06-margins'],
    ['/publish', '07-publish'],
    ['/devices', '08-devices'],
    ['/vendors', '09-vendors'],
    ['/plans', '10-plans'],
    ['/aliases', '11-aliases'],
  ];
  for (const [p, f] of pages) await snap(page, p, f);
  await browser.close();
  console.log(`\n저장 경로: ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
