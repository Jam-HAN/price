/**
 * 모바일 뷰포트(iPhone 13)로 각 페이지 순회하며 스크린샷 저장.
 * usage: PORT=3001 PASSWORD=... node scripts/mobile-audit.mjs [out-dir]
 */
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const PORT = process.env.PORT || '3001';
const PASSWORD = process.env.PASSWORD || 'aaa000111*';
const BASE = `http://localhost:${PORT}`;
const OUT = process.argv[2] || '/tmp/price-mobile-audit';
mkdirSync(OUT, { recursive: true });

const PAGES = [
  { path: '/dashboard',  name: '01-dashboard' },
  { path: '/uploads',    name: '02-uploads' },
  { path: '/subsidies',  name: '03-subsidies' },
  { path: '/rebates',    name: '04-rebates' },
  { path: '/matrix',     name: '05-matrix' },
  { path: '/margins',    name: '06-margins' },
  { path: '/publish',    name: '07-publish' },
  { path: '/devices',    name: '08-devices' },
  { path: '/vendors',    name: '09-vendors' },
  { path: '/plans',      name: '10-plans' },
  { path: '/aliases',    name: '11-aliases' },
];

const iphone = devices['iPhone 13'];

const browser = await chromium.launch();
const context = await browser.newContext({
  ...iphone,
  // 게이트 통과
  storageState: {
    cookies: [{
      name: 'dbp_price_gate',
      value: PASSWORD,
      domain: 'localhost',
      path: '/',
      expires: Math.floor(Date.now() / 1000) + 3600,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    }],
    origins: [],
  },
});

const report = [];

for (const p of PAGES) {
  const page = await context.newPage();
  const url = `${BASE}${p.path}`;
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`); });

  try {
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);
    const file = path.join(OUT, `${p.name}.png`);
    await page.screenshot({ path: file, fullPage: true });

    // 수평 스크롤(오버플로) 검사
    const overflow = await page.evaluate(() => {
      const docW = document.documentElement.scrollWidth;
      const viewW = window.innerWidth;
      const offenders = [];
      if (docW > viewW) {
        for (const el of document.querySelectorAll('*')) {
          const r = el.getBoundingClientRect();
          if (r.right > viewW + 4) {
            offenders.push({
              tag: el.tagName.toLowerCase(),
              cls: el.className?.toString().slice(0, 80) || '',
              right: Math.round(r.right),
              text: (el.textContent || '').trim().slice(0, 30),
            });
            if (offenders.length > 5) break;
          }
        }
      }
      return { docW, viewW, overflow: docW > viewW, offenders };
    });

    // 작은 터치 타겟 검사(< 44px)
    const tinyTargets = await page.evaluate(() => {
      const tiny = [];
      for (const el of document.querySelectorAll('button, a, [role=button]')) {
        const r = el.getBoundingClientRect();
        if (r.width && r.height && (r.width < 32 || r.height < 32)) {
          tiny.push({
            tag: el.tagName.toLowerCase(),
            w: Math.round(r.width),
            h: Math.round(r.height),
            text: (el.textContent || '').trim().slice(0, 20),
          });
          if (tiny.length > 5) break;
        }
      }
      return tiny;
    });

    report.push({
      page: p.path,
      status: resp?.status() ?? 0,
      screenshot: file,
      overflow,
      tinyTargets,
      errors,
    });
    console.log(`✓ ${p.path} · status=${resp?.status()} · overflow=${overflow.overflow} · tiny=${tinyTargets.length} · errors=${errors.length}`);
  } catch (e) {
    report.push({ page: p.path, error: String(e) });
    console.log(`✗ ${p.path} · ${String(e).slice(0, 100)}`);
  }
  await page.close();
}

await browser.close();

import { writeFileSync } from 'node:fs';
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(`\n리포트: ${path.join(OUT, 'report.json')}`);
