import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as RPE } from 'react';
import { FORMATS } from '../lib/formats';
import { drawFrame, type BlockLayout, type ImageMap, type SlideVars } from '../lib/render';
import type { ImageBlock, Template, TextBlock } from '../lib/types';

interface Props {
  t: Template;
  imgs: ImageMap;
  vars: SlideVars;
  fontTick: number;
  selected: string | null;
  guides: boolean;
  onSelect: (id: string | null) => void;
  onBlock: (id: string, patch: Partial<TextBlock>) => void;
  onImage: (id: string, patch: Partial<ImageBlock>) => void;
  onLayouts: (l: Record<string, BlockLayout>) => void;
  onEditText: (id: string) => void;
}

type Drag = { id: string; mode: 'move' | 'width' | 'resize'; target: 'text' | 'image'; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number };

export function Frame({ t, imgs, vars, fontTick, selected, guides, onSelect, onBlock, onImage, onLayouts, onEditText }: Props) {
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
    const L = drawFrame(cv.current, t, imgs, vars);
    setLayouts(L); onLayouts(L);
  }, [t, imgs, vars, fontTick, onLayouts]);

  const down = (e: RPE, id: string, target: Drag['target'], mode: Drag['mode']) => {
    e.stopPropagation(); e.preventDefault();
    const b = target === 'text' ? t.blocks.find(x => x.id === id) : t.images?.find(x => x.id === id);
    if (!b) return;
    onSelect(id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id, mode, target, sx: e.clientX, sy: e.clientY, ox: b.x, oy: b.y, ow: b.width, oh: 'height' in b ? b.height : 0 };
  };
  const move = (e: RPE) => {
    const d = drag.current; if (!d) return;
    const dx = (e.clientX - d.sx) / scale, dy = (e.clientY - d.sy) / scale;
    const set = d.target === 'text' ? onBlock : onImage;
    if (d.mode === 'move') set(d.id, { x: Math.round(d.ox + dx), y: Math.round(d.oy + dy) });
    else if (d.mode === 'width') onBlock(d.id, { width: Math.max(80, Math.round(d.ow + dx)) });
    else onImage(d.id, { width: Math.max(60, Math.round(d.ow + dx)), height: Math.max(60, Math.round(d.oh + dy)) });
  };
  const up = () => { drag.current = null; };

  const key = (e: KeyboardEvent, id: string, target: Drag['target']) => {
    const b = target === 'text' ? t.blocks.find(x => x.id === id) : t.images?.find(x => x.id === id);
    if (!b) return;
    const step = e.shiftKey ? 20 : 4;
    const m: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (m[e.key]) { e.preventDefault(); (target === 'text' ? onBlock : onImage)(id, { x: b.x + m[e.key][0], y: b.y + m[e.key][1] }); }
  };

  const px = t.padding.x * scale, py = t.padding.y * scale;
  const ring = (sel: boolean) => (sel ? 'outline-2 outline-[#3B82F6]' : 'hover:outline hover:outline-1 hover:outline-[#3B82F6]/60');
  const handle = 'absolute touch-none rounded-sm border border-white bg-[#3B82F6]';
  return (
    <div ref={box} className="checker relative flex h-[min(70vh,135vw)] min-h-[320px] items-center justify-center overflow-hidden lg:h-auto lg:min-h-0 lg:flex-1"
      onPointerDown={() => onSelect(null)}>
      <div className="relative shadow-[0_18px_50px_rgba(20,22,34,.18)]" style={{ width: W * scale, height: H * scale }}>
        <canvas ref={cv} width={W} height={H} className="block size-full" aria-label={`Кадр поста ${W}×${H}`} />
        {guides && (
          <div className="pointer-events-none absolute border border-dashed border-white/60 mix-blend-difference"
            style={{ left: px, top: py, right: px, bottom: py }} aria-hidden="true" />
        )}
        {(t.images ?? []).map(im => {
          const sel = im.id === selected;
          return (
            <div key={im.id} role="button" tabIndex={0} aria-label="Фото-блок. Стрілки рухають фото"
              onPointerDown={e => down(e, im.id, 'image', 'move')} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
              onKeyDown={e => key(e, im.id, 'image')} onFocus={() => onSelect(im.id)}
              className={`absolute cursor-move touch-none ${ring(sel)}`}
              style={{ left: im.x * scale, top: im.y * scale, width: im.width * scale, height: im.height * scale, borderRadius: im.radius * scale }}>
              {!imgs[im.src] && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-medium text-[#4D5270]/70">Фото</span>}
              {sel && (
                <span onPointerDown={e => down(e, im.id, 'image', 'resize')} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
                  title="Тягни, щоб змінити розмір" aria-hidden="true" className={`${handle} -right-1.5 -bottom-1.5 size-3.5 cursor-nwse-resize`} />
              )}
            </div>
          );
        })}
        {t.blocks.map(b => {
          const h = (layouts[b.id]?.height ?? b.fontSize * b.lineHeight) * scale;
          const sel = b.id === selected;
          return (
            <div key={b.id} role="button" tabIndex={0} aria-label={`Текстовий блок: ${b.text.slice(0, 40) || 'порожній'}. Стрілки рухають блок, Enter відкриває текст`}
              onPointerDown={e => down(e, b.id, 'text', 'move')} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onEditText(b.id); } else key(e, b.id, 'text'); }} onFocus={() => onSelect(b.id)}
              onDoubleClick={() => onEditText(b.id)} title="Подвійний клік, щоб змінити текст"
              className={`absolute cursor-move touch-none rounded-[2px] ${ring(sel)}`}
              style={{ left: b.x * scale, top: b.y * scale, width: b.width * scale, height: Math.max(h, 8) }}>
              {sel && (
                <span onPointerDown={e => down(e, b.id, 'text', 'width')} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
                  title="Тягни, щоб змінити ширину" aria-hidden="true" className={`${handle} top-1/2 -right-1.5 h-6 w-3 -translate-y-1/2 cursor-ew-resize`} />
              )}
            </div>
          );
        })}
      </div>
      <div className="pointer-events-none absolute bottom-2 left-3 text-xs text-muted tabular-nums">{W}×{H} · {Math.round(scale * 100)}%</div>
    </div>
  );
}
