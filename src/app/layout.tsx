import type { Metadata } from 'next';
import { Fraunces } from 'next/font/google';
import './globals.css';

const serif = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: '대박통신 · 단가',
  description: '거래처 단가표 수집 · Net가 비교',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`h-full antialiased ${serif.variable}`} style={{ colorScheme: 'light' }}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
