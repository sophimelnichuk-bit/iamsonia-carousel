import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react';

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border-b border-line px-4 py-4 last:border-b-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">{title}</h2>
        {aside}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

export function Button({ variant = 'default', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'ghost' | 'danger' }) {
  const v = {
    default: 'border border-line bg-panel hover:border-accent',
    primary: 'border border-accent bg-accent text-accent-ink hover:brightness-105',
    ghost: 'border border-transparent hover:bg-soft',
    danger: 'border border-transparent text-danger hover:bg-soft',
  }[variant];
  return <button type="button" {...p} className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-50 ${v} ${className}`} />;
}

export function Range({ label, value, min, max, step = 1, onChange, unit = '', format }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; unit?: string; format?: (v: number) => string;
}) {
  const id = useId();
  return (
    <div className="grid grid-cols-[96px_1fr_64px] items-center gap-2 text-[13px]">
      <label htmlFor={id} className="text-muted">{label}</label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
      <input
        aria-label={label} type="number" min={min} max={max} step={step} value={Number(value.toFixed(2))}
        onChange={e => { const n = Number(e.target.value); if (!Number.isNaN(n)) onChange(n); }}
        className="w-full rounded-md border border-line bg-soft px-1.5 py-0.5 text-right tabular-nums"
        title={format ? format(value) : `${value}${unit}`}
      />
    </div>
  );
}

export function Select<T extends string | number>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div className="grid grid-cols-[96px_1fr] items-center gap-2 text-[13px]">
      <label htmlFor={id} className="text-muted">{label}</label>
      <select id={id} value={String(value)} onChange={e => { const o = options.find(x => String(x.value) === e.target.value); if (o) onChange(o.value); }}
        className="w-full min-w-0 rounded-md border border-line bg-soft px-2 py-1.5">
        {options.map(o => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="grid grid-cols-[96px_1fr] items-center gap-2 text-[13px]">
      <label htmlFor={id} className="text-muted">{label}</label>
      <div className="flex items-center gap-2">
        <input id={id} type="color" value={value} onChange={e => onChange(e.target.value)} className="h-8 w-10 shrink-0 cursor-pointer rounded-md border border-line bg-transparent p-0.5" />
        <input aria-label={`${label}, код кольору`} value={value} onChange={e => /^#[0-9a-f]{6}$/i.test(e.target.value) && onChange(e.target.value)}
          onBlur={e => { if (!/^#[0-9a-f]{6}$/i.test(e.target.value)) e.target.value = value; }}
          className="w-24 rounded-md border border-line bg-soft px-2 py-1 font-mono text-xs uppercase" defaultValue={value} key={value} />
      </div>
    </div>
  );
}

export function Segmented<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="grid grid-cols-[96px_1fr] items-center gap-2 text-[13px]">
      <span className="text-muted">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex rounded-lg border border-line bg-soft p-0.5">
        {options.map(o => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value} title={o.title} onClick={() => onChange(o.value)}
            className={`flex-1 rounded-md px-2 py-1 text-[13px] ${value === o.value ? 'bg-panel font-semibold shadow-sm' : 'text-muted hover:text-ink'}`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Палітра бренду @iamsonia.psy для швидкого вибору. */
export const BRAND = [
  { name: 'Шавлія', hex: '#6D9286' },
  { name: 'Пудра', hex: '#FAF1F0' },
  { name: 'Блакитний', hex: '#CBE8FF' },
  { name: 'Графіт', hex: '#4D5270' },
  { name: 'Білий', hex: '#FFFFFF' },
];

export function Swatches({ value, onPick }: { value: string; onPick: (hex: string) => void }) {
  return (
    <div className="flex gap-1.5 pl-[104px]">
      {BRAND.map(c => (
        <button key={c.hex} type="button" title={c.name} aria-label={c.name} aria-pressed={value.toLowerCase() === c.hex.toLowerCase()} onClick={() => onPick(c.hex)}
          className="size-6 rounded-full border border-line aria-pressed:ring-2 aria-pressed:ring-accent aria-pressed:ring-offset-1 aria-pressed:ring-offset-panel" style={{ background: c.hex }} />
      ))}
    </div>
  );
}
