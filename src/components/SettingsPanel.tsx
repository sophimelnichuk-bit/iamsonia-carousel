import { useRef, useState } from 'react';
import { allFonts } from '../lib/fonts';
import { FORMATS, FORMAT_IDS } from '../lib/formats';
import { photoUrl } from '../lib/photos';
import type { Align, Background, FormatId, ImageBlock, Post, SlideKind, Template, TextBlock } from '../lib/types';
import { Button, Color, Range, Section, Segmented, Select, Swatches } from './ui';

export interface PostControls {
  post: Post;
  onPost: (patch: Partial<Post>) => void;
  onLayout: (kind: SlideKind) => void;
  onAddPhotos: (files: FileList) => void;
  onUsePhoto: (photoId: string) => void;
  onDeletePost: () => void;
}

interface Props {
  t: Template;
  selected: string | null;
  guides: boolean;
  fontsVersion: number;
  post: PostControls | null;
  onGuides: (v: boolean) => void;
  onChange: (patch: Partial<Template>) => void;
  onFormat: (f: FormatId) => void;
  onBlock: (id: string, patch: Partial<TextBlock>) => void;
  onImage: (id: string, patch: Partial<ImageBlock>) => void;
  onSelect: (id: string | null) => void;
  onAddBlock: () => void;
  onAddImage: () => void;
  onDuplicateBlock: (id: string) => void;
  onDeleteBlock: (id: string) => void;
  onDeleteImage: (id: string) => void;
  onBgFile: (f: File) => void;
  onFontFile: (f: File) => void;
}

const WEIGHTS = [300, 400, 500, 600, 700, 800, 900].map(w => ({ value: w, label: `${w}${w === 400 ? ' · звичайний' : w === 700 ? ' · жирний' : ''}` }));
const KINDS: { value: SlideKind; label: string }[] = [
  { value: 'cover', label: 'Обкладинка' }, { value: 'photo', label: 'Фото + текст' }, { value: 'text', label: 'Текст' }, { value: 'cta', label: 'Заклик' },
];

function PostSection({ pc }: { pc: PostControls }) {
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(pc.post.caption); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { /* браузер не дав доступу до буфера: текст можна виділити вручну */ }
  };
  return (
    <Section title="Пост">
      <label className="flex flex-col gap-1 text-[13px] text-muted" htmlFor="post-name">Назва для себе
        <input id="post-name" value={pc.post.name} onChange={e => pc.onPost({ name: e.target.value })}
          className="w-full rounded-lg border border-line bg-soft px-2.5 py-1.5 text-[15px] text-ink" />
      </label>
      <label className="flex flex-col gap-1 text-[13px] text-muted" htmlFor="post-caption">Підпис до посту
        <textarea id="post-caption" rows={4} value={pc.post.caption} onChange={e => pc.onPost({ caption: e.target.value })}
          placeholder="Текст під каруселлю"
          className="w-full resize-y rounded-lg border border-line bg-soft px-2.5 py-2 text-[15px] text-ink" />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button onClick={copy} disabled={!pc.post.caption.trim()}>{copied ? 'Скопійовано' : 'Скопіювати підпис'}</Button>
        {confirm
          ? <><Button variant="danger" onClick={pc.onDeletePost}>Так, видалити пост</Button><Button variant="ghost" onClick={() => setConfirm(false)}>Скасувати</Button></>
          : <Button variant="danger" onClick={() => setConfirm(true)}>Видалити пост</Button>}
      </div>
    </Section>
  );
}

