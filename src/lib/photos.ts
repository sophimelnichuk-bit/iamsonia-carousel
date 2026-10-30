import type { PhotoInfo } from './types';

/**
 * Фото для постів зберігаються в IndexedDB браузера на цьому пристрої.
 * Нікуди не відправляються і не потрапляють у репозиторій.
 */
const DB = 'iamsonia-studio';
const STORE = 'photos';
const urls = new Map<string, string>();

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((res, rej) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** Завантажує в пам’ять усі збережені фото. Повертає кількість. */
export async function loadAllPhotos(): Promise<number> {
  try {
    const keys = (await tx('readonly', s => s.getAllKeys())) as string[];
    for (const k of keys) {
      if (urls.has(k)) continue;
      const blob = (await tx('readonly', s => s.get(k))) as Blob | undefined;
      if (blob) urls.set(k, URL.createObjectURL(blob));
    }
    return keys.length;
  } catch {
    return 0;
  }
}

export const photoUrl = (id: string) => urls.get(id) ?? '';

/** Зменшує фото до 2400 px по довшій стороні і зберігає на пристрої. */
export async function addPhoto(file: File): Promise<PhotoInfo> {
  let blob: Blob = file, w = 0, h = 0;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
    w = Math.round(bmp.width * k); h = Math.round(bmp.height * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
    blob = await new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('jpeg'))), 'image/jpeg', 0.9));
  } catch {
    const url = URL.createObjectURL(file);
    const im = new Image(); im.src = url;
    await im.decode().catch(() => undefined);
    w = im.naturalWidth || 1080; h = im.naturalHeight || 1350;
    URL.revokeObjectURL(url);
  }
  const id = newId();
  try { await tx('readwrite', s => s.put(blob, id)); } catch { /* сховище недоступне: фото житиме до перезавантаження */ }
  urls.set(id, URL.createObjectURL(blob));
  return { id, w, h };
}

export async function deletePhotos(ids: string[]) {
  for (const id of ids) {
    try { await tx('readwrite', s => s.delete(id)); } catch { /* немає сховища */ }
    const u = urls.get(id); if (u) URL.revokeObjectURL(u);
    urls.delete(id);
  }
}

/** Прибирає фото, які не потрібні жодному посту (наприклад, після видалення поста в минулий раз). */
export async function cleanupPhotos(keep: Set<string>) {
  try {
    const keys = (await tx('readonly', s => s.getAllKeys())) as string[];
    await deletePhotos(keys.filter(k => !keep.has(k)));
  } catch { /* немає сховища */ }
}
