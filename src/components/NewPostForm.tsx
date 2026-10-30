import { useEffect, useRef, useState } from 'react';
import { autoSplit, composePost, DEFAULT_CTA } from '../lib/compose';
import { FORMATS, FORMAT_IDS } from '../lib/formats';
import { addPhoto, deletePhotos, photoUrl } from '../lib/photos';
import type { FormatId, PhotoInfo, Post } from '../lib/types';
import { Button } from './ui';

const SAMPLE = `Ти не можеш без партнера чи навпаки не підпускаєш його близько? Обидва сценарії про одне й те саме.

Коли ти в залежності, ти чекаєш повідомлення і не можеш видихнути, поки воно не прийде. Настрій залежить від тону партнера, а страх втратити партнера керує майже кожним рішенням.

Контрзалежність виглядає протилежно. Близькість лякає більше, ніж самотність, тому ти тримаєш дистанцію і справляєшся без нікого, аби тільки не розчаруватись.

Обидві стратегії колись рятували тебе. Сьогодні вони просто заважають бути поруч і залишатися собою. Цьому можна навчитися, крок за кроком.

Якщо впізнаєш себе, запишись на онлайн-консультацію в Direct або за посиланням у шапці профілю.`;

const field = 'w-full rounded-lg border border-line bg-soft px-3 py-2 text-[15px] text-ink';

