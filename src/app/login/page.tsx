import { BrandMark } from '@/components/BrandMark';

type SearchParams = Promise<{ next?: string; error?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { next, error } = await searchParams;
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-zinc-50 p-4">
      <form
        method="post"
        action="/api/login"
        className="w-full max-w-sm space-y-4 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <BrandMark size={44} />
          <div>
            <h1 className="text-xl font-bold tracking-tight">대박통신</h1>
            <p className="text-sm text-zinc-500">단가표 시스템</p>
          </div>
        </div>
        <input type="hidden" name="next" value={next ?? '/'} />
        <input
          type="password"
          name="password"
          required
          autoFocus
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-zinc-900 focus:outline-none"
          placeholder="••••••••"
        />
        {error ? (
          <p className="text-sm text-red-600">비밀번호가 일치하지 않습니다.</p>
        ) : null}
        <button
          type="submit"
          className="w-full rounded-lg bg-zinc-900 py-2 text-white transition hover:bg-zinc-700"
        >
          입장
        </button>
      </form>
    </main>
  );
}
