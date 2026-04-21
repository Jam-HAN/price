import type { ReactNode } from 'react';

/** 대박통신 단가 시스템 공통 UI 프리미티브 */

export type Tone = 'default' | 'blue' | 'lime' | 'pink' | 'mint' | 'yellow' | 'ink';

export function Chip({
  tone = 'default',
  dot = true,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
}) {
  const cls = tone === 'default' ? 'chip' : `chip ${tone}`;
  return (
    <span className={cls}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

export type CarrierKey = 'SKT' | 'KT' | 'LGU+';

const CARRIER_KEY: Record<CarrierKey, string> = {
  SKT: 'skt',
  KT: 'kt',
  'LGU+': 'lgu',
};

export function CarrierPill({
  id,
  compact = false,
}: {
  id: CarrierKey;
  compact?: boolean;
}) {
  return <span className={`carrier ${CARRIER_KEY[id]}`}>{compact ? id : id}</span>;
}

export function PageHeader({
  crumbs,
  title,
  actions,
}: {
  crumbs?: string[];
  title: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {crumbs && crumbs.length > 0 ? (
          <div className="crumbs">{crumbs.join(' / ')}</div>
        ) : null}
        <h1>{title}</h1>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { v: T; label: string }[];
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          className={o.v === value ? 'on' : ''}
          onClick={() => onChange(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SegmentedLink<T extends string>({
  value,
  options,
  hrefFor,
}: {
  value: T;
  options: { v: T; label: string }[];
  hrefFor: (v: T) => string;
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <a
          key={o.v}
          href={hrefFor(o.v)}
          className={o.v === value ? 'on' : ''}
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            color: o.v === value ? 'var(--ink)' : 'var(--ink-3)',
            background: o.v === value ? '#fff' : 'transparent',
            boxShadow: o.v === value ? '0 1px 2px rgba(11,16,32,0.08)' : 'none',
            display: 'inline-block',
          }}
        >
          {o.label}
        </a>
      ))}
    </div>
  );
}

export function Steps({
  current,
  steps,
}: {
  current: number;
  steps: { n: number; label: string }[];
}) {
  return (
    <div className="steps">
      {steps.map((s, i) => (
        <span key={s.n} className="flex items-center">
          <span
            className={`step ${s.n === current ? 'on' : s.n < current ? 'done' : ''}`}
          >
            <span className="n">{s.n < current ? '✓' : s.n}</span>
            <span>{s.label}</span>
          </span>
          {i < steps.length - 1 ? <span className="step-sep">›</span> : null}
        </span>
      ))}
    </div>
  );
}

export function StatCard({
  label,
  value,
  pill,
  pillTone = 'blue',
  delta,
  deltaDown,
}: {
  label: string;
  value: ReactNode;
  pill?: string;
  pillTone?: 'blue' | 'lime' | 'pink' | 'yellow';
  delta?: string;
  deltaDown?: boolean;
}) {
  const pillBg = {
    blue: 'var(--blue-soft)',
    lime: 'var(--lime-soft)',
    pink: 'var(--pink-soft)',
    yellow: 'var(--yellow-soft)',
  }[pillTone];
  const pillFg = {
    blue: 'var(--blue-2)',
    lime: '#4f5d07',
    pink: '#b8246e',
    yellow: '#7a5a00',
  }[pillTone];
  return (
    <div className="stat">
      {pill ? (
        <span className="stat-pill" style={{ background: pillBg, color: pillFg }}>
          {pill}
        </span>
      ) : null}
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {delta ? <div className={`delta ${deltaDown ? 'down' : ''}`}>{delta}</div> : null}
    </div>
  );
}
