'use client';

import { useState, useTransition } from 'react';
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

export function DeviceCurator({ devices }: { devices: Device[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(true);

  const activeCount = devices.filter((d) => d.active).length;

  const grouped = GROUPS.map((g) => ({
    ...g,
    items: devices
      .filter((d) => g.series.includes(d.series))
      .filter((d) => (showInactive ? true : d.active))
      .filter((d) => {
        if (!query) return true;
        const q = query.toLowerCase();
        return d.nickname.toLowerCase().includes(q) || d.model_code.toLowerCase().includes(q);
      })
      .sort((a, b) => a.display_order - b.display_order),
  })).filter((g) => g.items.length > 0);

  function toggle(id: string, next: boolean) {
    start(async () => {
      await toggleDeviceActive({ id, active: next });
      router.refresh();
    });
  }

  function applyPreset(seriesKeys: string[]) {
    const targetSeriesList = GROUPS
      .filter((g) => seriesKeys.includes(g.key))
      .flatMap((g) => g.series);
    const activateIds = devices.filter((d) => targetSeriesList.includes(d.series)).map((d) => d.id);
    const deactivateIds = devices.filter((d) => !targetSeriesList.includes(d.series)).map((d) => d.id);
    start(async () => {
      await bulkSetActive({ ids: activateIds, active: true });
      await bulkSetActive({ ids: deactivateIds, active: false });
      router.refresh();
    });
  }

  function applyAll(active: boolean) {
    start(async () => {
      await bulkSetActive({ ids: devices.map((d) => d.id), active });
      router.refresh();
    });
  }

  function toggleGroup(series: (string | null)[]) {
    const items = devices.filter((d) => series.includes(d.series));
    const allActive = items.every((d) => d.active);
    start(async () => {
      await bulkSetActive({ ids: items.map((d) => d.id), active: !allActive });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* 간단 헤더 */}
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">
          판매 중 <span className="text-2xl text-emerald-600">{activeCount}</span>
          <span className="text-sm text-zinc-400"> / {devices.length}</span>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="검색"
          className="w-56 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-zinc-400"
        />
      </div>

      {/* 프리셋 */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            disabled={pending}
            onClick={() => applyPreset(p.seriesKeys)}
            className="rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50"
          >
            {p.label}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <button
            disabled={pending}
            onClick={() => applyAll(true)}
            className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
          >
            전체 ON
          </button>
          <button
            disabled={pending}
            onClick={() => applyAll(false)}
            className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
          >
            전체 OFF
          </button>
          <label className="flex items-center gap-1.5 text-xs text-zinc-500">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            비활성 표시
          </label>
        </div>
      </div>

      {/* 시리즈별 카드 그리드 */}
      {grouped.map((g) => {
        const activeInGroup = g.items.filter((i) => i.active).length;
        const allActive = activeInGroup === g.items.length;
        return (
          <section key={g.key} className="space-y-2">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-zinc-900">{g.label}</h2>
              <span className="text-xs text-zinc-400">{activeInGroup}/{g.items.length}</span>
              <button
                disabled={pending}
                onClick={() => toggleGroup(g.series)}
                className="ml-auto text-xs text-zinc-500 hover:text-zinc-900 disabled:opacity-50"
              >
                {allActive ? '전부 끄기' : '전부 켜기'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {g.items.map((d) => (
                <DeviceCard
                  key={d.id}
                  device={d}
                  pending={pending}
                  onToggle={() => toggle(d.id, !d.active)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function DeviceCard({ device, pending, onToggle }: {
  device: Device;
  pending: boolean;
  onToggle: () => void;
}) {
  const { nickname, model_code, retail_price_krw, active } = device;
  const base = active
    ? 'border-zinc-900 bg-zinc-900 text-white'
    : 'border-zinc-200 bg-white text-zinc-400 hover:border-zinc-400';
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onToggle}
      className={`relative rounded-xl border-2 px-3 py-2.5 text-left transition disabled:opacity-50 ${base}`}
    >
      <div className={`text-sm font-medium leading-tight ${active ? '' : 'text-zinc-600'}`}>
        {nickname}
      </div>
      <div className={`mt-1 text-[11px] font-mono ${active ? 'text-zinc-300' : 'text-zinc-400'}`}>
        {model_code}
      </div>
      <div className={`mt-1 text-sm font-mono ${active ? 'text-white' : 'text-zinc-500'}`}>
        {formatMan(retail_price_krw)}만
      </div>
      {active ? (
        <div className="absolute right-2 top-2 text-xs">✓</div>
      ) : null}
    </button>
  );
}
