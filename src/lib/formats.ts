import type { FormatId } from './types';

export const FORMATS: Record<FormatId, { w: number; h: number; label: string; hint: string }> = {
  feed: { w: 1080, h: 1350, label: 'Стрічка', hint: '1080×1350' },
  square: { w: 1080, h: 1080, label: 'Квадрат', hint: '1080×1080' },
  story: { w: 1080, h: 1920, label: 'Stories / Reels', hint: '1080×1920' },
};

export const FORMAT_IDS = Object.keys(FORMATS) as FormatId[];
