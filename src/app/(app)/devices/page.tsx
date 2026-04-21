import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase';
import { DeviceCurator } from './DeviceCurator';
import { DeviceEditList } from './DeviceEditList';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ mode?: 'curate' | 'edit' }>;

export default async function DevicesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const mode = sp.mode ?? 'curate';
  const sb = getSupabaseAdmin();
  const { data: devices } = await sb
    .from('price_devices')
    .select('*')
    .order('display_order')
    .order('nickname');

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between">
        <h1 className="page-title">모델</h1>
        <div className="flex items-center gap-1 rounded-full border border-zinc-200 bg-white p-1 text-xs">
          <Link
            href="/devices?mode=curate"
            className={`rounded-full px-3 py-1 ${mode === 'curate' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-50'}`}
          >
            판매 설정
          </Link>
          <Link
            href="/devices?mode=edit"
            className={`rounded-full px-3 py-1 ${mode === 'edit' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-50'}`}
          >
            편집
          </Link>
        </div>
      </header>

      {mode === 'curate' ? (
        <DeviceCurator devices={devices ?? []} />
      ) : null}

      {mode === 'edit' ? (
        <DeviceEditList devices={devices ?? []} />
      ) : null}
    </div>
  );
}
