import { FORMATS } from './formats';
import type { Template, TextBlock } from './types';

/** Усі шаблони з src/templates/*.json. Щоб додати новий, поклади туди файл JSON. */
const files = import.meta.glob('../templates/*.json', { eager: true, import: 'default' }) as Record<string, Template>;

// Порядок у списку задає назва файлу: 1-..., 2-..., 3-...
export const BUILTIN: Template[] = Object.entries(files)
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([, t]) => t)
  .filter(isTemplate);

export const uid = () => Math.random().toString(36).slice(2, 9);
export const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

export function isTemplate(t: unknown): t is Template {
  const o = t as Template;
  return !!o && typeof o.id === 'string' && typeof o.name === 'string' && o.format in FORMATS
    && !!o.background && Array.isArray(o.blocks) && !!o.padding;
}

/** Шлях до фону з public/ з урахуванням адреси сайту на GitHub Pages. */
export function assetUrl(src: string): string {
  if (/^(blob:|data:|https?:)/.test(src)) return src;
  return import.meta.env.BASE_URL + src.replace(/^\//, '');
}

/** JSON для репозиторію: тимчасові фото з комп’ютера в нього не потрапляють. */
export function templateToJson(t: Template): string {
  const out = clone(t);
  if (out.background.kind === 'image' && /^(blob:|data:)/.test(out.background.src)) out.background.src = '';
  return JSON.stringify(out, null, 2) + '\n';
}

export function blankBlock(t: Template, patch: Partial<TextBlock> = {}): TextBlock {
  const W = FORMATS[t.format].w;
  return {
    id: uid(), text: 'Новий текст', x: t.padding.x, y: t.padding.y + 40, width: W - t.padding.x * 2,
    fontFamily: 'Onest', fontSize: 56, fontWeight: 600, italic: false, lineHeight: 1.2, letterSpacing: 0,
    align: 'left', color: '#4D5270', ...patch,
  };
}

/** Тримає блоки всередині відступів після зміни формату, ширини чи відступів. */
export function clampBlocks(t: Template, heights: Record<string, number> = {}): Template {
  const { w: W, h: H } = FORMATS[t.format];
  const px = t.padding.x, py = t.padding.y;
  return {
    ...t,
    blocks: t.blocks.map(b => {
      const width = Math.min(b.width, W - px * 2);
      const hgt = heights[b.id] ?? b.fontSize * b.lineHeight;
      return {
        ...b, width,
        x: Math.min(Math.max(b.x, px), W - px - width),
        y: Math.min(Math.max(b.y, py), Math.max(py, H - py - hgt)),
      };
    }),
  };
}
