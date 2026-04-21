import { Sidebar } from '@/components/Sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-x-auto">
        <div className="mx-auto max-w-[1208px] px-7 py-[22px] pb-20">{children}</div>
      </main>
    </div>
  );
}
