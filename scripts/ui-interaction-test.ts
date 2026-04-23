/**
 * 인터랙티브 동작 검증: Dialog 팝업, 드래그드롭존, Matrix/Rebates 토글.
 * 실행: npx dotenv -e .env.local -- npx tsx scripts/ui-interaction-test.ts
 */

import { chromium, type Page } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'https://price.dbphone.co.kr';
const PW = process.env.INTERNAL_PASSWORD || 'aaa000111*';
const OUT = '/tmp/price-interactive';

async function login(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type=password]', PW);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

const results: { name: string; ok: boolean; note?: string }[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    results.push({ name, ok: false, note: msg.slice(0, 120) });
    console.log(`  ✗ ${name} — ${msg.slice(0, 80)}`);
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await login(page);

  // 1) Custom Dialog: devices 페이지에서 삭제 버튼 클릭 → 커스텀 Dialog 뜨는지
  console.log('\n[1] Devices 삭제 Dialog');
  await page.goto(`${BASE}/devices?mode=edit`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await test('페이지 로드', async () => {
    await page.locator('text=신규 추가').first().waitFor({ timeout: 5000 });
  });
  await test('삭제 버튼 탐지', async () => {
    const btn = page.locator('button:has-text("삭제")').first();
    await btn.waitFor({ timeout: 5000 });
  });
  await test('삭제 클릭 → Dialog 출현 (role=dialog)', async () => {
    const btn = page.locator('button:has-text("삭제")').first();
    await btn.click();
    await page.locator('[role=dialog]').waitFor({ timeout: 3000 });
    await page.screenshot({ path: `${OUT}/01-delete-dialog.png`, fullPage: false });
  });
  await test('Dialog에 커스텀 "삭제" 버튼 + "취소"', async () => {
    const dialog = page.locator('[role=dialog]');
    await dialog.locator('button:has-text("취소")').waitFor({ timeout: 2000 });
    await dialog.locator('button:has-text("삭제")').waitFor({ timeout: 2000 });
  });
  await test('취소 버튼 → Dialog 닫힘', async () => {
    await page.locator('[role=dialog] button:has-text("취소")').click();
    await page.waitForTimeout(500);
    const count = await page.locator('[role=dialog]').count();
    if (count !== 0) throw new Error(`Dialog 여전히 ${count}개 존재`);
  });

  // 2) 업로드 드래그드롭존
  console.log('\n[2] 업로드 드롭존');
  await page.goto(`${BASE}/uploads`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await test('드롭존 안내 문구 노출', async () => {
    await page.locator('text=/클릭하거나 파일을 끌어다 놓으세요/').waitFor({ timeout: 3000 });
  });
  await test('PNG·JPG·WebP 포맷 안내', async () => {
    await page.locator('text=/PNG.*JPG.*WebP/').waitFor({ timeout: 3000 });
  });
  await page.screenshot({ path: `${OUT}/02-dropzone.png`, fullPage: false });

  // 3) Matrix activation 토글
  console.log('\n[3] Matrix activation 토글');
  await page.goto(`${BASE}/matrix?carrier=SKT&contract=common&act=mnp`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await test('Matrix 기본 MNP', async () => {
    const url = page.url();
    if (!url.includes('act=mnp')) throw new Error(`url=${url}`);
  });
  await test('MNP/010/기변 세그먼트 노출', async () => {
    await page.locator('a:has-text("MNP")').first().waitFor();
    await page.locator('a:has-text("010")').first().waitFor();
    await page.locator('a:has-text("기변")').first().waitFor();
  });
  await test('010 클릭 → ?act=new010', async () => {
    await page.locator('a:has-text("010")').first().click();
    await page.waitForURL((u) => u.searchParams.get('act') === 'new010', { timeout: 5000 });
  });
  await page.screenshot({ path: `${OUT}/03-matrix-010.png`, fullPage: false });

  // 4) Rebates 토글 (client-side state)
  console.log('\n[4] Rebates 토글');
  await page.goto(`${BASE}/rebates?carrier=SKT`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await test('Rebates 상단에 거래처/약정/구분 컨트롤', async () => {
    await page.locator('text=거래처').first().waitFor();
    await page.locator('text=약정').first().waitFor();
    await page.locator('text=구분').first().waitFor();
  });
  await test('공통/선약 토글 존재', async () => {
    await page.locator('button:has-text("공통")').first().waitFor();
    await page.locator('button:has-text("선약")').first().waitFor();
  });
  await page.screenshot({ path: `${OUT}/04-rebates.png`, fullPage: false });

  // 5) 로그인 쿠키 검증 (JWT이므로 쿠키값이 `eyJ`로 시작해야 함)
  console.log('\n[5] JWT 쿠키 형식');
  const cookies = await context.cookies();
  const gate = cookies.find((c) => c.name === 'dbp_price_gate');
  await test('쿠키 존재', async () => {
    if (!gate) throw new Error('dbp_price_gate 쿠키 없음');
  });
  await test('JWT 형식 (eyJ로 시작)', async () => {
    if (!gate?.value.startsWith('eyJ')) throw new Error(`prefix=${gate?.value.slice(0, 10)}`);
  });
  await test('HttpOnly 플래그', async () => {
    if (!gate?.httpOnly) throw new Error('httpOnly=false');
  });

  await browser.close();

  console.log(`\n=== 인터랙션 테스트 ===`);
  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok);
  console.log(`성공 ${ok}/${results.length}`);
  if (fail.length) {
    console.log('실패:');
    for (const f of fail) console.log(`  ✗ ${f.name} — ${f.note}`);
    process.exit(1);
  }
  console.log(`스크린샷: ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
