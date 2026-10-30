import { FORMATS } from './formats';
import { layoutBlock } from './render';
import { uid } from './templates';
import type { FormatId, PhotoInfo, Post, SlideKind, Template, TextBlock } from './types';

/** Палітра @iamsonia.psy і колір тексту на кожному фоні. */
export const PAL = { sage: '#6D9286', powder: '#FAF1F0', blue: '#CBE8FF', navy: '#4D5270' } as const;
type PalKey = keyof typeof PAL;
const INK: Record<PalKey, string> = { sage: '#FAF1F0', powder: '#4D5270', blue: '#4D5270', navy: '#FAF1F0' };
const CYCLE: PalKey[] = ['powder', 'sage', 'blue', 'navy'];
const HANDLE = '@iamsonia.psy';

export const DEFAULT_CTA = {
  heading: 'Впізнаєш себе?',
  body: 'Розберемо твою ситуацію на онлайн-консультації. Запис у Direct або за посиланням у шапці профілю.',
  button: 'Запис у Direct →',
};

export interface ComposeInput {
  text: string;
  photos: PhotoInfo[];
  format: FormatId;
  caption: string;
  cta: { heading: string; body: string; button: string };
}

export interface Chunk { heading: string; body: string }
export interface SplitPlan { hook: string; hookBody: string; slides: Chunk[]; cta: string }

/** Скільки символів тексту вміщається на слайд у кожному форматі. */
const BUDGET: Record<FormatId, number> = { feed: 300, square: 220, story: 380 };
const MAX_CONTENT_SLIDES = 17; // разом з обкладинкою і закликом Instagram дозволяє до 20
const CTA_RE = /(запис|консультац|direct|дірект|шапці профілю|посилання в профілі|пиши мені|напиши мені|пишіть)/i;