export function SettingsPanel(p: Props) {
  const { t, post: pc } = p;
  const b = t.blocks.find(x => x.id === p.selected) ?? null;
  const im = t.images?.find(x => x.id === p.selected) ?? null;
  const bgFile = useRef<HTMLInputElement>(null);
  const fontFile = useRef<HTMLInputElement>(null);
  const photoFile = useRef<HTMLInputElement>(null);
  const W = FORMATS[t.format].w, H = FORMATS[t.format].h;
  const setBg = (bg: Background) => p.onChange({ background: bg });
  const bg = t.background;

  const switchBg = (kind: Background['kind']) => {
    const base = bg.kind === 'solid' ? bg.color : bg.kind === 'gradient' ? bg.from : bg.color;
    if (kind === 'solid') setBg({ kind, color: base });
    if (kind === 'gradient') setBg({ kind, from: base, to: '#4D5270', angle: 160 });
    if (kind === 'image') setBg({ kind, src: '', color: base, overlay: '#1E2030', overlayOpacity: 0.25, posX: 50, posY: 50, zoom: 1 });
  };

  return (
    <aside className="border-line bg-panel lg:min-h-0 lg:overflow-y-auto lg:border-l">
      {pc && <PostSection pc={pc} />}

      {pc && (
        <Section title="Макет слайду">
          <div className="grid grid-cols-2 gap-1.5">
            {KINDS.map(k => (
              <button key={k.value} type="button" onClick={() => pc.onLayout(k.value)} aria-pressed={t.kind === k.value}
                className="rounded-lg border border-line px-2 py-1.5 text-[13px] aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:font-semibold">
                {k.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">Текст і фото слайду зберігаються, розташування складається заново.</p>
        </Section>
      )}

      {pc && (
        <Section title="Фото поста" aside={<Button variant="ghost" className="!px-2 !py-1 text-[13px]" onClick={() => photoFile.current?.click()}>+ Фото</Button>}>
          <input ref={photoFile} type="file" accept="image/*" multiple hidden onChange={e => { if (e.target.files) pc.onAddPhotos(e.target.files); e.target.value = ''; }} />
          {pc.post.photos.length ? (
            <div className="grid grid-cols-4 gap-1.5">
              {pc.post.photos.map((ph, i) => (
                <button key={ph.id} type="button" onClick={() => pc.onUsePhoto(ph.id)} title="Поставити на цей слайд"
                  className="overflow-hidden rounded-md border border-line hover:ring-2 hover:ring-accent">
                  <img src={photoUrl(ph.id)} alt={`Фото ${i + 1}`} className="aspect-[4/5] w-full object-cover" />
                </button>
              ))}
            </div>
          ) : <p className="text-[13px] text-muted">Додай фото, щоб поставити їх на слайди.</p>}
          <p className="text-xs text-muted">Натисни на фото, щоб поставити його в рамку цього слайду або на фон, якщо рамки немає.</p>
          <Button onClick={p.onAddImage}>+ Рамка для фото</Button>
        </Section>
      )}

      {im && (
        <Section title="Фото-блок">
          <Range label="Заокруглення" value={im.radius} min={0} max={300} onChange={v => p.onImage(im.id, { radius: v })} unit="px" />
          <Range label="Ліво, право" value={im.posX} min={0} max={100} onChange={v => p.onImage(im.id, { posX: v })} unit="%" />
          <Range label="Верх, низ" value={im.posY} min={0} max={100} onChange={v => p.onImage(im.id, { posY: v })} unit="%" />
          <Range label="Масштаб фото" value={im.zoom} min={1} max={3} step={0.05} onChange={v => p.onImage(im.id, { zoom: v })} />
          <Range label="Ширина" value={im.width} min={60} max={W} onChange={v => p.onImage(im.id, { width: v })} unit="px" />
          <Range label="Висота" value={im.height} min={60} max={H} onChange={v => p.onImage(im.id, { height: v })} unit="px" />
          <Range label="Позиція X" value={im.x} min={0} max={W} onChange={v => p.onImage(im.id, { x: v })} unit="px" />
          <Range label="Позиція Y" value={im.y} min={0} max={H} onChange={v => p.onImage(im.id, { y: v })} unit="px" />
          <div className="pl-[104px]"><Button variant="danger" onClick={() => p.onDeleteImage(im.id)}>Прибрати рамку</Button></div>
        </Section>
      )}

      <Section title="Кадр">
        <Segmented label="Формат" value={t.format} onChange={p.onFormat}
          options={FORMAT_IDS.map(f => ({ value: f, label: f === 'story' ? '9:16' : f === 'square' ? '1:1' : '4:5', title: `${FORMATS[f].label} ${FORMATS[f].hint}` }))} />
        <p className="pl-[104px] text-xs text-muted">{FORMATS[t.format].label}, {FORMATS[t.format].hint}{pc ? '. Зміна формату перескладає всі слайди поста.' : ''}</p>
        <Range label="Відступ з боків" value={t.padding.x} min={0} max={240} onChange={v => p.onChange({ padding: { ...t.padding, x: v } })} unit="px" />
        <Range label="Відступ згори і знизу" value={t.padding.y} min={0} max={400} onChange={v => p.onChange({ padding: { ...t.padding, y: v } })} unit="px" />
        <label className="flex items-center gap-2 pl-[104px] text-[13px]">
          <input type="checkbox" checked={p.guides} onChange={e => p.onGuides(e.target.checked)} className="size-4 accent-[var(--app-accent)]" />
          Показувати межі відступів
        </label>
      </Section>

      <Section title="Фон">
        <Segmented label="Тип" value={bg.kind} onChange={switchBg}
          options={[{ value: 'solid', label: 'Колір' }, { value: 'gradient', label: 'Градієнт' }, { value: 'image', label: 'Фото' }]} />
        {bg.kind === 'solid' && (<>
          <Color label="Колір" value={bg.color} onChange={c => setBg({ ...bg, color: c })} />
          <Swatches value={bg.color} onPick={c => setBg({ ...bg, color: c })} />
        </>)}
        {bg.kind === 'gradient' && (<>
          <Color label="Від" value={bg.from} onChange={c => setBg({ ...bg, from: c })} />
          <Swatches value={bg.from} onPick={c => setBg({ ...bg, from: c })} />
          <Color label="До" value={bg.to} onChange={c => setBg({ ...bg, to: c })} />
          <Swatches value={bg.to} onPick={c => setBg({ ...bg, to: c })} />
          <Range label="Кут" value={bg.angle} min={0} max={360} onChange={v => setBg({ ...bg, angle: v })} unit="°" />
        </>)}
        {bg.kind === 'image' && (<>
          <div className="flex flex-wrap items-center gap-2 pl-[104px]">
            <Button onClick={() => bgFile.current?.click()}>{bg.src ? 'Інше фото' : 'Обрати фото'}</Button>
            <input ref={bgFile} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) p.onBgFile(f); e.target.value = ''; }} />
          </div>
          <p className="pl-[104px] text-xs text-muted">Фото лишається на твоєму пристрої й нікуди не відправляється.</p>
          <Range label="Ліво, право" value={bg.posX} min={0} max={100} onChange={v => setBg({ ...bg, posX: v })} unit="%" />
          <Range label="Верх, низ" value={bg.posY} min={0} max={100} onChange={v => setBg({ ...bg, posY: v })} unit="%" />
          <Range label="Масштаб" value={bg.zoom} min={1} max={3} step={0.05} onChange={v => setBg({ ...bg, zoom: v })} />
          <Color label="Затемнення" value={bg.overlay} onChange={c => setBg({ ...bg, overlay: c })} />
          <Range label="Сила" value={Math.round(bg.overlayOpacity * 100)} min={0} max={90} onChange={v => setBg({ ...bg, overlayOpacity: v / 100 })} unit="%" />
          <Color label="Колір під фото" value={bg.color} onChange={c => setBg({ ...bg, color: c })} />
        </>)}
      </Section>

      <Section title="Текст" aside={<Button variant="ghost" className="!px-2 !py-1 text-[13px]" onClick={p.onAddBlock}>+ Блок</Button>}>
        <div className="flex flex-col gap-1">
          {t.blocks.map(x => (
            <button key={x.id} type="button" onClick={() => p.onSelect(x.id)} aria-pressed={x.id === p.selected}
              className="truncate rounded-lg border border-line px-2.5 py-1.5 text-left text-[13px] aria-pressed:border-accent aria-pressed:bg-accent-soft">
              {x.text.replace(/\*\*/g, '').split('\n')[0] || 'Порожній блок'}
            </button>
          ))}
          {!t.blocks.length && <p className="text-[13px] text-muted">Додай текстовий блок, щоб написати текст на кадрі.</p>}
        </div>
        {b ? (<>
          <label className="flex flex-col gap-1 text-[13px] text-muted" htmlFor={`txt-${b.id}`}>
            Текст блоку
            <textarea id={`txt-${b.id}`} rows={4} value={b.text} onChange={e => p.onBlock(b.id, { text: e.target.value })}
              className="w-full resize-y rounded-lg border border-line bg-soft px-2.5 py-2 text-[15px] text-ink" />
          </label>
          <p className="-mt-1 text-xs text-muted"><code>**слово**</code> жирним, <code>{'{n}/{total}'}</code> номер слайду.</p>
          <Select label="Шрифт" value={b.fontFamily} onChange={v => p.onBlock(b.id, { fontFamily: v })}
            options={allFonts().map(f => ({ value: f.family, label: f.source === 'system' ? `${f.label} · системний` : f.label }))} key={p.fontsVersion} />
          <div className="pl-[104px]">
            <Button variant="ghost" className="!px-0 text-[13px] text-accent" onClick={() => fontFile.current?.click()}>+ Свій шрифт з комп’ютера</Button>
            <input ref={fontFile} type="file" accept=".woff2,.woff,.ttf,.otf" hidden onChange={e => { const f = e.target.files?.[0]; if (f) p.onFontFile(f); e.target.value = ''; }} />
          </div>
          <Range label="Розмір" value={b.fontSize} min={12} max={240} onChange={v => p.onBlock(b.id, { fontSize: v })} unit="px" />
          <Select label="Жирність" value={b.fontWeight} options={WEIGHTS} onChange={v => p.onBlock(b.id, { fontWeight: v })} />
          <Segmented label="Накреслення" value={b.italic ? 'i' : 'n'} onChange={v => p.onBlock(b.id, { italic: v === 'i' })}
            options={[{ value: 'n', label: 'Пряме' }, { value: 'i', label: <i>Курсив</i> }]} />
          <Range label="Міжрядковий" value={b.lineHeight} min={0.8} max={2.2} step={0.02} onChange={v => p.onBlock(b.id, { lineHeight: v })} />
          <Range label="Між літерами" value={b.letterSpacing} min={-10} max={30} step={0.5} onChange={v => p.onBlock(b.id, { letterSpacing: v })} unit="px" />
          <Segmented<Align> label="Вирівнювання" value={b.align} onChange={v => p.onBlock(b.id, { align: v })}
            options={[{ value: 'left', label: 'Ліво' }, { value: 'center', label: 'Центр' }, { value: 'right', label: 'Право' }]} />
          <Color label="Колір тексту" value={b.color} onChange={c => p.onBlock(b.id, { color: c })} />
          <Swatches value={b.color} onPick={c => p.onBlock(b.id, { color: c })} />
          <Range label="Ширина блоку" value={b.width} min={80} max={W - t.padding.x * 2} onChange={v => p.onBlock(b.id, { width: v })} unit="px" />
          <Range label="Позиція X" value={b.x} min={0} max={W} onChange={v => p.onBlock(b.id, { x: v })} unit="px" />
          <Range label="Позиція Y" value={b.y} min={0} max={H} onChange={v => p.onBlock(b.id, { y: v })} unit="px" />
          <div className="flex gap-2 pl-[104px]">
            <Button onClick={() => p.onDuplicateBlock(b.id)}>Дублювати</Button>
            <Button variant="danger" onClick={() => p.onDeleteBlock(b.id)}>Видалити блок</Button>
          </div>
        </>) : !im && t.blocks.length > 0 && <p className="text-[13px] text-muted">Натисни на текст чи фото в кадрі або на блок у списку, щоб його налаштувати.</p>}
      </Section>
    </aside>
  );
}
