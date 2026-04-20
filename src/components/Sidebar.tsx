import Link from 'next/link';

const NAV = [
  { href: '/dashboard', label: '대시보드', phase: '' },
  { href: '/uploads', label: '단가표 업로드', phase: 'P2' },
  { href: '/matrix', label: 'Net가 매트릭스', phase: 'P4' },
  { type: 'section', label: '마스터' },
  { href: '/vendors', label: '거래처', phase: '' },
  { href: '/plans', label: '요금제 구간', phase: '' },
  { href: '/devices', label: '모델', phase: '' },
  { href: '/aliases', label: '거래처 코드 매핑', phase: '' },
] as const;

export function Sidebar() {
  return (
    <aside className="flex w-60 flex-col border-r border-zinc-200 bg-white px-4 py-6">
      <Link href="/dashboard" className="mb-6 px-2">
        <div className="text-lg font-bold tracking-tight">대박통신</div>
        <div className="text-xs text-zinc-500">단가 시스템</div>
      </Link>
      <nav className="flex flex-col gap-0.5 text-sm">
        {NAV.map((item, i) =>
          'type' in item && item.type === 'section' ? (
            <div key={i} className="mt-4 px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {item.label}
            </div>
          ) : 'href' in item ? (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between rounded-lg px-3 py-2 transition hover:bg-zinc-100"
            >
              <span>{item.label}</span>
              {item.phase ? (
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                  {item.phase}
                </span>
              ) : null}
            </Link>
          ) : null,
        )}
      </nav>
      <div className="mt-auto pt-4">
        <form method="post" action="/api/logout">
          <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-500 hover:bg-zinc-100">
            로그아웃
          </button>
        </form>
      </div>
    </aside>
  );
}