const sentences = (p: string) => p.replace(/\s+/g, ' ').split(/(?<=[.!?…])\s+(?=[«"„(]?[A-ZА-ЯІЇЄҐ0-9])/u).map(s => s.trim()).filter(Boolean);
const upFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const cleanHeading = (s: string) => s.trim().replace(/[.,:;]+$/, '');
/** Короткий рядок без крапки в кінці схожий на підзаголовок. */
const looksLikeHeading = (p: string) => p.length <= 70 && !p.includes('\n') && !/[.…]$/.test(p);

/** Заголовок слайду: перше коротке речення або початок до коми. */
function deriveHeading(text: string): Chunk {
  if (text.includes('\n')) {
    const [first, ...rest] = text.split('\n');
    if (first.length <= 75 && rest.length) return { heading: cleanHeading(first), body: rest.join('\n').trim() };
  }
  const s = sentences(text);
  if (s.length >= 2 && s[0].length <= 75) return { heading: cleanHeading(s[0]), body: s.slice(1).join(' ') };
  const cut = text.search(/[,:]\s/);
  if (cut > 12 && cut <= 60 && text.length - cut > 40) return { heading: cleanHeading(text.slice(0, cut)), body: upFirst(text.slice(cut + 1).trim()) };
  return { heading: '', body: text };
}

/** Ділить довгий абзац на частини, що вміщаються на слайд, не розриваючи речень. */
function pieces(p: string, budget: number): string[] {
  if (p.length <= budget) return [p];
  const units = p.includes('\n') ? p.split('\n').filter(Boolean) : sentences(p);
  const out: string[] = [];
  let cur = '';
  for (const u of units) {
    const joined = cur ? cur + (p.includes('\n') ? '\n' : ' ') + u : u;
    if (cur && joined.length > budget) { out.push(cur); cur = u; } else cur = joined;
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * Розкладає готовий текст на карусель: хук для обкладинки, слайди із заголовками
 * і заклик до дії, якщо останній абзац схожий на нього. «---» примусово починає новий слайд.
 */
export function autoSplit(text: string, f: FormatId): SplitPlan {
  const budget = BUDGET[f];
  let paras = text.replace(/\r/g, '').split(/^\s*-{3,}\s*$/m)
    .flatMap(part => part.split(/\n\s*\n+/)).map(p => p.trim()).filter(Boolean);
  if (paras.length === 1 && paras[0].includes('\n')) paras = paras[0].split('\n').map(l => l.trim()).filter(Boolean);
  if (!paras.length) return { hook: '', hookBody: '', slides: [], cta: '' };

  let cta = '';
  if (paras.length > 1 && CTA_RE.test(paras[paras.length - 1]) && paras[paras.length - 1].length <= 320) cta = paras.pop()!;

  // хук: перше питання або перше речення першого абзацу; коротке продовження стає підзаголовком обкладинки
  const first = paras.shift()!;
  const fs = sentences(first);
  let hook = first, hookBody = '';
  if (fs.length > 1) {
    hook = fs.find(x => x.endsWith('?') && x.length <= 160) ?? fs[0];
    const rest = fs.filter(x => x !== hook).join(' ');
    if (rest.length <= 120 && fs.indexOf(hook) === 0) hookBody = rest;
    else if (rest) paras.unshift(rest);
  }
  hook = hook.replace(/\.$/, '');

  const slides: Chunk[] = [];
  let pending = '';
  paras.forEach((p, i) => {
    if (looksLikeHeading(p) && i < paras.length - 1 && !pending) { pending = cleanHeading(p); return; }
    pieces(p, budget).forEach((piece, j) => {
      if (j === 0 && pending) slides.push({ heading: pending, body: piece });
      else slides.push(deriveHeading(piece));
    });
    pending = '';
  });
  if (pending) slides.push({ heading: pending, body: '' });

  // забагато слайдів: зливаємо сусідні
  while (slides.length > MAX_CONTENT_SLIDES) {
    let k = 0, best = Infinity;
    for (let i = 0; i < slides.length - 1; i++) {
      const len = slides[i].body.length + slides[i + 1].body.length;
      if (len < best) { best = len; k = i; }
    }
    const a = slides[k], b = slides[k + 1];
    slides.splice(k, 2, { heading: a.heading || b.heading, body: [a.body, b.heading && a.heading ? b.heading + '.' : '', b.body].filter(Boolean).join(' ') });
  }
  return { hook, hookBody, slides, cta };
}

/** Старий ручний поділ: порожній рядок або «---», перший рядок слайду стає заголовком. */
export function splitSlides(text: string): Chunk[] {
  return text.replace(/\r/g, '').replace(/^\s*-{3,}\s*$/gm, '\n').split(/\n\s*\n+/)
    .map(c => c.trim()).filter(Boolean)
    .map(c => { const [h, ...rest] = c.split('\n'); return { heading: h.trim(), body: rest.join('\n').trim() }; });
}

const padFor = (f: FormatId) => (f === 'story' ? { x: 90, y: 220 } : { x: 80, y: 80 });

let mctx: CanvasRenderingContext2D | null = null;
const measure = (b: TextBlock) => {
  mctx ??= document.createElement('canvas').getContext('2d');
  return layoutBlock(mctx!, b).height;
};
/** Зменшує шрифт, поки текст не влізе у висоту. */
function fit(b: TextBlock, maxH: number, min: number): TextBlock {
  const out = { ...b };
  while (out.fontSize > min && measure(out) > maxH) out.fontSize -= 2;
  return out;
}

const text = (p: Partial<TextBlock> & Pick<TextBlock, 'id' | 'text' | 'x' | 'y' | 'width' | 'color'>): TextBlock => ({
  fontFamily: 'Onest', fontSize: 44, fontWeight: 400, italic: false, lineHeight: 1.38, letterSpacing: 0, align: 'left', ...p,
});

function footer(f: FormatId, ink: string, right: string): TextBlock[] {
  const { w: W, h: H } = FORMATS[f], pad = padFor(f);
  const y = H - pad.y - 36;
  return [
    text({ id: 'handle', text: HANDLE, x: pad.x, y, width: 520, color: ink, fontSize: 30, fontWeight: 600, lineHeight: 1.2, letterSpacing: 1 }),
    text({ id: 'num', text: right, x: W - pad.x - 320, y, width: 320, color: ink, fontSize: 30, fontWeight: 600, lineHeight: 1.2, letterSpacing: 1, align: 'right' }),
  ];
}

const frame = (f: FormatId, kind: SlideKind, name: string, rest: Pick<Template, 'background' | 'blocks'> & Partial<Template>): Template =>
  ({ id: uid(), name, format: f, padding: padFor(f), kind, images: [], ...rest });

export function buildCover(f: FormatId, c: Chunk, photo?: PhotoInfo): Template {
  const { w: W, h: H } = FORMATS[f], pad = padFor(f), inner = W - pad.x * 2;
  const light = '#FAF1F0';
  let bottom = H - pad.y - 36 - 56;
  const blocks: TextBlock[] = [];
  if (c.body) {
    const body = fit(text({ id: 'body', text: c.body, x: pad.x, y: 0, width: inner, color: light, fontSize: 40, fontWeight: 500, lineHeight: 1.3 }), H * 0.16, 28);
    body.y = Math.round(bottom - measure(body)); bottom = body.y - 28; blocks.push(body);
  }
  const head = fit(text({ id: 'heading', text: c.heading, x: pad.x, y: 0, width: inner, color: light, fontSize: f === 'story' ? 112 : 96, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1 }), H * 0.42, 52);
  head.y = Math.round(bottom - measure(head));
  blocks.unshift(head);
  return frame(f, 'cover', 'Обкладинка', {
    background: photo
      ? { kind: 'image', src: `photo:${photo.id}`, color: PAL.navy, overlay: '#1E2030', overlayOpacity: 0.32, posX: 50, posY: 40, zoom: 1 }
      : { kind: 'gradient', from: PAL.sage, to: PAL.navy, angle: 160 },
    blocks: [...blocks, ...footer(f, light, 'гортай →')],
  });
}

export function buildPhoto(f: FormatId, c: Chunk, photo: PhotoInfo | undefined, key: PalKey): Template {
  const { w: W, h: H } = FORMATS[f], pad = padFor(f), inner = W - pad.x * 2, ink = INK[key];
  const imgH = Math.round(H * (f === 'story' ? 0.42 : f === 'square' ? 0.44 : 0.5));
  const blocks: TextBlock[] = [];
  let top = pad.y + imgH + 48;
  if (c.heading) {
    const head = fit(text({ id: 'heading', text: c.heading, x: pad.x, y: top, width: inner, color: ink, fontSize: 64, fontWeight: 800, lineHeight: 1.08, letterSpacing: -0.5 }), H * 0.16, 40);
    blocks.push(head); top = head.y + measure(head) + 22;
  }
  const limit = H - pad.y - 36 - 40 - top;
  if (c.body) blocks.push(fit(text({ id: 'body', text: c.body, x: pad.x, y: Math.round(top), width: inner, color: ink, fontSize: c.heading ? 42 : 48, fontWeight: c.heading ? 400 : 500 }), limit, 26));
  return frame(f, 'photo', 'Фото і текст', {
    background: { kind: 'solid', color: PAL[key] },
    images: [{ id: 'photo', src: photo ? `photo:${photo.id}` : '', x: pad.x, y: pad.y, width: inner, height: imgH, radius: 28, posX: 50, posY: 50, zoom: 1 }],
    blocks: [...blocks, ...footer(f, ink, '{n}/{total}')],
  });
}

export function buildText(f: FormatId, c: Chunk, key: PalKey): Template {
  const { w: W, h: H } = FORMATS[f], pad = padFor(f), inner = W - pad.x * 2, ink = INK[key];
  const start = pad.y + (f === 'story' ? 140 : 70);
  const blocks: TextBlock[] = [];
  let top = start;
  if (c.heading) {
    const head = fit(text({ id: 'heading', text: c.heading, x: pad.x, y: top, width: inner, color: ink, fontSize: f === 'square' ? 70 : 78, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1 }), H * 0.3, 44);
    blocks.push(head); top = head.y + measure(head) + 36;
  }
  const limit = H - pad.y - 36 - 50 - top;
  if (c.body) {
    const size = c.heading ? (f === 'square' ? 42 : 46) : (f === 'square' ? 50 : 56);
    blocks.push(fit(text({ id: 'body', text: c.body, x: pad.x, y: Math.round(top), width: inner, color: ink, fontSize: size, fontWeight: c.heading ? 400 : 500, lineHeight: 1.4 }), limit, 26));
  }
  if (blocks.length) {
    // короткий текст ставимо ближче до центру кадру, щоб не лишалось порожнього низу
    const last = blocks[blocks.length - 1];
    const used = last.y + measure(last) - start;
    const shift = Math.max(0, Math.round((H - used) / 2 - 40 - start));
    blocks.forEach(b => { b.y += shift; });
  }
  return frame(f, 'text', 'Текст', { background: { kind: 'solid', color: PAL[key] }, blocks: [...blocks, ...footer(f, ink, '{n}/{total}')] });
}

export function buildCta(f: FormatId, cta: ComposeInput['cta']): Template {
  const { w: W, h: H } = FORMATS[f], pad = padFor(f), inner = W - pad.x * 2, ink = INK.blue;
  const head = text({ id: 'heading', text: cta.heading, x: pad.x, y: 0, width: inner, color: ink, fontSize: f === 'square' ? 88 : 100, fontWeight: 800, lineHeight: 1.04, letterSpacing: -1.5 });
  const body = text({ id: 'body', text: cta.body, x: pad.x, y: 0, width: inner, color: ink, fontSize: f === 'square' ? 40 : 46, lineHeight: 1.4 });
  const btn = text({ id: 'cta', text: cta.button, x: pad.x, y: 0, width: inner, color: PAL.sage, fontFamily: 'Georgia', fontSize: f === 'square' ? 56 : 66, italic: true, lineHeight: 1.2 });
  const parts = [fit(head, H * 0.28, 52), ...(cta.body ? [fit(body, H * 0.26, 28)] : []), ...(cta.button ? [btn] : [])];
  const gaps = 40, total = parts.reduce((s, b) => s + measure(b), 0) + gaps * (parts.length - 1);
  let y = Math.max(pad.y + 40, Math.round((H - total) / 2 - 30));
  for (const b of parts) { b.y = y; y += measure(b) + gaps; }
  return frame(f, 'cta', 'Заклик до дії', { background: { kind: 'solid', color: PAL.blue }, blocks: [...parts, ...footer(f, ink, '{n}/{total}')] });
}

/** Збирає карусель: обкладинка, слайди з фото або без, заклик до дії. */
export function composePost(input: ComposeInput): Post {
  const plan = autoSplit(input.text, input.format);
  const first: Chunk = { heading: plan.hook || 'Твій хук на обкладинці', body: plan.hookBody };
  const rest = plan.slides;
  const slides: Template[] = [buildCover(input.format, first, input.photos[0])];
  rest.forEach((c, i) => {
    const photo = input.photos[i + 1];
    let key = CYCLE[i % CYCLE.length];
    if (i === rest.length - 1 && key === 'blue') key = 'navy'; // слайд із закликом теж блакитний, не ставимо два поспіль
    slides.push(photo ? buildPhoto(input.format, c, photo, key) : buildText(input.format, c, key));
  });
  // заклик із тексту замінює типовий, якщо його не змінювали у формі
  const cta = plan.cta && input.cta.body === DEFAULT_CTA.body ? { ...input.cta, body: plan.cta } : input.cta;
  slides.push(buildCta(input.format, cta));
  const now = Date.now();
  return {
    id: uid(), name: first.heading.replace(/\*\*/g, '').slice(0, 60) || 'Новий пост', format: input.format, caption: input.caption,
    photos: input.photos, slides, createdAt: now, updatedAt: now,
  };
}

/** Перескладає слайд в іншому макеті, зберігаючи його текст і фото. */
export function relayout(s: Template, kind: SlideKind, photos: PhotoInfo[], index: number): Template {
  const get = (id: string) => s.blocks.find(b => b.id === id)?.text ?? '';
  const body = get('body');
  const heading = s.blocks.some(b => b.id === 'heading') ? get('heading') : (body ? '' : s.blocks[0]?.text ?? '');
  const src = (s.background.kind === 'image' ? s.background.src : '') || s.images?.[0]?.src || '';
  const photo = photos.find(p => `photo:${p.id}` === src) ?? (kind === 'cover' || kind === 'photo' ? photos[0] : undefined);
  const key = (Object.keys(PAL) as PalKey[]).find(k => s.background.kind === 'solid' && PAL[k].toLowerCase() === s.background.color.toLowerCase()) ?? CYCLE[index % CYCLE.length];
  const c = { heading, body };
  const next = kind === 'cover' ? buildCover(s.format, c, photo)
    : kind === 'photo' ? buildPhoto(s.format, c, photo, key)
    : kind === 'text' ? buildText(s.format, c, key)
    : buildCta(s.format, { heading: heading || DEFAULT_CTA.heading, body: body || DEFAULT_CTA.body, button: get('cta') || DEFAULT_CTA.button });
  return { ...next, id: s.id };
}

/** Перескладає всі слайди під новий формат. */
export function reformatPost(p: Post, f: FormatId): Post {
  return { ...p, format: f, slides: p.slides.map((s, i) => relayout({ ...s, format: f }, s.kind ?? 'text', p.photos, Math.max(0, i - 1))) };
}
