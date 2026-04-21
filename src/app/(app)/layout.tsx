import { Sidebar } from '@/components/Sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-x-auto">
        <div className="mx-auto max-w-[1400px] px-10 py-8">{children}</div>
      </main>
    </div>
  );
}
