import { useEffect, useRef } from 'react';
import { drawFrame, type ImageMap } from '../lib/render';
import type { SlideKind, Template } from '../lib/types';
import { Button } from './ui';

function Thumb({ s, imgs, n, total, tick }: { s: Template; imgs: ImageMap; n: number; total: number; tick: number }) {
  const c = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (c.current) drawFrame(c.current, s, imgs, { n, total }); }, [s, imgs, n, total, tick]);
  return <canvas ref={c} className="block h-auto w-full rounded-[5px]" aria-hidden="true" />;
}

interface Props {
  slides: Template[];
  imgs: ImageMap;
  tick: number;
  current: number;
  onPick: (i: number) => void;
  onAdd: (kind: SlideKind) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (d: number) => void;
}

export function SlideStrip({ slides, imgs, tick, current, onPick, onAdd, onDuplicate, onDelete, onMove }: Props) {
  const n = slides.length;
  return (
    <div className="border-b border-line bg-panel px-3 py-2">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {slides.map((s, i) => (
          <button key={s.id} type="button" onClick={() => onPick(i)} aria-current={i === current} aria-label={`Слайд ${i + 1}: ${s.name}`}
            className={`w-16 shrink-0 rounded-lg border-2 p-0.5 ${i === current ? 'border-accent' : 'border-transparent hover:border-line'}`}>
            <Thumb s={s} imgs={imgs} n={i + 1} total={n} tick={tick} />
            <span className="mt-0.5 block text-center text-[11px] text-muted tabular-nums">{i + 1}</span>
          </button>
        ))}
        <label className="sr-only" htmlFor="add-slide">Додати слайд</label>
        <select id="add-slide" value="" onChange={e => { if (e.target.value) onAdd(e.target.value as SlideKind); }}
          className="shrink-0 rounded-lg border border-dashed border-line bg-soft px-2 py-2 text-[13px]">
          <option value="">+ Слайд</option>
          <option value="text">Текст</option>
          <option value="photo">Фото і текст</option>
          <option value="cover">Обкладинка</option>
          <option value="cta">Заклик до дії</option>
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[13px]">
        <span className="mr-1 text-muted">Слайд {current + 1} з {n}</span>
        <Button variant="ghost" className="!px-2 !py-1" onClick={() => onMove(-1)} disabled={current === 0} aria-label="Перемістити ліворуч">←</Button>
        <Button variant="ghost" className="!px-2 !py-1" onClick={() => onMove(1)} disabled={current === n - 1} aria-label="Перемістити праворуч">→</Button>
        <Button variant="ghost" className="!px-2 !py-1" onClick={onDuplicate}>Дублювати</Button>
        <Button variant="danger" className="!px-2 !py-1" onClick={onDelete} disabled={n === 1}>Видалити</Button>
      </div>
    </div>
  );
}
