import { getSupabaseAdmin } from '@/lib/supabase';
import { compareDevicesForList } from '@/lib/fmt';
import { MarginManager } from './MarginManager';

export const dynamic = 'force-dynamic';

export default async function MarginsPage() {
  const sb = getSupabaseAdmin();
  const [{ data: margins }, { data: devices }] = await Promise.all([
    sb.from('price_device_margins').select('id, scope_type, device_id, series, margin_krw, updated_at').order('scope_type').order('updated_at', { ascending: false }),
    sb.from('price_devices').select('id, model_code, nickname, manufacturer, storage, retail_price_krw, series').eq('active', true),
  ]);

  // 시리즈 목록 (중복 제거)
  const seriesSet = new Set<string>();
  for (const d of devices ?? []) if (d.series) seriesSet.add(d.series);
  const seriesList = Array.from(seriesSet).sort();

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">마진</h1>
      </header>

      <MarginManager
        margins={margins ?? []}
        devices={[...(devices ?? [])].sort(compareDevicesForList)}
        seriesList={seriesList}
      />
    </div>
  );
}
