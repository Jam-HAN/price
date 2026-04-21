'use client';

import { useState, useTransition, useOptimistic, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { formatMan } from '@/lib/fmt';
import { toggleDeviceActive, bulkSetActive } from './actions';

type Device = {
  id: string;
  model_code: string;
  nickname: string;
  manufacturer: string | null;
  series: string | null;
  storage: string | null;
  retail_price_krw: number;
  category: string;
  display_order: number;
  active: boolean;
};

const GROUPS: { key: string; label: string; series: (string | null)[] }[] = [
  { key: 'S26',       label: 'Galaxy S26',   series: ['galaxyS26'] },
  { key: 'Z7',        label: 'Z 폴드7·플립7', series: ['fold7', 'flip7'] },
  { key: 'S25',       label: 'Galaxy S25',   series: ['galaxyS25'] },
  { key: 'Z6',        label: 'Z 폴드6·플립6', series: ['fold6', 'flip6'] },
  { key: 'A',         label: 'Galaxy A·M',   series: ['galaxyEtc'] },
  { key: 'iPhone17',  label: 'iPhone 17',    series: ['iphone17'] },
  { key: 'iPhoneAir', label: 'iPhone Air',   series: ['iphoneAir'] },
  { key: 'iPhone16',  label: 'iPhone 16',    series: ['iphone16'] },
  { key: 'iPhone15',  label: 'iPhone 15',    series: ['iphone15'] },
  { key: 'Tab',       label: '태블릿',       series: ['tablet'] },
  { key: 'Watch',     label: '워치·링',      series: ['wearable'] },
  { key: 'Misc',      label: '기타',         series: ['misc', null] },
];

const PRESETS: { label: string; seriesKeys: string[] }[] = [
  { label: 'Samsung 주력',  seriesKeys: ['S26', 'Z7', 'S25'] },
  { label: 'Apple 최신',    seriesKeys: ['iPhone17', 'iPhoneAir'] },
  { label: 'Samsung 전체',  seriesKeys: ['S26', 'Z7', 'S25', 'Z6', 'A'] },
  { label: 'Apple 전체',    seriesKeys: ['iPhone17', 'iPhoneAir', 'iPhone16', 'iPhone15'] },
];

export function DeviceCurator({ devices: initialDevices }: { devices: Device[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(true);

  const [optimisticDevices, applyOptimistic] = useOptimistic(
    initialDevices,
    (current: Device[], update: { ids: Set<string>; active: boolean }) =>
      current.map((d) => (update.ids.has(d.id) ? { ...d, active: update.active } : d)),
  );

  const activeCount = optimisticDevices.filter((d) => d.active).length;

  const grouped = useMemo(() => GROUPS.map((g) => ({
    ...g,
    items: optimisticDevices
      .filter((d) => g.series.includes(d.series))
      .filter((d) => (showInactive ? true : d.active))
      .filter((d) => {
        if (!query) return true;
        const q = query.toLowerCase();
        return d.nickname.toLowerCase().includes(q) || d.model_code.toLowerCase().includes(q);
      })
      .sort((a, b) => a.display_order - b.display_order),
  })).filter((g) => g.items.length > 0), [optimisticDevices, showInactive, query]);

  function toggle(id: string, next: boolean) {
    start(async () => {
      applyOptimistic({ ids: new Set([id]), active: next });
      try { await toggleDeviceActive({ id, active: next }); }
      catch { router.refresh(); }
    });
  }

  function applyBulk(ids: string[], active: boolean) {
    if (ids.length === 0) return;
    start(async () => {
      applyOptimistic({ ids: new Set(ids), active });
      try { await bulkSetActive({ ids, active }); }
      catch { router.refresh(); }
    });
  }

  function applyPreset(seriesKeys: string[]) {
    const targetSeriesList = GROUPS
      .filter((g) => seriesKeys.includes(g.key))
      .flatMap((g) => g.series);
    start(async () => {
      const activateIds = optimisticDevices.filter((d) => targetSeriesList.includes(d.series)).map((d) => d.id);
      const deactivateIds = optimisticDevices.filter((d) => !targetSeriesList.includes(d.series)).map((d) => d.id);
      applyOptimistic({ ids: new Set(activateIds), active: true });
      applyOptimistic({ ids: new Set(deactivateIds), active: false });
      try {
        await Promise.all([
          bulkSetActive({ ids: activateIds, active: true }),
          bulkSetActive({ ids: deactivateIds, active: false }),
        ]);
      } catch { router.refresh(); }
    });
  }

  function applyAll(active: boolean) {
    applyBulk(optimisticDevices.map((d) => d.id), active);
  }

  function toggleGroup(series: (string | null)[]) {
    const items = optimisticDevices.filter((d) => series.includes(d.series));
    const allActive = items.every((d) => d.active);
    applyBulk(items.map((d) => d.id), !allActive);
  }

  return (
    <div className="space-y-4">
      {/* 상단 바: 카운트 + 검색 + 전역 토글 */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3">
        <div className="text-sm">
          판매 중 <span className="text-xl font-bold text-emerald-600">{activeCount}</span>
          <span className="ml-1 text-zinc-400">/ {optimisticDevices.length}</span>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="검색"
          className="ml-auto w-52 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm outline-none focus:border-zinc-400"
        />
        <button onClick={() => applyAll(true)}
          className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-100">
          전체 ON
        </button>
        <button onClick={() => applyAll(false)}
          className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-50">
          전체 OFF
        </button>
        <label className="flex items-center gap-1 text-xs text-zinc-500">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          비활성 표시
        </label>
      </div>

      {/* 프리셋 */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button key={p.label} onClick={() => applyPreset(p.seriesKeys)}
            className="rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm hover:bg-zinc-50">
            {p.label}
          </button>
        ))}
      </div>

      {/* 시리즈별 리스트 */}
      {grouped.map((g) => {
        const activeInGroup = g.items.filter((i) => i.active).length;
        const allActive = activeInGroup === g.items.length;
        return (
          <section key={g.key} className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
            <div className="flex items-center gap-3 border-b border-zinc-100 bg-zinc-50 px-4 py-2">
              <h2 className="text-sm font-semibold">{g.label}</h2>
              <span className="text-xs text-zinc-400">{activeInGroup}/{g.items.length}</span>
              <button onClick={() => toggleGroup(g.series)}
                className="ml-auto text-xs text-zinc-500 hover:text-zinc-900">
                {allActive ? '전부 끄기' : '전부 켜기'}
              </button>
            </div>
            <ul className="divide-y divide-zinc-100">
              {g.items.map((d) => (
                <DeviceRow key={d.id} device={d} onToggle={() => toggle(d.id, !d.active)} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function DeviceRow({ device, onToggle }: { device: Device; onToggle: () => void }) {
  const { nickname, model_code, retail_price_krw, storage, active } = device;
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition hover:bg-zinc-50 ${active ? '' : 'opacity-40'}`}
      >
        <input
          type="checkbox"
          checked={active}
          readOnly
          className="h-4 w-4 accent-emerald-600"
        />
        <span className="flex-1 font-medium">{nickname}</span>
        <span className="w-40 font-mono text-[11px] text-zinc-400">{model_code}</span>
        <span className="w-14 text-xs text-zinc-500">{storage ?? ''}</span>
        <span className="w-16 text-right font-mono text-xs text-zinc-600">{formatMan(retail_price_krw)}만</span>
      </button>
    </li>
  );
}
