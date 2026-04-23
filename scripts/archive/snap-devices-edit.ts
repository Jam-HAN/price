import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'https://price.dbphone.co.kr';
const PW = process.env.INTERNAL_PASSWORD || 'aaa000111*';
const OUT = '/tmp/price-screens';

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true })).newPage();
  await page.goto(`${BASE}/login`);
  await page.fill('input[type=password]', PW);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));

  // edit 모드 스냅
  await page.goto(`${BASE}/devices?mode=edit`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${OUT}/devices-edit.png`, fullPage: false });

  // 모달 열고 스냅
  await page.getByText('수정').first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/devices-edit-modal.png`, fullPage: false });

  // curate 모드 스냅
  await page.goto(`${BASE}/devices?mode=curate`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${OUT}/devices-curate.png`, fullPage: false });

  await browser.close();
  console.log('저장:', OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
