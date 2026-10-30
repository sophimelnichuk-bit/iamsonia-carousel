import { useRef } from 'react';
import { FORMATS } from '../lib/formats';
import type { Post, Template } from '../lib/types';
import { Button } from './ui';

interface Props {
  posts: Post[];
  templates: Template[];
  edited: Set<string>;
  current: { kind: 'post' | 'template'; id: string };
  onOpenPost: (id: string) => void;
  onOpenTemplate: (id: string) => void;
  onNewPost: () => void;
  onImport: (file: File) => void;
}

function bgPreview(t: Template): string {
  const b = t.background;
  if (b.kind === 'solid') return b.color;
  if (b.kind === 'gradient') return `linear-gradient(${b.angle}deg, ${b.from}, ${b.to})`;
  return b.color;
}

const item = (active: boolean) => `flex w-56 items-center gap-3 rounded-xl border p-2 text-left lg:w-full ${active ? 'border-accent bg-accent-soft' : 'border-line hover:border-accent'}`;
const fmtDate = (ms: number) => new Date(ms).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });

export function Sidebar({ posts, templates, edited, current, onOpenPost, onOpenTemplate, onNewPost, onImport }: Props) {
  const file = useRef<HTMLInputElement>(null);
  return (
    <aside className="flex flex-col border-line bg-panel lg:min-h-0 lg:overflow-y-auto lg:border-r">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">Пости</h2>
        <Button variant="primary" className="!px-2.5 !py-1 text-[13px]" onClick={onNewPost}>+ Новий пост</Button>
      </div>
      <ul className="flex gap-2 overflow-x-auto px-4 pb-3 lg:flex-col">
        {posts.map(p => {
          const f = FORMATS[p.format];
          return (
            <li key={p.id} className="shrink-0 lg:shrink">
              <button type="button" onClick={() => onOpenPost(p.id)} aria-current={current.kind === 'post' && current.id === p.id} className={item(current.kind === 'post' && current.id === p.id)}>
                <span className="shrink-0 rounded-[4px] border border-line" style={{ width: 34, height: 34 * f.h / f.w, background: p.slides[0] ? bgPreview(p.slides[0]) : '#ccc' }} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{p.name || 'Без назви'}</span>
                  <span className="block text-xs text-muted">{p.slides.length} слайдів · {fmtDate(p.updatedAt)}</span>
                </span>
              </button>
            </li>
          );
        })}
        {!posts.length && (
          <li className="w-56 shrink-0 text-[13px] text-muted lg:w-auto">Встав текст і фото, і редактор складе з них карусель.</li>
        )}
      </ul>

      <div className="flex items-center justify-between px-4 pt-2 pb-2">
        <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">Шаблони кадру</h2>
        <Button variant="ghost" className="!px-2 !py-1 text-[13px]" onClick={() => file.current?.click()}>Відкрити JSON</Button>
        <input ref={file} type="file" accept="application/json,.json" hidden
          onChange={e => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''; }} />
      </div>
      <ul className="flex gap-2 overflow-x-auto px-4 pb-4 lg:flex-col">
        {templates.map(t => {
          const f = FORMATS[t.format];
          const active = current.kind === 'template' && t.id === current.id;
          return (
            <li key={t.id} className="shrink-0 lg:shrink">
              <button type="button" onClick={() => onOpenTemplate(t.id)} aria-current={active} className={item(active)}>
                <span className="shrink-0 rounded-[4px] border border-line" style={{ width: 34, height: 34 * f.h / f.w, background: bgPreview(t) }} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{t.name}</span>
                  <span className="block text-xs text-muted">{f.label} · {f.hint}{edited.has(t.id) ? ' · змінено' : ''}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
