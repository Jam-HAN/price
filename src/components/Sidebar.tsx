import Link from 'next/link';

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
  return (
    <aside
      className="sticky top-0 flex h-screen w-[232px] flex-col px-4 py-5"
      style={{ background: 'var(--ink)', color: '#e6e9f2' }}
    >
      {/* 브랜드 */}
      <Link href="/dashboard" className="mb-5 flex items-center gap-2.5 px-2 pt-1">
        <div
          className="grid h-8 w-8 place-items-center rounded-[9px] text-[16px] font-extrabold text-white"
          style={{ background: 'linear-gradient(135deg, #2152ff, #7a9bff 60%, #d4ff3f)' }}
        >
          대
        </div>
        <div>
          <div className="text-[14px] font-extrabold tracking-tight text-white">대박통신</div>
          <div className="mt-0.5 text-[11px]" style={{ color: '#8a93ad' }}>
            단가 시스템
          </div>
        </div>
      </Link>

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
  );
}
