import type { TextBlock } from './types';

export interface FontOption {
  /** Значення, яке зберігається в шаблоні. */
  family: string;
  label: string;
  /** CSS-стек із запасними шрифтами. */
  stack: string;
  source: 'open' | 'system' | 'local';
}

export const FONTS: FontOption[] = [
  { family: 'Onest', label: 'Onest', stack: '"Onest", system-ui, sans-serif', source: 'open' },
  { family: 'system-ui', label: 'Системний без зарубок', stack: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', source: 'system' },
  { family: 'Georgia', label: 'Georgia', stack: 'Georgia, "Times New Roman", serif', source: 'system' },
  { family: 'Times New Roman', label: 'Times New Roman', stack: '"Times New Roman", Times, serif', source: 'system' },
  { family: 'Arial', label: 'Arial', stack: 'Arial, Helvetica, sans-serif', source: 'system' },
  { family: 'Courier New', label: 'Courier New', stack: '"Courier New", Courier, monospace', source: 'system' },
];

const local: FontOption[] = [];

/** Свої .woff2 з src/fonts/local/ (не потрапляють у git). Назва файлу стає назвою шрифту. */
const localFiles = import.meta.glob('../fonts/local/*.{woff2,woff,ttf,otf}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export async function registerLocalFonts(): Promise<FontOption[]> {
  const added: FontOption[] = [];
  for (const [path, url] of Object.entries(localFiles)) {
    const family = path.split('/').pop()!.replace(/\.(woff2|woff|ttf|otf)$/i, '');
    added.push(await addFont(family, `url(${url})`));
  }
  return added;
}

/** Додає шрифт із файлу на комп’ютері. Файл нікуди не відправляється. */
export async function addFontFile(file: File): Promise<FontOption> {
  const family = file.name.replace(/\.(woff2|woff|ttf|otf)$/i, '');
  return addFont(family, await file.arrayBuffer());
}

async function addFont(family: string, source: string | ArrayBuffer): Promise<FontOption> {
  const face = new FontFace(family, source, { weight: '100 900' });
  await face.load();
  document.fonts.add(face);
  const opt: FontOption = { family, label: `${family} (свій)`, stack: `"${family}", system-ui, sans-serif`, source: 'local' };
  if (!local.some(f => f.family === family)) local.push(opt);
  return opt;
}

export function allFonts(): FontOption[] {
  return [...FONTS, ...local];
}

export function fontStack(family: string): string {
  return allFonts().find(f => f.family === family)?.stack ?? `"${family}", system-ui, sans-serif`;
}

export function canvasFont(b: Pick<TextBlock, 'fontFamily' | 'fontSize' | 'fontWeight' | 'italic'>): string {
  return `${b.italic ? 'italic ' : ''}${b.fontWeight} ${b.fontSize}px ${fontStack(b.fontFamily)}`;
}

/** Чекає, поки всі шрифти блоків завантажаться. Повертає false, якщо якийсь так і не домалювався. */
export async function ensureFonts(blocks: TextBlock[]): Promise<boolean> {
  try {
    await Promise.all(blocks.map(b => document.fonts.load(canvasFont(b), b.text || 'Аа')));
    await document.fonts.ready;
    return blocks.every(b => fontLoaded(b));
  } catch {
    return false;
  }
}

/** Шрифти з репозиторію та свої шрифти мають бути реально завантажені, системні браузер бере з комп’ютера. */
export function fontLoaded(b: TextBlock): boolean {
  const opt = allFonts().find(f => f.family === b.fontFamily);
  if (opt && opt.source === 'system') return true;
  return document.fonts.check(canvasFont(b), b.text || 'Аа');
}

const ONEST_RANGES: [string, string][] = [
  ['cyrillic', 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116'],
  ['cyrillic-ext', 'U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F'],
  ['latin', 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'],
  ['latin-ext', 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'],
];

/** Відкритий шрифт Onest (SIL OFL 1.1) лежить у public/fonts/onest разом із ліцензією. */
export function registerOpenFont() {
  for (const [subset, range] of ONEST_RANGES) {
    const url = `${import.meta.env.BASE_URL}fonts/onest/onest-${subset}-wght-normal.woff2`;
    document.fonts.add(new FontFace('Onest', `url(${url}) format("woff2")`, { weight: '100 900', style: 'normal', unicodeRange: range, display: 'swap' }));
  }
}
