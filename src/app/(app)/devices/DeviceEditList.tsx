'use client';

import { useState, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { formatMan } from '@/lib/fmt';
import { useConfirmDialog } from '@/components/ConfirmDialog';
import { createDevice, updateDevice, deleteDevice } from './actions';

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
  is_new: boolean;
  active: boolean;
};

export function DeviceEditList({ devices }: { devices: Device[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Device | null>(null);
  const [, start] = useTransition();
  const [confirm, dialog] = useConfirmDialog();

  async function onDelete(d: Device) {
    const ok = await confirm({
      title: `${d.nickname} 삭제할까요?`,
      description: `${d.model_code} 모델이 삭제됩니다. 관련 단가표 데이터가 있으면 삭제가 실패할 수 있습니다.`,
      confirmLabel: '삭제',
      tone: 'danger',
    });
    if (!ok) return;
    const fd = new FormData();
    fd.set('id', d.id);
    start(async () => {
      await deleteDevice(fd);
      router.refresh();
    });
  }

  return (
    <>
      {dialog}
      {/* 신규 추가 */}
      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">신규 추가</div>
        <CreateForm />
      </section>

      {/* 리스트 */}
      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="grid grid-cols-[11rem_minmax(0,1fr)_4rem_6rem_9rem] items-center gap-4 border-b border-zinc-200 bg-zinc-50 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          <div>코드</div>
          <div>펫네임</div>
          <div>용량</div>
          <div className="text-right">출고가</div>
          <div className="text-right">액션</div>
        </div>
        {devices.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-zinc-400">등록된 모델이 없습니다.</div>
        ) : null}
        {devices.map((d) => (
          <div
            key={d.id}
            className="grid grid-cols-[11rem_minmax(0,1fr)_4rem_6rem_9rem] items-center gap-4 border-t border-zinc-100 px-4 py-2.5 text-sm hover:bg-zinc-50"
          >
            <div className="font-mono text-xs text-zinc-500">{d.model_code}</div>
            <div>{d.nickname}</div>
            <div className="text-xs text-zinc-500">{d.storage ?? '—'}</div>
            <div className="text-right font-mono text-sm">{formatMan(d.retail_price_krw)}만</div>
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setEditing(d)}
                className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200"
              >
                수정
              </button>
              <button
                type="button"
                onClick={() => onDelete(d)}
                className="rounded-md bg-red-50 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
              >
                삭제
              </button>
            </div>
          </div>
        ))}
      </section>

      {editing ? <EditModal device={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function CreateForm() {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={formRef}
      action={async (fd: FormData) => {
        await createDevice(fd);
        formRef.current?.reset();
      }}
      className="grid grid-cols-[11rem_minmax(0,1fr)_4rem_6rem_auto] items-end gap-3"
    >
      <Field label="코드" name="model_code" placeholder="SM-S942N_256G" mono required />
      <Field label="펫네임" name="nickname" placeholder="갤럭시 S26 256G" required />
      <Field label="용량" name="storage" placeholder="256G" />
      <Field label="출고가 (원)" name="retail_price_krw" type="number" required align="right" />
      <input type="hidden" name="active" value="on" />
      <button className="h-[34px] rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-700">
        추가
      </button>
    </form>
  );
}

function EditModal({ device, onClose }: { device: Device; onClose: () => void }) {
  const router = useRouter();
  const [, start] = useTransition();

  async function onSubmit(fd: FormData) {
    start(async () => {
      await updateDevice(fd);
      onClose();
      router.refresh();
    });
  }

  return (
    <div
      role="dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/30 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">모델 수정</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </div>
        <form action={onSubmit} className="space-y-3">
          <input type="hidden" name="id" value={device.id} />
          {/* hidden: 삭제하지 말아야 할 레거시 값 보존 */}
          <input type="hidden" name="manufacturer" defaultValue={device.manufacturer ?? ''} />
          <input type="hidden" name="series" defaultValue={device.series ?? ''} />
          <input type="hidden" name="category" defaultValue={device.category ?? '5G'} />
          <input type="hidden" name="display_order" defaultValue={device.display_order ?? 0} />
          <input type="hidden" name="is_new" defaultValue={device.is_new ? 'on' : ''} />
          <input type="hidden" name="active" defaultValue={device.active ? 'on' : ''} />

          <Field label="코드" name="model_code" defaultValue={device.model_code} mono required />
          <Field label="펫네임" name="nickname" defaultValue={device.nickname} required />
          <div className="grid grid-cols-2 gap-3">
            <Field label="용량" name="storage" defaultValue={device.storage ?? ''} />
            <Field label="출고가 (원)" name="retail_price_krw" type="number" defaultValue={String(device.retail_price_krw)} align="right" required />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
              취소
            </button>
            <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
              저장
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label, name, defaultValue, placeholder, type = 'text', required, mono, align,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  mono?: boolean;
  align?: 'right';
}) {
  return (
    <label className="flex flex-col text-[11px] text-zinc-500">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className={`mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 ${mono ? 'font-mono' : ''} ${align === 'right' ? 'text-right' : ''}`}
      />
    </label>
  );
}
