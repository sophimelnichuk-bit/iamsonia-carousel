import { canvasFont } from './fonts';
import { FORMATS } from './formats';
import { photoUrl } from './photos';
import type { Background, ImageBlock, Template, TextBlock } from './types';

export interface Token { text: string; bold: boolean; w: number; space: boolean }
export interface BlockLayout { lines: Token[][]; widths: number[]; height: number }
export interface SlideVars { n: number; total: number }
export type ImageMap = Record<string, HTMLImageElement>;

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

/** {n} і {total} у тексті стають номером слайду і кількістю слайдів. */
export function fillVars(text: string, v: SlideVars): string {
  return text.replace(/\{n\}/g, String(v.n)).replace(/\{total\}/g, String(v.total));
}

/** Текст між ** і ** малюється жирнішим. */
export function parseRuns(text: string): { text: string; bold: boolean }[] {
  return text.split('**').map((t, i) => ({ text: t, bold: i % 2 === 1 })).filter(r => r.text);
}
export const stripMarks = (t: string) => t.replace(/\*\*/g, '');
export const boldWeight = (w: number) => (w >= 700 ? 900 : 800);
const fontFor = (b: TextBlock, bold: boolean) => canvasFont({ ...b, fontWeight: bold ? boldWeight(b.fontWeight) : b.fontWeight });

/** Шлях до зображення: фото з пристрою ("photo:<id>") або файл із public/. */
export function resolveSrc(src: string): string {
  if (!src) return '';
  if (src.startsWith('photo:')) return photoUrl(src.slice(6));
  if (/^(blob:|data:|https?:)/.test(src)) return src;
  return import.meta.env.BASE_URL + src.replace(/^\//, '');
}

/** Переносить текст по словах у межах ширини блоку, з урахуванням жирних слів. */
export function layoutBlock(ctx: Ctx, b: TextBlock, vars: SlideVars = { n: 1, total: 1 }): BlockLayout {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${b.letterSpacing}px`;
  ctx.font = fontFor(b, false);
  const spaceW = ctx.measureText(' ').width;
  const lines: Token[][] = [], widths: number[] = [];
  for (const para of fillVars(b.text || '', vars).split('\n')) {
    const toks: Token[] = [];
    let pending = false;
    for (const r of parseRuns(para)) {
      ctx.font = fontFor(b, r.bold);
      for (const part of r.text.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) { pending = true; continue; }
        if (ctx.measureText(part).width <= b.width) {
          toks.push({ text: part, bold: r.bold, w: ctx.measureText(part).width, space: toks.length > 0 && pending });
        } else {
          // слово ширше за блок: ріжемо по літерах
          let chunk = '', first = true;
          for (const ch of part) {
            if (ctx.measureText(chunk + ch).width > b.width && chunk) {
              toks.push({ text: chunk, bold: r.bold, w: ctx.measureText(chunk).width, space: first && toks.length > 0 && pending });
              chunk = ''; first = false;
            }
            chunk += ch;
          }
          if (chunk) toks.push({ text: chunk, bold: r.bold, w: ctx.measureText(chunk).width, space: first && toks.length > 0 && pending });
        }
        pending = false;
      }
    }
    let line: Token[] = [], lw = 0;
    for (const t of toks) {
      const add = (line.length && t.space ? spaceW : 0) + t.w;
      if (line.length && lw + add > b.width) { lines.push(line); widths.push(lw); line = [{ ...t, space: false }]; lw = t.w; }
      else { line.push(line.length ? t : { ...t, space: false }); lw += add; }
    }
    lines.push(line); widths.push(lw);
  }
  return { lines, widths, height: Math.max(1, lines.length) * b.fontSize * b.lineHeight };
}

function cover(ctx: Ctx, img: HTMLImageElement, x: number, y: number, W: number, H: number, posX: number, posY: number, zoom: number) {
  const s = Math.max(W / img.naturalWidth, H / img.naturalHeight) * (zoom || 1);
  const w = img.naturalWidth * s, h = img.naturalHeight * s;
  ctx.drawImage(img, x + (W - w) * (posX / 100), y + (H - h) * (posY / 100), w, h);
}

function drawBackground(ctx: Ctx, bg: Background, W: number, H: number, imgs: ImageMap) {
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
  const img = imgs[bg.src];
  if (img && img.naturalWidth) cover(ctx, img, 0, 0, W, H, bg.posX, bg.posY, bg.zoom);
  if (bg.overlayOpacity > 0) {
    ctx.globalAlpha = bg.overlayOpacity; ctx.fillStyle = bg.overlay; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  }
}

function drawImageBlock(ctx: Ctx, b: ImageBlock, imgs: ImageMap) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.width, b.height, Math.min(b.radius, b.width / 2, b.height / 2));
  ctx.clip();
  const img = imgs[b.src];
  if (img && img.naturalWidth) cover(ctx, img, b.x, b.y, b.width, b.height, b.posX, b.posY, b.zoom);
  else { ctx.fillStyle = 'rgba(77,82,112,.18)'; ctx.fillRect(b.x, b.y, b.width, b.height); }
  ctx.restore();
}

/** Малює кадр у точному розмірі формату. Ця сама функція працює і для прев’ю, і для PNG. */
export function drawFrame(canvas: HTMLCanvasElement, t: Template, imgs: ImageMap, vars: SlideVars = { n: 1, total: 1 }): Record<string, BlockLayout> {
  const { w: W, h: H } = FORMATS[t.format];
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext('2d') as Ctx;
  ctx.clearRect(0, 0, W, H);
  drawBackground(ctx, t.background, W, H, imgs);
  for (const im of t.images ?? []) drawImageBlock(ctx, im, imgs);
  const layouts: Record<string, BlockLayout> = {};
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  for (const b of t.blocks) {
    const L = layoutBlock(ctx, b, vars);
    layouts[b.id] = L;
    ctx.fillStyle = b.color;
    const lh = b.fontSize * b.lineHeight;
    const base = (lh - b.fontSize) / 2 + b.fontSize * 0.8;
    ctx.font = fontFor(b, false);
    const spaceW = ctx.measureText(' ').width;
    L.lines.forEach((line, i) => {
      let x = b.align === 'left' ? b.x : b.align === 'center' ? b.x + (b.width - L.widths[i]) / 2 : b.x + b.width - L.widths[i];
      for (const tk of line) {
        if (tk.space) x += spaceW;
        ctx.font = fontFor(b, tk.bold);
        ctx.fillText(tk.text, x, b.y + i * lh + base);
        x += tk.w;
      }
    });
  }
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  return layouts;
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('Не вдалося створити PNG'))), 'image/png'));
}

/** Кеш зображень: один запит на кожне фото, повторно не вантажимо. */
const cache = new Map<string, Promise<HTMLImageElement | null>>();
export function loadImage(src: string): Promise<HTMLImageElement | null> {
  const url = resolveSrc(src);
  if (!url) return Promise.resolve(null);
  const key = src + '|' + url;
  let p = cache.get(key);
  if (!p) {
    p = new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = url; });
    cache.set(key, p);
  }
  return p;
}

export function slideSrcs(t: Template): string[] {
  const s = (t.images ?? []).map(i => i.src);
  if (t.background.kind === 'image' && t.background.src) s.push(t.background.src);
  return s.filter(Boolean);
}

export async function loadSlideImages(slides: Template[]): Promise<ImageMap> {
  const srcs = [...new Set(slides.flatMap(slideSrcs))];
  const out: ImageMap = {};
  await Promise.all(srcs.map(async s => { const im = await loadImage(s); if (im) out[s] = im; }));
  return out;
}
