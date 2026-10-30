import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { drawFrame, type ImageMap } from '../lib/render';
import type { PlanItem, Post } from '../lib/types';
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

const field = 'w-full rounded-lg border border-line bg-soft px-2.5 py-1.5 text-[14px] text-ink';

function TopicDialog({ item, hasPost, onSave, onDelete, onCreatePost, onClose }: {
  item: PlanItem; hasPost: boolean; onSave: (i: PlanItem) => void; onDelete: () => void; onCreatePost: (i: PlanItem) => void; onClose: () => void;
}) {
  const [d, setD] = useState(item);
  const [confirm, setConfirm] = useState(false);
  const save = () => { if (d.title.trim() && d.date) { onSave({ ...d, title: d.title.trim() }); onClose(); } };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#141622]/40 px-4" onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="topic-title" className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-line bg-panel p-4 shadow-2xl">
        <h3 id="topic-title" className="font-bold">Тема з контент-плану</h3>
        <label className="flex flex-col gap-1 text-[13px] text-muted">Тема
          <textarea rows={2} value={d.title} onChange={e => setD({ ...d, title: e.target.value })} className={field} /></label>
        <label className="flex flex-col gap-1 text-[13px] text-muted">День
          <input type="date" value={d.date} onChange={e => setD({ ...d, date: e.target.value })} className={field} /></label>
        <label className="flex flex-col gap-1 text-[13px] text-muted">Нотатки (мем, фото, ідеї)
          <textarea rows={3} value={d.note ?? ''} onChange={e => setD({ ...d, note: e.target.value || undefined })} className={field} /></label>
        <label className="flex flex-col gap-1 text-[13px] text-muted">Заклик до дії
          <input value={d.cta ?? ''} onChange={e => setD({ ...d, cta: e.target.value || undefined })} placeholder="запис у Direct, зберегти, коментар" className={field} /></label>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="primary" onClick={save} disabled={!d.title.trim() || !d.date}>Зберегти</Button>
          {!hasPost && <Button onClick={() => { onSave(d); onCreatePost(d); }}>Створити пост за темою</Button>}
          <span className="flex-1" />
          {confirm
            ? <><Button variant="danger" onClick={() => { onDelete(); onClose(); }}>Так, видалити</Button><Button variant="ghost" onClick={() => setConfirm(false)}>Ні</Button></>
            : <Button variant="danger" onClick={() => setConfirm(true)}>Видалити тему</Button>}
        </div>
        <Button variant="ghost" onClick={onClose}>Скасувати</Button>
      </div>
    </div>
  );
}

interface Props {
  plan: PlanItem[];
  onPlan: (fn: (items: PlanItem[]) => PlanItem[]) => void;
  onNewFromTopic: (item: PlanItem) => void;
  posts: Post[];
  imgs: ImageMap;
  tick: number;
  currentId: string | null;
  onOpen: (id: string) => void;
  onSetDate: (id: string, date: string | undefined) => void;
  onNewOn: (date: string) => void;
  onClose: () => void;
}

