export type FormatId = 'feed' | 'square' | 'story';
export type Align = 'left' | 'center' | 'right';

export type Background =
  | { kind: 'solid'; color: string }
  | { kind: 'gradient'; from: string; to: string; angle: number }
  | {
      kind: 'image';
      /** Шлях до файлу в public/ (наприклад "backgrounds/fon.jpg") або тимчасове посилання на файл з комп’ютера. */
      src: string;
      /** Колір під зображенням, поки воно не завантажене. */
      color: string;
      /** Затемнення чи висвітлення поверх фото для читабельності тексту. */
      overlay: string;
      overlayOpacity: number;
      posX: number;
      posY: number;
      zoom: number;
    };

export interface TextBlock {
  id: string;
  text: string;
  /** Координати лівого верхнього кута блоку в пікселях кадру. */
  x: number;
  y: number;
  /** Ширина блоку в пікселях кадру. Текст переноситься всередині. */
  width: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  lineHeight: number;
  letterSpacing: number;
  align: Align;
  color: string;
}

/** Фото в рамці на кадрі: його можна рухати і масштабувати. */
export interface ImageBlock {
  id: string;
  /** "photo:<id>" для фото з пристрою або шлях до файлу в public/. */
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  posX: number;
  posY: number;
  zoom: number;
}

export type SlideKind = 'cover' | 'photo' | 'text' | 'cta';

export interface Template {
  id: string;
  name: string;
  format: FormatId;
  padding: { x: number; y: number };
  background: Background;
  blocks: TextBlock[];
  images?: ImageBlock[];
  /** Макет слайду в пості, щоб його можна було перескласти. */
  kind?: SlideKind;
}

export interface PhotoInfo {
  id: string;
  w: number;
  h: number;
}

/** Пост-карусель: слайди, фото і підпис. Зберігається лише в браузері. */
export interface Post {
  id: string;
  name: string;
  format: FormatId;
  caption: string;
  photos: PhotoInfo[];
  slides: Template[];
  createdAt: number;
  updatedAt: number;
}
