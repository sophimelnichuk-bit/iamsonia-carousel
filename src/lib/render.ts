import { canvasFont } from './fonts';
import { FORMATS } from './formats';
import type { Background, Template, TextBlock } from './types';

export interface BlockLayout {
  lines: string[];
  height: number;
}

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

/** Переносить текст по словах у межах ширини блоку. Порожній рядок у тексті лишається порожнім рядком. */
export function layoutBlock(ctx: Ctx, b: TextBlock): BlockLayout {
  ctx.font = canvasFont(b);
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${b.letterSpacing}px`;
  const out: string[] = [];
  const fits = (s: string) => ctx.measureText(s).width <= b.width;
  for (const para of (b.text || '').split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(''); continue; }
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (fits(next)) { line = next; continue; }
      if (line) out.push(line);
      if (fits(w)) { line = w; continue; }
      // слово довше за ширину блоку: ріжемо по літерах
      let part = '';
      for (const ch of w) {
        if (fits(part + ch)) part += ch;
        else { out.push(part); part = ch; }
      }
      line = part;
    }
    out.push(line);
  }
  return { lines: out, height: Math.max(1, out.length) * b.fontSize * b.lineHeight };
}

function drawBackground(ctx: Ctx, bg: Background, W: number, H: number, img: HTMLImageElement | null) {
  if (bg.kind === 'solid') { ctx.fillStyle = bg.color; ctx.fillRect(0, 0, W, H); return; }
  if (bg.kind === 'gradient') {
    const a = (bg.angle - 90) * Math.PI / 180;
    const half = Math.abs(W / 2 * Math.cos(a)) + Math.abs(H / 2 * Math.sin(a));
    const cx = W / 2, cy = H / 2, dx = Math.cos(a) * half, dy = Math.sin(a) * half;
    const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    g.addColorStop(0, bg.from); g.addColorStop(1, bg.to);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); return;
  }
  ctx.fillStyle = bg.color; ctx.fillRect(0, 0, W, H);
  if (img && img.naturalWidth) {
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight) * (bg.zoom || 1);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    const x = (W - w) * (bg.posX / 100), y = (H - h) * (bg.posY / 100);
    ctx.drawImage(img, x, y, w, h);
  }
  if (bg.overlayOpacity > 0) {
    ctx.globalAlpha = bg.overlayOpacity; ctx.fillStyle = bg.overlay; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  }
}

/** Малює кадр у точному розмірі формату. Ця сама функція працює і для прев’ю, і для PNG. */
export function drawFrame(canvas: HTMLCanvasElement, t: Template, img: HTMLImageElement | null): Record<string, BlockLayout> {
  const { w: W, h: H } = FORMATS[t.format];
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext('2d') as Ctx;
  ctx.clearRect(0, 0, W, H);
  drawBackground(ctx, t.background, W, H, img);
  const layouts: Record<string, BlockLayout> = {};
  ctx.textBaseline = 'alphabetic';
  for (const b of t.blocks) {
    const L = layoutBlock(ctx, b);
    layouts[b.id] = L;
    ctx.fillStyle = b.color;
    ctx.textAlign = b.align;
    const ax = b.align === 'left' ? b.x : b.align === 'center' ? b.x + b.width / 2 : b.x + b.width;
    const lh = b.fontSize * b.lineHeight;
    // базова лінія: рядок по центру свого міжрядкового інтервалу
    const base = (lh - b.fontSize) / 2 + b.fontSize * 0.8;
    L.lines.forEach((line, i) => ctx.fillText(line, ax, b.y + i * lh + base));
  }
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  return layouts;
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('Не вдалося створити PNG'))), 'image/png'));
}
