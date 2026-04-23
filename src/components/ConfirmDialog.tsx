'use client';

import { useEffect, useState } from 'react';

/**
 * 브라우저 `confirm()` 대체 — 커스텀 확인 다이얼로그.
 * 훅 형태로 사용:
 *   const [confirm, dialog] = useConfirmDialog();
 *   ...
 *   if (await confirm({ title: '삭제할까요?' })) { ... }
 *   return <>{dialog}{...}</>;
 */

type Options = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
};

type State = (Options & { resolve: (ok: boolean) => void }) | null;

export function useConfirmDialog(): [(opts: Options) => Promise<boolean>, React.ReactNode] {
  const [state, setState] = useState<State>(null);

  useEffect(() => {
    if (!state) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state]);

  function close(ok: boolean) {
    if (!state) return;
    state.resolve(ok);
    setState(null);
  }

  function confirm(opts: Options) {
    return new Promise<boolean>((resolve) => setState({ ...opts, resolve }));
  }

  const dialog = state ? (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/40 p-4"
      onClick={() => close(false)}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[15px] font-semibold">{state.title}</h3>
        {state.description ? (
          <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-600">{state.description}</p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => close(false)}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            {state.cancelLabel ?? '취소'}
          </button>
          <button
            type="button"
            onClick={() => close(true)}
            className={
              state.tone === 'danger'
                ? 'rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700'
                : 'rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700'
            }
          >
            {state.confirmLabel ?? '확인'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return [confirm, dialog];
}
