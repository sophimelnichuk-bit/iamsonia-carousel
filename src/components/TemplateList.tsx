import { useRef } from 'react';
import { FORMATS } from '../lib/formats';
import type { Template } from '../lib/types';
import { Button } from './ui';

interface Props {
  templates: Template[];
  edited: Set<string>;
  current: string;
  onOpen: (id: string) => void;
  onImport: (file: File) => void;
}

function bgPreview(t: Template): string {
  const b = t.background;
  if (b.kind === 'solid') return b.color;
  if (b.kind === 'gradient') return `linear-gradient(${b.angle}deg, ${b.from}, ${b.to})`;
  return b.color;
}

export function TemplateList({ templates, edited, current, onOpen, onImport }: Props) {
  const file = useRef<HTMLInputElement>(null);
  return (
    <aside className="flex flex-col border-line bg-panel lg:min-h-0 lg:border-r">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">Шаблони</h2>
        <Button variant="ghost" className="!px-2 !py-1 text-[13px]" onClick={() => file.current?.click()}>Відкрити JSON</Button>
        <input ref={file} type="file" accept="application/json,.json" hidden
          onChange={e => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''; }} />
      </div>
      <ul className="flex gap-2 overflow-x-auto px-4 pb-4 lg:flex-col lg:overflow-y-auto">
        {templates.map(t => {
          const f = FORMATS[t.format];
          const active = t.id === current;
          return (
            <li key={t.id} className="shrink-0 lg:shrink">
              <button type="button" onClick={() => onOpen(t.id)} aria-current={active}
                className={`flex w-56 items-center gap-3 rounded-xl border p-2 text-left lg:w-full ${active ? 'border-accent bg-accent-soft' : 'border-line hover:border-accent'}`}>
                <span className="shrink-0 rounded-[4px] border border-line" style={{ width: 34, height: 34 * f.h / f.w, background: bgPreview(t) }} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{t.name}</span>
                  <span className="block text-xs text-muted">
                    {f.label} · {f.hint}{edited.has(t.id) ? ' · змінено' : ''}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
