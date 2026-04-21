/**
 * Playwright UI audit — 페이지별 로드 타이밍 + 버튼/탭 클릭 반응 측정.
 * 실행: npx dotenv -e .env.local -- npx tsx scripts/ui-audit.ts
 */

import { chromium, type Page } from 'playwright';

const BASE = 'https://price.dbphone.co.kr';
const PW = process.env.INTERNAL_PASSWORD || 'aaa000111*';

type Result = { name: string; ms: number; ok: boolean; note?: string };
const results: Result[] = [];

async function timed<T>(name: string, fn: () => Promise<T>): Promise<T | null> {
  const t0 = Date.now();
  try {
    const r = await fn();
    results.push({ name, ms: Date.now() - t0, ok: true });
    return r;
  } catch (e) {
    results.push({ name, ms: Date.now() - t0, ok: false, note: (e as Error).message.slice(0, 80) });
    return null;
  }
}

async function login(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type=password]', PW);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

async function goto(page: Page, path: string) {
  const t0 = Date.now();
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  const ms = Date.now() - t0;
  results.push({ name: `GET ${path}`, ms, ok: true });
  return ms;
}

async function clickText(page: Page, text: string | RegExp, label: string) {
  const locator = page.getByText(text, { exact: false }).first();
  const t0 = Date.now();
  try {
    await locator.click({ timeout: 3000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    results.push({ name: label, ms: Date.now() - t0, ok: true });
  } catch (e) {
    results.push({ name: label, ms: Date.now() - t0, ok: false, note: (e as Error).message.slice(0, 80) });
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  // 1. 로그인
  await timed('login', () => login(page));

  // 2. 각 페이지 로드
  await goto(page, '/dashboard');
  await goto(page, '/uploads');
  await goto(page, '/subsidies');
  await goto(page, '/rebates');
  await goto(page, '/matrix');
  await goto(page, '/margins');
  await goto(page, '/publish');
  await goto(page, '/devices');
  await goto(page, '/vendors');
  await goto(page, '/plans');
  await goto(page, '/aliases');

  // 3. /subsidies 통신사 탭 클릭
  await goto(page, '/subsidies?carrier=SKT');
  await clickText(page, 'KT', '/subsidies → KT 탭');
  await clickText(page, 'LGU+', '/subsidies → LGU+ 탭');

  // 4. /rebates 통신사 탭
  await goto(page, '/rebates?carrier=SKT');
  await clickText(page, 'KT', '/rebates → KT 탭');

  // 5. /matrix 통신사 + 약정 탭
  await goto(page, '/matrix?carrier=SKT&contract=common');
  await clickText(page, /^KT$/, '/matrix → KT 탭');
  await clickText(page, '선택약정', '/matrix → 선택약정');

  // 6. /devices 프리셋 / 카드 토글
  await goto(page, '/devices');
  await clickText(page, '전체 ON', '/devices → 전체 ON');
  await page.waitForTimeout(500);
  await clickText(page, 'Samsung 주력', '/devices → Samsung 주력 프리셋');
  await page.waitForTimeout(500);
  // 첫 번째 디바이스 카드 클릭
  const firstCard = page.locator('button:has-text("만")').first();
  const t0 = Date.now();
  await firstCard.click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);
  results.push({ name: '/devices → 첫 카드 토글', ms: Date.now() - t0, ok: true });

  // 7. /publish 약정 전환
  await goto(page, '/publish?contract=common');
  await clickText(page, '선약', '/publish → 선약 (있으면)');

  await browser.close();

  // 8. 리포트
  console.log('\n=== UI Audit ===');
  console.log('시간(ms) | 상태 | 항목');
  console.log('-'.repeat(70));
  for (const r of results) {
    const status = r.ok ? '✓' : '✗';
    const msStr = String(r.ms).padStart(5);
    console.log(`${msStr}  ${status}   ${r.name}${r.note ? '  — ' + r.note : ''}`);
  }
  const totalOk = results.filter((r) => r.ok).length;
  const avg = Math.round(results.filter((r) => r.ok).reduce((s, r) => s + r.ms, 0) / totalOk);
  console.log('-'.repeat(70));
  console.log(`성공 ${totalOk}/${results.length} · 평균 ${avg}ms`);
}

main().catch((e) => { console.error(e); process.exit(1); });
