'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ReparseButton({
  sheetId,
  modelCodes,
  label,
}: {
  sheetId: string;
  modelCodes?: string[];
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/uploads/${sheetId}/reparse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_codes: modelCodes ?? [] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={run}
        disabled={busy}
        className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? '재파싱 중 (Opus)…' : label}
      </button>
      {error ? <div className="mt-1 text-[11px] text-red-600">{error}</div> : null}
    </>
  );
}
