import { Sidebar } from '@/components/Sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1208px] px-4 py-4 pb-20 lg:px-7 lg:py-[22px]">
          {children}
        </div>
      </main>
    </div>
  );
}
