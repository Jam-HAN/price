'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { SheetExtraction } from '@/lib/vision-schema';
import type { CellFlag, CellField } from '@/lib/consistency';
import { formatMan, compareDevicesForList } from '@/lib/fmt';
import { updateCellAction } from './cell-actions';

type FlagMap = Record<string, CellFlag>; // key = model_code_raw|tier|field

export function EditableModelsTable({
  sheetId,
  raw,
  flagMap,
}: {
  sheetId: string;
  raw: SheetExtraction;
  flagMap: FlagMap;
}) {
  const tierCodes = Array.from(
    new Set((raw.models ?? []).flatMap((m) => (m.tiers ?? []).map((t) => t.plan_tier_code))),
  );
  // raw_ocr_json.models를 comparator 시그니처에 맞게 매핑 (model_code는 code_raw 사용)
  const sortedModels = [...(raw.models ?? [])]
    .map((m) => ({ ...m, model_code: m.model_code_raw }))
    .sort(compareDevicesForList);

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-4 py-2">
        <h2 className="text-sm font-semibold">
          파싱된 모델 × 구간 <span className="text-xs font-normal text-zinc-500">(셀 클릭 → 편집, 단위: 만원)</span>
        </h2>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-red-500" /> 즉시수정 필요</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-amber-400" /> 검토 권장</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <th className="sticky left-0 z-10 bg-zinc-50 px-2 py-2 text-left">모델</th>
              <th className="px-2 py-2 text-right">출고가</th>
              {tierCodes.map((code) => (
                <th key={code} colSpan={7} className="border-l border-zinc-200 px-2 py-2 text-center">
                  {code}
                </th>
              ))}
            </tr>
            <tr>
              <th className="sticky left-0 z-10 bg-zinc-50 px-2 py-1" />
              <th className="px-2 py-1" />
              {tierCodes.map((code) => (
                <ThTypeHeader key={code} />
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedModels.map((m) => (
              <tr key={m.model_code_raw} className="border-t border-zinc-100">
                <td className="sticky left-0 z-10 bg-white px-2 py-1.5 font-medium">
                  <div>{m.nickname}</div>
                  <div className="font-mono text-[10px] text-zinc-400">{m.model_code_raw}</div>
                </td>
                <EditCell
                  sheetId={sheetId}
                  modelCode={m.model_code_raw}
                  tierCode={null}
                  field="retail_price_krw"
                  value={m.retail_price_krw ?? null}
                  flag={flagMap[cellKey(m.model_code_raw, null, 'retail_price_krw')] ?? null}
                />
                {tierCodes.map((code) => {
                  const tier = m.tiers?.find((t) => t.plan_tier_code === code);
                  if (!tier) {
                    return (
                      <td key={code} colSpan={7} className="border-l border-zinc-100 px-2 py-1 text-center text-zinc-300">
                        —
                      </td>
                    );
                  }
                  return (
                    <RowTierCells
                      key={code}
                      sheetId={sheetId}
                      modelCode={m.model_code_raw}
                      tierCode={code}
                      tier={tier}
                      flagMap={flagMap}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function cellKey(model: string, tier: string | null, field: CellField) {
  return `${model}|${tier ?? ''}|${field}`;
}

function ThTypeHeader() {
  return (
    <>
      <th className="border-l border-zinc-200 px-1 py-1 text-[10px] font-normal text-sky-700">공통</th>
      <th className="px-1 py-1 text-[10px] font-normal">공·010</th>
      <th className="px-1 py-1 text-[10px] font-normal">공·MNP</th>
      <th className="px-1 py-1 text-[10px] font-normal">공·기변</th>
      <th className="px-1 py-1 text-[10px] font-normal text-zinc-400">선·010</th>
      <th className="px-1 py-1 text-[10px] font-normal text-zinc-400">선·MNP</th>
      <th className="px-1 py-1 text-[10px] font-normal text-zinc-400">선·기변</th>
    </>
  );
}

function RowTierCells({
  sheetId,
  modelCode,
  tierCode,
  tier,
  flagMap,
}: {
  sheetId: string;
  modelCode: string;
  tierCode: string;
  tier: SheetExtraction['models'][number]['tiers'][number];
  flagMap: FlagMap;
}) {
  return (
    <>
      <EditCell
        sheetId={sheetId} modelCode={modelCode} tierCode={tierCode}
        field="subsidy_krw" value={tier.subsidy_krw}
        flag={flagMap[cellKey(modelCode, tierCode, 'subsidy_krw')] ?? null}
        tone="subsidy"
      />
      <EditCell sheetId={sheetId} modelCode={modelCode} tierCode={tierCode} field="common.new010" value={tier.common?.new010 ?? null} flag={flagMap[cellKey(modelCode, tierCode, 'common.new010')] ?? null} />
      <EditCell sheetId={sheetId} modelCode={modelCode} tierCode={tierCode} field="common.mnp"    value={tier.common?.mnp ?? null}    flag={flagMap[cellKey(modelCode, tierCode, 'common.mnp')] ?? null} />
      <EditCell sheetId={sheetId} modelCode={modelCode} tierCode={tierCode} field="common.change" value={tier.common?.change ?? null} flag={flagMap[cellKey(modelCode, tierCode, 'common.change')] ?? null} />
      <EditCell sheetId={sheetId} modelCode={modelCode} tierCode={tierCode} field="select.new010" value={tier.select?.new010 ?? null} flag={flagMap[cellKey(modelCode, tierCode, 'select.new010')] ?? null} dim />
      <EditCell sheetId={sheetId} modelCode={modelCode} tierCode={tierCode} field="select.mnp"    value={tier.select?.mnp ?? null}    flag={flagMap[cellKey(modelCode, tierCode, 'select.mnp')] ?? null} dim />
      <EditCell sheetId={sheetId} modelCode={modelCode} tierCode={tierCode} field="select.change" value={tier.select?.change ?? null} flag={flagMap[cellKey(modelCode, tierCode, 'select.change')] ?? null} dim />
    </>
  );
}

function EditCell({
  sheetId,
  modelCode,
  tierCode,
  field,
  value,
  flag,
  dim,
  tone,
}: {
  sheetId: string;
  modelCode: string;
  tierCode: string | null;
  field: CellField;
  value: number | null;
  flag: CellFlag | null;
  dim?: boolean;
  tone?: 'subsidy';
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [local, setLocal] = useState<number | null>(value);
  const [err, setErr] = useState<string | null>(null);

  const displayValue = local ?? value;
  const isRetail = field === 'retail_price_krw';
  // 전 페이지 공통: 만원 단위 ##.# 형식
  const divisor = 10000;
  const isSubsidy = field === 'subsidy_krw';

  const severityCls =
    flag?.severity === 'red'
      ? 'ring-2 ring-red-500 bg-red-50'
      : flag?.severity === 'yellow'
      ? 'ring-1 ring-amber-400 bg-amber-50'
      : '';

  const toneCls =
    tone === 'subsidy'
      ? 'text-sky-700 font-semibold'
      : dim
      ? 'text-zinc-500'
      : '';

  async function commit(raw: string) {
    setErr(null);
    const trimmed = raw.trim();
    let next: number | null;
    if (trimmed === '' || trimmed === '-' || trimmed === '—') {
      next = null;
    } else {
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) {
        setErr('숫자가 아님');
        return;
      }
      // 입력은 단위(만원/천원) 기준. DB 저장은 원 단위.
      next = Math.round(parsed * divisor);
    }
    if (next === displayValue) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      try {
        await updateCellAction({
          sheet_id: sheetId,
          model_code_raw: modelCode,
          plan_tier_code: tierCode,
          field,
          after_value: next,
          flag_reason: flag?.reason ?? 'manual',
        });
        setLocal(next);
        setEditing(false);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    });
  }

  const borderCls = isRetail ? 'border-r border-zinc-200' : '';
  const leftBorderCls = isSubsidy ? 'border-l-2 border-zinc-200' : '';

  return (
    <td
      className={`relative px-1 py-1 text-right font-mono text-[11px] ${borderCls} ${leftBorderCls} ${toneCls} ${severityCls}`}
      title={flag ? `${flag.reason}: ${flag.detail}` : undefined}
    >
      {editing ? (
        <input
          autoFocus
          defaultValue={displayValue == null ? '' : formatMan(displayValue)}
          disabled={pending}
          onBlur={(e) => commit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="w-14 rounded border border-zinc-300 bg-white px-1 py-0.5 text-right font-mono text-[11px] outline-none focus:border-zinc-500"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`w-full cursor-pointer rounded px-0.5 hover:bg-zinc-100 ${displayValue == null ? 'text-zinc-300' : ''} ${displayValue != null && displayValue < 0 ? 'text-red-600' : ''}`}
        >
          {formatMan(displayValue)}
        </button>
      )}
      {err ? <div className="absolute -bottom-4 right-0 z-10 whitespace-nowrap text-[9px] text-red-600">{err}</div> : null}
    </td>
  );
}
