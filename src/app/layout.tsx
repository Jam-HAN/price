import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '대박통신 · 단가',
  description: '거래처 단가표 수집 · Net가 비교',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full antialiased" style={{ colorScheme: 'light' }}>
      <body className="min-h-full bg-zinc-50 text-zinc-900">{children}</body>
    </html>
  );
}
