'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { CARRIERS, type Carrier } from '@/lib/fmt';

type Tier = { code: string; label: string; monthly_fee_krw: number | null };

export function MatrixControls({
  carrier,
  tier,
  contract,
  activation,
  tiers,
}: {
  carrier: Carrier;
  tier: string;
  contract: 'common' | 'select';
  activation: 'new010' | 'mnp' | 'change';
  tiers: Tier[];
}) {
  const router = useRouter();
  const sp = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    next.set(key, value);
    if (key === 'carrier') next.delete('tier');
    router.push(`/matrix?${next.toString()}`);
  }

  return (
    <section className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4">
      <label className="flex flex-col text-xs text-zinc-600">
        통신사
        <select
          value={carrier}
          onChange={(e) => update('carrier', e.target.value)}
          className="mt-1 w-28 rounded border border-zinc-300 px-2 py-1.5 text-sm"
        >
          {CARRIERS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-xs text-zinc-600">
        요금제 구간
        <select
          value={tier}
          onChange={(e) => update('tier', e.target.value)}
          className="mt-1 min-w-[20rem] rounded border border-zinc-300 px-2 py-1.5 text-sm"
        >
          {tiers.map((t) => (
            <option key={t.code} value={t.code}>
              {t.code} · {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-xs text-zinc-600">
        약정
        <select
          value={contract}
          onChange={(e) => update('contract', e.target.value)}
          className="mt-1 w-28 rounded border border-zinc-300 px-2 py-1.5 text-sm"
        >
          <option value="common">공통(공시)</option>
          <option value="select">선약</option>
        </select>
      </label>
      <label className="flex flex-col text-xs text-zinc-600">
        개통
        <select
          value={activation}
          onChange={(e) => update('activation', e.target.value)}
          className="mt-1 w-32 rounded border border-zinc-300 px-2 py-1.5 text-sm"
        >
          <option value="new010">010 신규</option>
          <option value="mnp">MNP</option>
          <option value="change">기변/재가입</option>
        </select>
      </label>
    </section>
  );
}
