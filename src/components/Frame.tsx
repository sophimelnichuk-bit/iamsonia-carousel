import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPE } from 'react';
import { FORMATS } from '../lib/formats';
import { drawFrame, type BlockLayout } from '../lib/render';
import type { Template } from '../lib/types';

interface Props {
  t: Template;
  img: HTMLImageElement | null;
  fontTick: number;
  selected: string | null;
  guides: boolean;
  onSelect: (id: string | null) => void;
  onBlock: (id: string, patch: { x?: number; y?: number; width?: number }) => void;
  onLayouts: (l: Record<string, BlockLayout>) => void;
}

type Drag = { id: string; mode: 'move' | 'width'; sx: number; sy: number; ox: number; oy: number; ow: number };

export function Frame({ t, img, fontTick, selected, guides, onSelect, onBlock, onLayouts }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const drag = useRef<Drag | null>(null);
  const [scale, setScale] = useState(0.35);
  const [layouts, setLayouts] = useState<Record<string, BlockLayout>>({});
  const { w: W, h: H } = FORMATS[t.format];

  useLayoutEffect(() => {
    const el = box.current; if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      setScale(Math.max(0.05, Math.min((r.width - 40) / W, (r.height - 40) / H, 1)));
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, [W, H]);

  useEffect(() => {
    if (!cv.current) return;
    const L = drawFrame(cv.current, t, img);
    setLayouts(L); onLayouts(L);
  }, [t, img, fontTick, onLayouts]);

  const down = (e: RPE, id: string, mode: Drag['mode']) => {
    e.stopPropagation(); e.preventDefault();
    const b = t.blocks.find(x => x.id === id); if (!b) return;
    onSelect(id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id, mode, sx: e.clientX, sy: e.clientY, ox: b.x, oy: b.y, ow: b.width };
  };
  const move = (e: RPE) => {
    const d = drag.current; if (!d) return;
    const dx = (e.clientX - d.sx) / scale, dy = (e.clientY - d.sy) / scale;
    if (d.mode === 'move') onBlock(d.id, { x: Math.round(d.ox + dx), y: Math.round(d.oy + dy) });
    else onBlock(d.id, { width: Math.max(80, Math.round(d.ow + dx)) });
  };
  const up = () => { drag.current = null; };

  const key = (e: React.KeyboardEvent, id: string) => {
    const b = t.blocks.find(x => x.id === id); if (!b) return;
    const step = e.shiftKey ? 20 : 4;
    const m: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (m[e.key]) { e.preventDefault(); onBlock(id, { x: b.x + m[e.key][0], y: b.y + m[e.key][1] }); }
  };

  const px = t.padding.x * scale, py = t.padding.y * scale;
  return (
    <div ref={box} className="checker relative flex h-[min(70vh,135vw)] min-h-[320px] items-center justify-center overflow-hidden lg:h-auto lg:min-h-0 lg:flex-1"
      onPointerDown={() => onSelect(null)}>
      <div className="relative shadow-[0_18px_50px_rgba(20,22,34,.18)]" style={{ width: W * scale, height: H * scale }}>
        <canvas ref={cv} width={W} height={H} className="block size-full" aria-label={`Кадр поста ${W}×${H}`} />
        {guides && (
          <div className="pointer-events-none absolute border border-dashed border-white/60 mix-blend-difference"
            style={{ left: px, top: py, right: px, bottom: py }} aria-hidden="true" />
        )}
        {t.blocks.map(b => {
          const h = (layouts[b.id]?.height ?? b.fontSize * b.lineHeight) * scale;
          const sel = b.id === selected;
          return (
            <div key={b.id} role="button" tabIndex={0} aria-label={`Текстовий блок: ${b.text.slice(0, 40) || 'порожній'}. Стрілки рухають блок`}
              onPointerDown={e => down(e, b.id, 'move')} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
              onKeyDown={e => key(e, b.id)} onFocus={() => onSelect(b.id)}
              className={`absolute cursor-move touch-none rounded-[2px] outline-offset-0 ${sel ? 'outline-2 outline-[#3B82F6]' : 'hover:outline hover:outline-1 hover:outline-[#3B82F6]/60'}`}
              style={{ left: b.x * scale, top: b.y * scale, width: b.width * scale, height: Math.max(h, 8) }}>
              {sel && (
                <span onPointerDown={e => down(e, b.id, 'width')} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
                  title="Тягни, щоб змінити ширину" aria-hidden="true"
                  className="absolute top-1/2 -right-1.5 h-6 w-3 -translate-y-1/2 cursor-ew-resize touch-none rounded-sm border border-white bg-[#3B82F6]" />
              )}
            </div>
          );
        })}
      </div>
      <div className="pointer-events-none absolute bottom-2 left-3 text-xs text-muted tabular-nums">{W}×{H} · {Math.round(scale * 100)}%</div>
    </div>
  );
}
