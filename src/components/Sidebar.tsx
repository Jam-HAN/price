import Link from 'next/link';

const NAV = [
  { href: '/dashboard', label: '홈' },
  { href: '/uploads', label: '업로드' },
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
] as const;

export function Sidebar() {
  return (
    <aside className="flex w-60 flex-col border-r bg-white/60 px-4 py-6" style={{ borderColor: 'var(--border)' }}>
      <Link href="/dashboard" className="mb-7 px-2">
        <div className="serif text-2xl font-semibold tracking-tight">대박통신</div>
        <div className="mt-0.5 text-xs" style={{ color: 'var(--fg-muted)' }}>단가 시스템</div>
      </Link>
      <nav className="flex flex-col gap-0.5 text-sm">
        {NAV.map((item, i) =>
          'type' in item && item.type === 'section' ? (
            <div
              key={i}
              className="mt-5 px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.1em]"
              style={{ color: 'var(--fg-subtle)' }}
            >
              {item.label}
            </div>
          ) : 'href' in item ? (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-1.5 transition hover:bg-[color:var(--surface-subtle)]"
              style={{ color: 'var(--fg)' }}
            >
              {item.label}
            </Link>
          ) : null,
        )}
      </nav>
      <div className="mt-auto pt-4">
        <form method="post" action="/api/logout">
          <button
            type="submit"
            className="w-full rounded-lg px-3 py-1.5 text-left text-sm transition hover:bg-[color:var(--surface-subtle)]"
            style={{ color: 'var(--fg-muted)' }}
          >
            로그아웃
          </button>
        </form>
      </div>
    </aside>
  );
}
