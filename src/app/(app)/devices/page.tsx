import { getSupabaseAdmin } from '@/lib/supabase';
import { PageHeader, SegmentedLink } from '@/components/ui';
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
    <>
      <PageHeader
        crumbs={['대박통신', '마스터', '모델']}
        title="모델"
        actions={
          <SegmentedLink
            value={mode}
            options={[
              { v: 'curate' as const, label: '판매 설정' },
              { v: 'edit' as const, label: '편집' },
            ]}
            hrefFor={(m) => `/devices?mode=${m}`}
          />
        }
      />

      {mode === 'curate' ? <DeviceCurator devices={devices ?? []} /> : null}
      {mode === 'edit' ? <DeviceEditList devices={devices ?? []} /> : null}
    </>
  );
}
