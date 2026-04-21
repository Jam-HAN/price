'use client';

import { useRouter, useSearchParams } from 'next/navigation';

type Tier = { code: string; label: string };

export function PublishControls({
  contract,
  tiers,
  selected,
}: {
  contract: 'common' | 'select';
  tiers: Record<'SKT' | 'KT' | 'LGU+', Tier[]>;
  selected: Record<'SKT' | 'KT' | 'LGU+', string>;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    next.set(key, value);
    router.push(`/publish?${next.toString()}`);
  }

  return (
    <section className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4">
      <label className="flex flex-col text-xs text-zinc-600">
        SKT 요금제
        <select
          value={selected.SKT}
          onChange={(e) => update('tierSKT', e.target.value)}
          className="mt-1 w-60 rounded border border-zinc-300 px-2 py-1.5 text-sm"
        >
          {tiers.SKT.map((t) => (
            <option key={t.code} value={t.code}>
              {t.code} · {t.label.slice(0, 30)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-xs text-zinc-600">
        KT 요금제
        <select
          value={selected.KT}
          onChange={(e) => update('tierKT', e.target.value)}
          className="mt-1 w-60 rounded border border-zinc-300 px-2 py-1.5 text-sm"
        >
          {tiers.KT.map((t) => (
            <option key={t.code} value={t.code}>
              {t.code} · {t.label.slice(0, 30)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-xs text-zinc-600">
        LGU+ 요금제
        <select
          value={selected['LGU+']}
          onChange={(e) => update('tierLGU', e.target.value)}
          className="mt-1 w-60 rounded border border-zinc-300 px-2 py-1.5 text-sm"
        >
          {tiers['LGU+'].map((t) => (
            <option key={t.code} value={t.code}>
              {t.code} · {t.label.slice(0, 30)}
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
          <option value="common">공통지원금</option>
          <option value="select">선약</option>
        </select>
      </label>
    </section>
  );
}