export function NewPostForm({ onClose, onCreate, date, topic }: { onClose: () => void; onCreate: (p: Post) => void; date?: string; topic?: string }) {
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<PhotoInfo[]>([]);
  const [format, setFormat] = useState<FormatId>('feed');
  const [caption, setCaption] = useState('');
  const [cta, setCta] = useState(DEFAULT_CTA);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const created = useRef(false);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const fileInput = useRef<HTMLInputElement>(null);

  // якщо форму закрили без створення поста, фото прибираємо зі сховища
  useEffect(() => () => { if (!created.current) deletePhotos(photosRef.current.map(p => p.id)); }, []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const add = async (files: FileList | File[]) => {
    const list = [...files].filter(f => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    if (!list.length) return;
    setBusy(true);
    try { const added: PhotoInfo[] = []; for (const f of list) added.push(await addPhoto(f)); setPhotos(p => [...p, ...added]); }
    catch { setErr('Не вдалося відкрити одне з фото. Спробуй JPG або PNG.'); }
    finally { setBusy(false); }
  };
  const moveP = (i: number, d: number) => setPhotos(p => { const n = [...p]; const j = i + d; if (j < 0 || j >= n.length) return p; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const removeP = (id: string) => { setPhotos(p => p.filter(x => x.id !== id)); deletePhotos([id]); };

  const plan = autoSplit(text, format);
  const middle = plan.slides.length;
  const withPhoto = Math.min(middle, Math.max(0, photos.length - 1));
  const total = 1 + middle + 1;

  const submit = async () => {
    if (!text.trim()) { setErr('Встав текст поста, і редактор розкладе його на слайди.'); return; }
    setBusy(true);
    try {
      // шрифт має бути завантажений до верстки, інакше розміри тексту розрахуються неточно
      await Promise.all(['400 40px Onest', '500 40px Onest', '800 80px Onest'].map(f => document.fonts.load(f, 'Аа')));
      created.current = true;
      onCreate({ ...composePost({ text, photos, format, caption, cta }), ...(date ? { date } : {}), ...(topic ? { name: topic } : {}) });
    } catch { created.current = false; setErr('Не вдалося зібрати пост. Спробуй ще раз.'); setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-[#141622]/50 px-4 py-6" onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="np-title" className="w-full max-w-3xl rounded-2xl border border-line bg-panel shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id="np-title" className="text-lg font-bold">Новий пост{date ? ` на ${new Date(date + 'T12:00').toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })}` : ''}</h2>
          <Button variant="ghost" onClick={onClose} aria-label="Закрити">Закрити</Button>
        </div>

        {topic && <p className="border-b border-line bg-accent-soft px-5 py-2.5 text-[14px]"><b>Тема з контент-плану:</b> {topic}</p>}
        <div className="grid gap-5 px-5 py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,280px)]">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="np-text" className="text-sm font-semibold">Текст каруселі</label>
              {!text && <button type="button" className="text-[13px] text-accent" onClick={() => setText(SAMPLE)}>Вставити приклад</button>}
            </div>
            <textarea id="np-text" rows={14} value={text} onChange={e => { setText(e.target.value); setErr(''); }} className={field}
              placeholder="Встав готовий текст поста як є. Редактор сам знайде хук, розкладе текст на слайди і підбере заголовки." />
            <p className="text-[13px] text-muted">Хук стає обкладинкою, абзаци розходяться по слайдах, довгі діляться по реченнях. Останній абзац із записом на консультацію піде на слайд із закликом. Щоб примусово почати новий слайд, постав рядок <code className="rounded bg-soft px-1">---</code>, а <code className="rounded bg-soft px-1">**слово**</code> зробить слово жирним.</p>
            {text.trim() && (
              <ol className="mt-1 flex max-h-56 flex-col gap-1 overflow-y-auto rounded-xl border border-line p-2 text-[13px]" aria-label="Як текст розкладено на слайди">
                <li className="flex gap-2"><span className="w-5 shrink-0 text-right text-muted tabular-nums">1</span><span className="min-w-0"><b>Хук:</b> {plan.hook.replace(/\*\*/g, '')}{plan.hookBody && <span className="text-muted"> {plan.hookBody}</span>}</span></li>
                {plan.slides.map((c, i) => (
                  <li key={i} className="flex gap-2"><span className="w-5 shrink-0 text-right text-muted tabular-nums">{i + 2}</span>
                    <span className="min-w-0 truncate">{c.heading && <b>{c.heading.replace(/\*\*/g, '')}. </b>}<span className="text-muted">{c.body.replace(/\*\*/g, '')}</span></span></li>
                ))}
                <li className="flex gap-2"><span className="w-5 shrink-0 text-right text-muted tabular-nums">{plan.slides.length + 2}</span><span className="min-w-0 truncate"><b>Заклик:</b> <span className="text-muted">{plan.cta && cta.body === DEFAULT_CTA.body ? plan.cta : cta.body}</span></span></li>
              </ol>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">Фото</span>
              <div onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
                onDrop={e => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-3 py-5 text-center text-[13px] ${over ? 'border-accent bg-accent-soft' : 'border-line'}`}>
                <span className="text-muted">Перетягни фото сюди або</span>
                <Button onClick={() => fileInput.current?.click()} disabled={busy}>{busy ? 'Додаю…' : 'Обрати фото'}</Button>
                <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={e => { if (e.target.files) add(e.target.files); e.target.value = ''; }} />
              </div>
              {photos.length > 0 && (
                <ol className="grid grid-cols-3 gap-2">
                  {photos.map((p, i) => (
                    <li key={p.id} className="group relative">
                      <img src={photoUrl(p.id)} alt={`Фото ${i + 1}`} className="aspect-[4/5] w-full rounded-lg object-cover" />
                      <span className="absolute top-1 left-1 rounded bg-[#141622]/70 px-1.5 text-[11px] font-semibold text-white">{i === 0 ? 'обкладинка' : i + 1}</span>
                      <span className="absolute inset-x-1 bottom-1 flex justify-between">
                        <button type="button" onClick={() => moveP(i, -1)} disabled={i === 0} aria-label="Раніше" className="rounded bg-white/90 px-1.5 text-xs text-[#2D3044] disabled:opacity-40">←</button>
                        <button type="button" onClick={() => removeP(p.id)} aria-label="Прибрати фото" className="rounded bg-white/90 px-1.5 text-xs text-[#A23B3B]">✕</button>
                        <button type="button" onClick={() => moveP(i, 1)} disabled={i === photos.length - 1} aria-label="Пізніше" className="rounded bg-white/90 px-1.5 text-xs text-[#2D3044] disabled:opacity-40">→</button>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              <p className="text-[12px] text-muted">Перше фото йде на обкладинку, наступні на слайди по черзі. Фото лишаються на цьому пристрої.</p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">Формат</span>
              <div role="radiogroup" aria-label="Формат" className="flex rounded-lg border border-line bg-soft p-0.5">
                {FORMAT_IDS.map(f => (
                  <button key={f} type="button" role="radio" aria-checked={format === f} onClick={() => setFormat(f)}
                    className={`flex-1 rounded-md px-2 py-1 text-[13px] ${format === f ? 'bg-panel font-semibold shadow-sm' : 'text-muted'}`}>
                    {FORMATS[f].label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <details className="md:col-span-2 rounded-xl border border-line px-4 py-3" open>
            <summary className="cursor-pointer text-sm font-semibold">Заклик до дії (останній слайд)</summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-[13px] text-muted">Заголовок
                <input value={cta.heading} onChange={e => setCta({ ...cta, heading: e.target.value })} className={field} /></label>
              <label className="flex flex-col gap-1 text-[13px] text-muted">Кнопка
                <input value={cta.button} onChange={e => setCta({ ...cta, button: e.target.value })} className={field} /></label>
              <label className="flex flex-col gap-1 text-[13px] text-muted md:col-span-2">Текст
                <textarea rows={2} value={cta.body} onChange={e => setCta({ ...cta, body: e.target.value })} className={field} /></label>
            </div>
          </details>

          <label className="flex flex-col gap-1 text-sm font-semibold md:col-span-2">Підпис до посту
            <textarea rows={3} value={caption} onChange={e => setCaption(e.target.value)} className={`${field} font-normal`}
              placeholder="Текст під каруселлю. Його можна буде скопіювати одним натиском." />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
          <p className="text-[13px] text-muted" aria-live="polite">
            {err ? <span className="text-danger">{err}</span>
              : text.trim() ? `Буде ${total} слайдів: обкладинка${middle ? `, ${middle} зі змістом (${withPhoto} з фото)` : ''} і заклик до дії.` : 'Встав текст, щоб побачити, скільки буде слайдів.'}
          </p>
          <Button variant="primary" onClick={submit} disabled={busy}>Зібрати пост</Button>
        </div>
      </div>
    </div>
  );
}
