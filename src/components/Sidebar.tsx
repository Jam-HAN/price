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
    <aside
      className="flex w-56 flex-col border-r px-3 py-5"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <Link href="/dashboard" className="mb-6 px-2.5 py-1">
        <div className="text-[15px] font-semibold tracking-tight">대박통신</div>
        <div className="mt-0.5 text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
          단가 시스템
        </div>
      </Link>

      <nav className="flex flex-col gap-px text-[13px]">
        {NAV.map((item, i) =>
          'type' in item && item.type === 'section' ? (
            <div
              key={i}
              className="mt-4 px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: 'var(--fg-dim)' }}
            >
              {item.label}
            </div>
          ) : 'href' in item ? (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-2.5 py-[5px] font-medium transition hover:bg-[color:var(--surface-hover)]"
              style={{ color: 'var(--fg-muted)' }}
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
            className="w-full rounded-md px-2.5 py-[5px] text-left text-[13px] transition hover:bg-[color:var(--surface-hover)]"
            style={{ color: 'var(--fg-subtle)' }}
          >
            로그아웃
          </button>
        </form>
      </div>
    </aside>
  );
}
