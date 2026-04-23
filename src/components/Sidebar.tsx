'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BrandMark } from './BrandMark';

type NavItem =
  | { type: 'section'; label: string }
  | { href: string; label: string; badge?: string };

const NAV: NavItem[] = [
  { href: '/dashboard', label: '홈' },
  { href: '/uploads', label: '업로드', badge: 'STEP' },
  { type: 'section', label: '가격' },
  { href: '/subsidies', label: '공통지원금' },
  { href: '/rebates', label: '리베이트' },
  { href: '/matrix', label: 'Net가' },
  { href: '/margins', label: '마진' },
  { href: '/publish', label: '고객용' },
  { type: 'section', label: '마스터' },
  { href: '/devices', label: '모델' },
  { href: '/vendors', label: '거래처' },
  { href: '/plans', label: '요금제' },
  { href: '/aliases', label: '코드 매핑' },
];

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // 경로 이동 시 모바일 drawer 자동 닫기
  useEffect(() => { setOpen(false); }, [pathname]);

  // drawer 열려있을 때 body 스크롤 잠금
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  return (
    <>
      {/* 모바일 상단바 (lg 미만에서만) */}
      <header
        className="sticky top-0 z-30 flex h-14 items-center justify-between px-4 lg:hidden"
        style={{ background: 'var(--ink)', color: '#e6e9f2' }}
      >
        <Link href="/dashboard" className="flex items-center gap-2">
          <BrandMark size={28} />
          <span className="text-[13px] font-extrabold tracking-tight text-white">대박통신</span>
        </Link>
        <button
          type="button"
          aria-label="메뉴 열기"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="-mr-2 grid h-10 w-10 place-items-center rounded-lg text-white"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        </button>
      </header>

      {/* 모바일 backdrop */}
      {open ? (
        <button
          type="button"
          aria-label="메뉴 닫기"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      ) : null}

      <aside
        className={[
          'flex flex-col px-4 py-5',
          // 모바일: 화면 밖에 대기하다가 open 시 슬라이드인
          'fixed inset-y-0 left-0 z-50 w-[260px] transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full',
          // lg 이상: 기존처럼 sticky 상단
          'lg:sticky lg:top-0 lg:h-screen lg:w-[232px] lg:translate-x-0',
        ].join(' ')}
        style={{ background: 'var(--ink)', color: '#e6e9f2' }}
      >
        {/* 브랜드 */}
        <div className="mb-5 flex items-center justify-between pr-1">
          <Link href="/dashboard" className="flex items-center gap-2.5 px-2 pt-1">
            <BrandMark size={32} />
            <div>
              <div className="text-[14px] font-extrabold tracking-tight text-white">대박통신</div>
              <div className="mt-0.5 text-[11px]" style={{ color: '#8a93ad' }}>
                단가표 시스템
              </div>
            </div>
          </Link>
          <button
            type="button"
            aria-label="메뉴 닫기"
            onClick={() => setOpen(false)}
            className="mt-1 grid h-8 w-8 place-items-center rounded-lg text-white/70 lg:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        {/* 네비 */}
        <nav className="flex flex-col gap-0.5 text-[14px]">
          {NAV.map((item, i) =>
            'type' in item ? (
              <div
                key={i}
                className="px-2.5 pb-1.5 pt-3.5 text-[11px] font-semibold uppercase tracking-[0.1em]"
                style={{ color: '#6b7391' }}
              >
                {item.label}
              </div>
            ) : (
              <Link key={item.href} href={item.href} className="nav-item">
                <span className="flex-1">{item.label}</span>
                {item.badge ? (
                  <span
                    className="rounded-full px-1.5 py-[2px] text-[10px] font-bold"
                    style={{ background: 'var(--lime)', color: 'var(--ink)' }}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            ),
          )}
        </nav>

        {/* 하단 */}
        <div
          className="mt-auto border-t pt-3.5"
          style={{ borderColor: '#1b2142' }}
        >
          <div className="mb-3 flex items-center gap-2.5 rounded-[10px] p-1.5">
            <div
              className="grid h-8 w-8 place-items-center rounded-full font-extrabold"
              style={{ background: 'linear-gradient(135deg, #ff5fae, #ffd84a)', color: 'var(--ink)' }}
            >
              J
            </div>
            <div className="leading-tight">
              <div className="text-[13px] font-semibold text-white">대박통신 관리자</div>
              <div className="mt-0.5 text-[11px]" style={{ color: '#8a93ad' }}>
                admin@dbphone
              </div>
            </div>
          </div>
          <form method="post" action="/api/logout">
            <button
              type="submit"
              className="w-full rounded-[9px] px-2.5 py-[7px] text-left text-[13px] transition"
              style={{ color: '#8a93ad' }}
            >
              로그아웃
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
