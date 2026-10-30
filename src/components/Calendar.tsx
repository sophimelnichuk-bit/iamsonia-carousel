import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { drawFrame, type ImageMap } from '../lib/render';
import type { Post } from '../lib/types';
import { Button } from './ui';

const MONTHS = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

const pad = (n: number) => String(n).padStart(2, '0');
export const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fmtPostDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
};

function Cover({ post, imgs, tick }: { post: Post; imgs: ImageMap; tick: number }) {
  const c = useRef<HTMLCanvasElement>(null);
  const s = post.slides[0];
  useEffect(() => { if (c.current && s) drawFrame(c.current, s, imgs, { n: 1, total: post.slides.length }); }, [s, imgs, tick, post.slides.length]);
  return <canvas ref={c} className="block h-auto w-full rounded-[4px]" aria-hidden="true" />;
}

interface Props {
  posts: Post[];
  imgs: ImageMap;
  tick: number;
  currentId: string | null;
  onOpen: (id: string) => void;
  onSetDate: (id: string, date: string | undefined) => void;
  onNewOn: (date: string) => void;
  onClose: () => void;
}

export function Calendar({ posts, imgs, tick, currentId, onOpen, onSetDate, onNewOn, onClose }: Props) {
  const today = toKey(new Date());
  const [month, setMonth] = useState(() => {
    const cur = posts.find(p => p.id === currentId)?.date;
    const d = cur ? new Date(cur + 'T12:00') : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [over, setOver] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (picking) setPicking(null); else onClose(); } };
    window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc);
  }, [onClose, picking]);

  const byDay = useMemo(() => {
    const m: Record<string, Post[]> = {};
    posts.forEach(p => { if (p.date) (m[p.date] ??= []).push(p); });
    return m;
  }, [posts]);
  const undated = posts.filter(p => !p.date);

  const cells = useMemo(() => {
    const first = (month.getDay() + 6) % 7; // тиждень з понеділка
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const out: (string | null)[] = Array(first).fill(null);
    for (let d = 1; d <= days; d++) out.push(toKey(new Date(month.getFullYear(), month.getMonth(), d)));
    while (out.length % 7) out.push(null);
    return out;
  }, [month]);

  const shift = (n: number) => setMonth(m => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const drop = (e: DragEvent, day: string | undefined) => {
    e.preventDefault(); setOver(null);
    const id = e.dataTransfer.getData('text/post-id'); if (id) onSetDate(id, day);
  };
  const dragProps = (id: string) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => { e.dataTransfer.setData('text/post-id', id); e.dataTransfer.effectAllowed = 'move'; },
  });
  const inMonth = posts.filter(p => p.date?.startsWith(toKey(month).slice(0, 7))).length;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-[#141622]/50 px-3 py-6" onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="cal-title" className="w-full max-w-5xl rounded-2xl border border-line bg-panel shadow-2xl">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-4">
          <h2 id="cal-title" className="mr-auto text-lg font-bold">Контент-план</h2>
          <Button variant="ghost" onClick={() => shift(-1)} aria-label="Попередній місяць">←</Button>
          <span className="min-w-36 text-center font-semibold tabular-nums">{MONTHS[month.getMonth()]} {month.getFullYear()}</span>
          <Button variant="ghost" onClick={() => shift(1)} aria-label="Наступний місяць">→</Button>
          <Button variant="ghost" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Сьогодні</Button>
          <Button variant="ghost" onClick={onClose} aria-label="Закрити">Закрити</Button>
        </div>

        <div className="px-3 py-3 sm:px-5">
          <p className="mb-2 text-[13px] text-muted">
            {inMonth ? `Цього місяця запланованих постів: ${inMonth}. ` : ''}Перетягни пост на день або натисни на порожній день, щоб поставити туди пост.
          </p>
          <div className="grid grid-cols-7 gap-1 text-center text-[12px] font-semibold text-muted">
            {DAYS.map(d => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (!day) return <div key={`e${i}`} className="min-h-24 rounded-lg" />;
              const list = byDay[day] ?? [];
              const n = Number(day.slice(8));
              return (
                <div key={day}
                  onDragOver={e => { e.preventDefault(); setOver(day); }} onDragLeave={() => setOver(o => (o === day ? null : o))} onDrop={e => drop(e, day)}
                  className={`flex min-h-24 flex-col gap-1 rounded-lg border p-1 text-left ${over === day ? 'border-accent bg-accent-soft' : 'border-line'} ${day < today ? 'bg-soft/60' : ''}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[12px] tabular-nums ${day === today ? 'rounded-full bg-accent px-1.5 font-bold text-accent-ink' : 'text-muted'}`}>{n}</span>
                    <button type="button" onClick={() => setPicking(day)} aria-label={`Додати пост на ${fmtPostDate(day)}`}
                      className="rounded px-1 text-[13px] leading-none text-muted hover:bg-soft hover:text-ink">+</button>
                  </div>
                  {list.map(p => (
                    <button key={p.id} type="button" {...dragProps(p.id)} onClick={() => onOpen(p.id)} title={p.name}
                      className={`flex items-center gap-1 rounded-md border p-0.5 text-left ${p.id === currentId ? 'border-accent' : 'border-transparent hover:border-line'}`}>
                      <span className="w-6 shrink-0"><Cover post={p} imgs={imgs} tick={tick} /></span>
                      <span className="line-clamp-2 min-w-0 text-[11px] leading-tight">{p.name || 'Без назви'}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>

          <div onDragOver={e => { e.preventDefault(); setOver('none'); }} onDragLeave={() => setOver(o => (o === 'none' ? null : o))} onDrop={e => drop(e, undefined)}
            className={`mt-4 rounded-xl border border-dashed p-3 ${over === 'none' ? 'border-accent bg-accent-soft' : 'border-line'}`}>
            <h3 className="mb-2 text-[13px] font-semibold tracking-wide text-muted uppercase">Без дати ({undated.length})</h3>
            {undated.length ? (
              <div className="flex flex-wrap gap-2">
                {undated.map(p => (
                  <button key={p.id} type="button" {...dragProps(p.id)} onClick={() => onOpen(p.id)}
                    className="flex w-44 items-center gap-2 rounded-lg border border-line p-1.5 text-left hover:border-accent">
                    <span className="w-8 shrink-0"><Cover post={p} imgs={imgs} tick={tick} /></span>
                    <span className="line-clamp-2 min-w-0 text-[12px] leading-tight">{p.name || 'Без назви'}</span>
                  </button>
                ))}
              </div>
            ) : <p className="text-[13px] text-muted">Усі пости мають дату. Перетягни пост сюди, щоб зняти дату.</p>}
          </div>
        </div>
      </div>

      {picking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#141622]/40 px-4" onPointerDown={e => { if (e.target === e.currentTarget) setPicking(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="pick-title" className="w-full max-w-sm rounded-2xl border border-line bg-panel p-4 shadow-2xl">
            <h3 id="pick-title" className="mb-3 font-bold">Пост на {fmtPostDate(picking)}</h3>
            <Button variant="primary" className="w-full" onClick={() => { onNewOn(picking); setPicking(null); }}>+ Новий пост на цей день</Button>
            {undated.length > 0 && <p className="mt-4 mb-2 text-[13px] text-muted">Або постав готовий пост без дати:</p>}
            <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
              {undated.map(p => (
                <button key={p.id} type="button" onClick={() => { onSetDate(p.id, picking); setPicking(null); }}
                  className="flex items-center gap-2 rounded-lg border border-line p-1.5 text-left hover:border-accent">
                  <span className="w-8 shrink-0"><Cover post={p} imgs={imgs} tick={tick} /></span>
                  <span className="line-clamp-2 min-w-0 text-[13px]">{p.name || 'Без назви'}</span>
                </button>
              ))}
            </div>
            <Button variant="ghost" className="mt-3 w-full" onClick={() => setPicking(null)}>Скасувати</Button>
          </div>
        </div>
      )}
    </div>
  );
}