export function Calendar({ plan, onPlan, onNewFromTopic, posts, imgs, tick, currentId, onOpen, onSetDate, onNewOn, onClose }: Props) {
  const today = toKey(new Date());
  const [month, setMonth] = useState(() => {
    const cur = posts.find(p => p.id === currentId)?.date;
    const d = cur ? new Date(cur + 'T12:00') : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [over, setOver] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [topic, setTopic] = useState<PlanItem | null>(null);
  const [newTopic, setNewTopic] = useState('');

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (topic) setTopic(null); else if (picking) setPicking(null); else onClose(); } };
    window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc);
  }, [onClose, picking, topic]);

  const byDay = useMemo(() => {
    const m: Record<string, Post[]> = {};
    posts.forEach(p => { if (p.date) (m[p.date] ??= []).push(p); });
    return m;
  }, [posts]);
  const undated = posts.filter(p => !p.date);
  const topicsByDay = useMemo(() => {
    const m: Record<string, PlanItem[]> = {};
    plan.forEach(i => (m[i.date] ??= []).push(i));
    return m;
  }, [plan]);

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
    const tid = e.dataTransfer.getData('text/plan-id');
    if (tid) { if (day) onPlan(items => items.map(i => (i.id === tid ? { ...i, date: day } : i))); return; }
    const id = e.dataTransfer.getData('text/post-id'); if (id) onSetDate(id, day);
  };
  const dragProps = (id: string) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => { e.dataTransfer.setData('text/post-id', id); e.dataTransfer.effectAllowed = 'move'; },
  });
  const ym = toKey(month).slice(0, 7);
  const inMonth = posts.filter(p => p.date?.startsWith(ym)).length;
  const topicsInMonth = plan.filter(i => i.date.startsWith(ym)).length;

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
            {topicsInMonth ? `Тем цього місяця: ${topicsInMonth}, готових постів: ${inMonth}. ` : ''}Натисни на тему, щоб змінити її або створити за нею пост. Теми й пости можна перетягувати між днями.
          </p>
          <div className="grid grid-cols-7 gap-1 text-center text-[12px] font-semibold text-muted">
            {DAYS.map(d => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (!day) return <div key={`e${i}`} className="min-h-24 rounded-lg" />;
              const list = byDay[day] ?? [];
              const topics = topicsByDay[day] ?? [];
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
                  {topics.map(i => {
                    const done = list.length > 0;
                    return (
                      <button key={i.id} type="button" draggable onClick={() => setTopic(i)} title={i.note ? `${i.title}\n\n${i.note}` : i.title}
                        onDragStart={e => { e.dataTransfer.setData('text/plan-id', i.id); e.dataTransfer.effectAllowed = 'move'; }}
                        className={`rounded-md border-l-[3px] px-1.5 py-1 text-left text-[11.5px] leading-snug ${done ? 'border-accent bg-accent-soft/60 text-muted' : 'border-[#6D9286] bg-soft hover:bg-accent-soft'}`}>
                        <span className="line-clamp-4 font-medium text-ink">{i.title}</span>
                        {i.cta && <span className="mt-0.5 block truncate text-[10.5px] text-muted">{done ? '✓ пост готовий · ' : ''}{i.cta}</span>}
                      </button>
                    );
                  })}
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

      {topic && (
        <TopicDialog item={topic} hasPost={(byDay[topic.date] ?? []).length > 0} onClose={() => setTopic(null)}
          onSave={it => onPlan(items => items.map(i => (i.id === it.id ? it : i)))}
          onDelete={() => onPlan(items => items.filter(i => i.id !== topic.id))}
          onCreatePost={it => { setTopic(null); onNewFromTopic(it); }} />
      )}

      {picking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#141622]/40 px-4" onPointerDown={e => { if (e.target === e.currentTarget) setPicking(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="pick-title" className="w-full max-w-sm rounded-2xl border border-line bg-panel p-4 shadow-2xl">
            <h3 id="pick-title" className="mb-3 font-bold">Пост на {fmtPostDate(picking)}</h3>
            <Button variant="primary" className="w-full" onClick={() => { onNewOn(picking); setPicking(null); }}>+ Новий пост на цей день</Button>
            <form className="mt-3 flex gap-2" onSubmit={e => { e.preventDefault(); const t = newTopic.trim(); if (!t) return;
              onPlan(items => [...items, { id: `u${Date.now().toString(36)}`, date: picking, title: t }]); setNewTopic(''); setPicking(null); }}>
              <input value={newTopic} onChange={e => setNewTopic(e.target.value)} placeholder="Або впиши тему в контент-план" aria-label="Нова тема"
                className="min-w-0 flex-1 rounded-lg border border-line bg-soft px-2.5 py-1.5 text-[14px]" />
              <Button type="submit" disabled={!newTopic.trim()}>Додати</Button>
            </form>
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
