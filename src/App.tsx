import JSZip from 'jszip';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Frame } from './components/Frame';
import { NewPostForm } from './components/NewPostForm';
import { SettingsPanel, type PostControls } from './components/SettingsPanel';
import { Sidebar } from './components/Sidebar';
import { SlideStrip } from './components/SlideStrip';
import { Button } from './components/ui';
import { buildCover, buildCta, buildPhoto, buildText, DEFAULT_CTA, reformatPost, relayout } from './lib/compose';
import { addFontFile, ensureFonts, fontLoaded, registerLocalFonts } from './lib/fonts';
import { FORMATS } from './lib/formats';
import { addPhoto, deletePhotos, loadAllPhotos } from './lib/photos';
import { canvasToPng, drawFrame, loadImage, loadSlideImages, slideSrcs, type BlockLayout, type ImageMap } from './lib/render';
import { BUILTIN, blankBlock, clampBlocks, clone, isTemplate, templateToJson, uid } from './lib/templates';
import type { FormatId, ImageBlock, PhotoInfo, Post, SlideKind, Template, TextBlock } from './lib/types';

const DRAFTS_KEY = 'studio-drafts';
const POSTS_KEY = 'studio-posts';

function readJson<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || '') as T; } catch { return fallback; }
}
function writeJson(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* сховище браузера недоступне або переповнене */ }
}
function loadDrafts(): Record<string, Template> {
  const o = readJson<Record<string, unknown>>(DRAFTS_KEY, {});
  return Object.fromEntries(Object.entries(o).filter(([, v]) => isTemplate(v))) as Record<string, Template>;
}
function loadPosts(): Record<string, Post> {
  const o = readJson<Record<string, Post>>(POSTS_KEY, {});
  return Object.fromEntries(Object.entries(o).filter(([, p]) => p && Array.isArray(p.slides) && p.slides.every(isTemplate)));
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const fileBase = (p: Post) => `iamsonia-${new Date(p.createdAt).toISOString().slice(0, 10)}`;

type Current = { kind: 'post' | 'template'; id: string };

export default function App() {
  const [library, setLibrary] = useState<Template[]>(BUILTIN);
  const [drafts, setDrafts] = useState<Record<string, Template>>(loadDrafts);
  const [posts, setPosts] = useState<Record<string, Post>>(loadPosts);
  const [current, setCurrent] = useState<Current>(() => {
    const recent = Object.values(loadPosts()).sort((a, b) => b.updatedAt - a.updatedAt)[0];
    return recent ? { kind: 'post', id: recent.id } : { kind: 'template', id: BUILTIN[0]?.id ?? '' };
  });
  const [slideIdx, setSlideIdx] = useState(0);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [guides, setGuides] = useState(true);
  const [fontTick, setFontTick] = useState(0);
  const [fontsVersion, setFontsVersion] = useState(0);
  const [fontsReady, setFontsReady] = useState(false);
  const [photosVersion, setPhotosVersion] = useState(0);
  const [imgs, setImgs] = useState<ImageMap>({});
  const [imgsReady, setImgsReady] = useState(true);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const heights = useRef<Record<string, number>>({});

  const post = current.kind === 'post' ? posts[current.id] ?? null : null;
  const idx = post ? Math.min(slideIdx, post.slides.length - 1) : 0;
  const base = library.find(x => x.id === current.id) ?? library[0];
  const t: Template | undefined = post ? post.slides[idx] : (drafts[current.id] ?? base);
  const vars = useMemo(() => ({ n: idx + 1, total: post ? post.slides.length : 1 }), [idx, post?.slides.length]);

  const edited = useMemo(() => new Set(Object.keys(drafts).filter(id => {
    const b = library.find(x => x.id === id); return b && templateToJson(b) !== templateToJson(drafts[id]);
  })), [drafts, library]);
  const postList = useMemo(() => Object.values(posts).sort((a, b) => b.updatedAt - a.updatedAt), [posts]);

  useEffect(() => { writeJson(DRAFTS_KEY, Object.fromEntries(Object.entries(drafts).map(([k, v]) => [k, JSON.parse(templateToJson(v))]))); }, [drafts]);
  useEffect(() => { writeJson(POSTS_KEY, posts); }, [posts]);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('studio-theme', dark ? 'dark' : 'light'); } catch { /* немає сховища */ }
  }, [dark]);

  useEffect(() => {
    const bump = () => setFontTick(n => n + 1);
    document.fonts.addEventListener('loadingdone', bump);
    registerLocalFonts().then(list => { if (list.length) setFontsVersion(v => v + 1); bump(); }).catch(() => {});
    loadAllPhotos().then(() => setPhotosVersion(v => v + 1));
    return () => document.fonts.removeEventListener('loadingdone', bump);
  }, []);

  // шрифти кадру: кнопки завантаження чекають, поки вони реально завантажаться
  useEffect(() => {
    if (!t) return;
    let live = true;
    setFontsReady(t.blocks.every(fontLoaded));
    ensureFonts(t.blocks).then(ok => { if (live) { setFontsReady(ok); setFontTick(n => n + 1); } });
    return () => { live = false; };
  }, [t?.blocks, fontsVersion]);

  // зображення всіх слайдів поста (для кадру і мініатюр)
  const srcKey = useMemo(() => [...new Set((post ? post.slides : t ? [t] : []).flatMap(slideSrcs))].join('|'), [post, t]);
  useEffect(() => {
    let live = true;
    const srcs = srcKey ? srcKey.split('|') : [];
    setImgsReady(false);
    Promise.all(srcs.map(async s => [s, await loadImage(s)] as const)).then(list => {
      if (!live) return;
      const o: ImageMap = {};
      list.forEach(([s, im]) => { if (im) o[s] = im; });
      setImgs(o); setImgsReady(true);
    });
    return () => { live = false; };
  }, [srcKey, photosVersion]);

  useEffect(() => { if (!note) return; const id = setTimeout(() => setNote(''), 4200); return () => clearTimeout(id); }, [note]);

  const update = useCallback((fn: (t: Template) => Template) => {
    if (current.kind === 'post') {
      setPosts(ps => {
        const p = ps[current.id]; if (!p) return ps;
        const i = Math.min(slideIdx, p.slides.length - 1);
        const slides = [...p.slides];
        slides[i] = clampBlocks(fn(clone(slides[i])), heights.current);
        return { ...ps, [p.id]: { ...p, slides, updatedAt: Date.now() } };
      });
      return;
    }
    setDrafts(d => {
      const curT = d[current.id] ?? library.find(x => x.id === current.id); if (!curT) return d;
      return { ...d, [current.id]: clampBlocks(fn(clone(curT)), heights.current) };
    });
  }, [current, slideIdx, library]);

  const patchPost = useCallback((fn: (p: Post) => Post) => {
    if (current.kind !== 'post') return;
    setPosts(ps => (ps[current.id] ? { ...ps, [current.id]: { ...fn(ps[current.id]), updatedAt: Date.now() } } : ps));
  }, [current]);

  const onLayouts = useCallback((l: Record<string, BlockLayout>) => {
    heights.current = Object.fromEntries(Object.entries(l).map(([k, v]) => [k, v.height]));
  }, []);
  const patchBlock = useCallback((id: string, patch: Partial<TextBlock>) => {
    update(x => ({ ...x, blocks: x.blocks.map(b => (b.id === id ? { ...b, ...patch } : b)) }));
  }, [update]);
  const patchImage = useCallback((id: string, patch: Partial<ImageBlock>) => {
    update(x => ({ ...x, images: (x.images ?? []).map(b => (b.id === id ? { ...b, ...patch } : b)) }));
  }, [update]);

  const setFormat = (f: FormatId) => {
    if (post) { patchPost(p => reformatPost(p, f)); setSelected(null); return; }
    update(x => {
      const r = FORMATS[f].h / FORMATS[x.format].h;
      return { ...x, format: f, blocks: x.blocks.map(b => ({ ...b, y: Math.round(b.y * r) })) };
    });
  };

  const openPost = (id: string) => { setCurrent({ kind: 'post', id }); setSlideIdx(0); setSelected(null); };
  const openTemplate = (id: string) => { setCurrent({ kind: 'template', id }); setSelected(null); };

  const resetCurrent = () => {
    setDrafts(d => { const n = { ...d }; delete n[current.id]; return n; });
    setSelected(null); setNote('Шаблон повернуто до версії з репозиторію');
  };

  const checkReady = async (slides: Template[]) => {
    const ok = await ensureFonts(slides.flatMap(s => s.blocks));
    if (!ok) { setFontsReady(false); setNote('Шрифт ще не завантажився. Зачекай кілька секунд і спробуй знову.'); return null; }
    return loadSlideImages(slides);
  };

  const exportPng = async () => {
    if (!t) return;
    setBusy('png');
    try {
      const map = await checkReady([t]); if (!map) return;
      const c = document.createElement('canvas');
      drawFrame(c, t, map, vars);
      const { w, h } = FORMATS[t.format];
      const name = post ? `${fileBase(post)}-${String(idx + 1).padStart(2, '0')}.png` : `${t.id}-${w}x${h}.png`;
      download(await canvasToPng(c), name);
      setNote(`PNG ${w}×${h} збережено`);
    } catch (e) { setNote(e instanceof Error ? e.message : 'Не вдалося зберегти PNG'); }
    finally { setBusy(''); }
  };

  const exportZip = async () => {
    if (!post) return;
    setBusy('zip');
    try {
      const map = await checkReady(post.slides); if (!map) return;
      const zip = new JSZip();
      const c = document.createElement('canvas');
      for (let i = 0; i < post.slides.length; i++) {
        drawFrame(c, post.slides[i], map, { n: i + 1, total: post.slides.length });
        zip.file(`${String(i + 1).padStart(2, '0')}.png`, await canvasToPng(c));
      }
      if (post.caption.trim()) zip.file('pidpys.txt', post.caption);
      download(await zip.generateAsync({ type: 'blob' }), `${fileBase(post)}.zip`);
      setNote(`Архів із ${post.slides.length} слайдами збережено`);
    } catch (e) { setNote(e instanceof Error ? e.message : 'Не вдалося зберегти архів'); }
    finally { setBusy(''); }
  };

  const exportJson = () => {
    if (!t) return;
    download(new Blob([templateToJson(t)], { type: 'application/json' }), `${t.id}.json`);
    setNote(`Поклади ${t.id}.json у папку src/templates репозиторію`);
  };

  const importJson = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (!isTemplate(data)) throw new Error();
      const taken = library.some(x => x.id === data.id);
      const tpl = taken ? { ...data, id: `${data.id}-${uid()}`, name: `${data.name} (відкритий)` } : data;
      setLibrary(l => [...l, tpl]); openTemplate(tpl.id);
      setNote(`Шаблон «${tpl.name}» відкрито`);
    } catch { setNote('Це не схоже на шаблон. Потрібен JSON, експортований із цього редактора.'); }
  };

  const onBgFile = async (f: File) => {
    if (post) {
      const ph = await addPhoto(f);
      patchPost(p => ({ ...p, photos: [...p.photos, ph] }));
      update(x => x.background.kind === 'image' ? { ...x, background: { ...x.background, src: `photo:${ph.id}` } } : x);
      setPhotosVersion(v => v + 1);
      return;
    }
    const url = URL.createObjectURL(f);
    update(x => x.background.kind === 'image' ? { ...x, background: { ...x.background, src: url } } : x);
  };

  const onFontFile = async (f: File) => {
    try {
      const opt = await addFontFile(f);
      setFontsVersion(v => v + 1);
      if (selected && t?.blocks.some(b => b.id === selected)) patchBlock(selected, { fontFamily: opt.family });
      setNote(`Шрифт «${opt.family}» додано. Він працює, поки відкрита сторінка.`);
    } catch { setNote('Не вдалося відкрити шрифт. Підійдуть файли .woff2, .woff, .ttf або .otf.'); }
  };

  const postControls: PostControls | null = post && t ? {
    post,
    onPost: patch => patchPost(p => ({ ...p, ...patch })),
    onLayout: kind => { update(x => relayout(x, kind, post.photos, Math.max(0, idx - 1))); setSelected(null); },
    onAddPhotos: async files => {
      const added: PhotoInfo[] = [];
      for (const f of [...files]) { try { added.push(await addPhoto(f)); } catch { /* пропускаємо файл, який не відкрився */ } }
      patchPost(p => ({ ...p, photos: [...p.photos, ...added] }));
      setPhotosVersion(v => v + 1);
      if (added.length) setNote(`Додано фото: ${added.length}`);
    },
    onUsePhoto: id => {
      const src = `photo:${id}`;
      const target = t.images?.find(i => i.id === selected) ?? t.images?.[0];
      if (target) { patchImage(target.id, { src, posX: 50, posY: 50, zoom: 1 }); return; }
      update(x => ({
        ...x,
        background: { kind: 'image', src, color: x.background.kind === 'solid' ? x.background.color : '#4D5270', overlay: '#1E2030', overlayOpacity: 0.3, posX: 50, posY: 50, zoom: 1 },
      }));
    },
    onDeletePost: async () => {
      const used = post.photos.map(p => p.id);
      setPosts(ps => { const n = { ...ps }; delete n[post.id]; return n; });
      await deletePhotos(used);
      const next = postList.find(p => p.id !== post.id);
      if (next) openPost(next.id); else openTemplate(library[0]?.id ?? '');
      setNote('Пост видалено');
    },
  } : null;

  const addSlide = (kind: SlideKind) => {
    if (!post) return;
    const f = post.format, c = { heading: 'Новий слайд', body: 'Текст слайду, **ключова фраза** жирним.' };
    const s = kind === 'cover' ? buildCover(f, c, post.photos[0]) : kind === 'photo' ? buildPhoto(f, c, post.photos[0], 'powder')
      : kind === 'text' ? buildText(f, c, 'powder') : buildCta(f, DEFAULT_CTA);
    patchPost(p => { const slides = [...p.slides]; slides.splice(idx + 1, 0, s); return { ...p, slides }; });
    setSlideIdx(idx + 1); setSelected(null);
  };

  if (!t) return <div className="p-8">У папці src/templates немає шаблонів.</div>;
  const canExport = fontsReady && imgsReady && !busy;
  const waitLabel = !fontsReady ? 'Чекаю на шрифт…' : !imgsReady ? 'Чекаю на фото…' : '';

  return (
    <div className="flex min-h-full flex-col lg:h-full">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-panel px-4 py-3">
        <div className="mr-auto flex min-w-0 items-baseline gap-2">
          <h1 className="text-lg font-bold tracking-tight">Майстерня поста</h1>
          <span className="hidden truncate text-sm text-muted sm:inline">{post ? post.name : '@iamsonia.psy'}</span>
        </div>
        <Button variant="ghost" onClick={() => setDark(d => !d)} aria-label="Перемкнути тему інтерфейсу">{dark ? 'Світла тема' : 'Темна тема'}</Button>
        {post ? (<>
          <Button onClick={exportPng} disabled={!canExport}>{busy === 'png' ? 'Готую PNG…' : 'PNG слайду'}</Button>
          <Button variant="primary" onClick={exportZip} disabled={!canExport}>{busy === 'zip' ? 'Готую архів…' : waitLabel || `Усі слайди, ZIP (${post.slides.length})`}</Button>
        </>) : (<>
          <Button onClick={exportJson} title="Зберегти шаблон як JSON для репозиторію">Експорт JSON</Button>
          {edited.has(t.id) && <Button variant="ghost" onClick={resetCurrent}>Скинути зміни</Button>}
          <Button variant="primary" onClick={exportPng} disabled={!canExport}>{busy === 'png' ? 'Готую PNG…' : waitLabel || 'Завантажити PNG'}</Button>
        </>)}
      </header>

      <div className="grid flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[250px_minmax(0,1fr)_350px]">
        <Sidebar posts={postList} templates={library} edited={edited} current={current}
          onOpenPost={openPost} onOpenTemplate={openTemplate} onNewPost={() => setCreating(true)} onImport={importJson} />
        <main className="flex min-w-0 flex-col lg:min-h-0">
          {post && (
            <SlideStrip slides={post.slides} imgs={imgs} tick={fontTick} current={idx}
              onPick={i => { setSlideIdx(i); setSelected(null); }} onAdd={addSlide}
              onDuplicate={() => { patchPost(p => { const s = [...p.slides]; s.splice(idx + 1, 0, { ...clone(s[idx]), id: uid() }); return { ...p, slides: s }; }); setSlideIdx(idx + 1); }}
              onDelete={() => { patchPost(p => ({ ...p, slides: p.slides.filter((_, i) => i !== idx) })); setSlideIdx(Math.max(0, idx - 1)); setSelected(null); }}
              onMove={d => { const j = idx + d; patchPost(p => { const s = [...p.slides]; [s[idx], s[j]] = [s[j], s[idx]]; return { ...p, slides: s }; }); setSlideIdx(j); }} />
          )}
          <Frame t={t} imgs={imgs} vars={vars} fontTick={fontTick} selected={selected} guides={guides}
            onSelect={setSelected} onBlock={patchBlock} onImage={patchImage} onLayouts={onLayouts} />
        </main>
        <SettingsPanel t={t} selected={selected} guides={guides} fontsVersion={fontsVersion} post={postControls} onGuides={setGuides}
          onChange={patch => update(x => ({ ...x, ...patch }))} onFormat={setFormat} onBlock={patchBlock} onImage={patchImage} onSelect={setSelected}
          onAddBlock={() => { const nb = blankBlock(t); update(x => ({ ...x, blocks: [...x.blocks, nb] })); setSelected(nb.id); }}
          onAddImage={() => {
            const { w: W } = FORMATS[t.format];
            const ib: ImageBlock = { id: uid(), src: post?.photos[0] ? `photo:${post.photos[0].id}` : '', x: t.padding.x, y: t.padding.y, width: W - t.padding.x * 2, height: Math.round(W * 0.6), radius: 28, posX: 50, posY: 50, zoom: 1 };
            update(x => ({ ...x, images: [...(x.images ?? []), ib] })); setSelected(ib.id);
          }}
          onDuplicateBlock={id => { const src = t.blocks.find(b => b.id === id); if (!src) return; const nb = { ...src, id: uid(), y: src.y + 60 }; update(x => ({ ...x, blocks: [...x.blocks, nb] })); setSelected(nb.id); }}
          onDeleteBlock={id => { update(x => ({ ...x, blocks: x.blocks.filter(b => b.id !== id) })); setSelected(null); }}
          onDeleteImage={id => { update(x => ({ ...x, images: (x.images ?? []).filter(b => b.id !== id) })); setSelected(null); }}
          onBgFile={onBgFile} onFontFile={onFontFile} />
      </div>

      {creating && (
        <NewPostForm onClose={() => setCreating(false)}
          onCreate={p => { setPosts(ps => ({ ...ps, [p.id]: p })); setPhotosVersion(v => v + 1); setCreating(false); openPost(p.id); setNote(`Пост зібрано: ${p.slides.length} слайдів`); }} />
      )}

      {note && (
        <div role="status" className="fixed bottom-4 left-1/2 z-50 max-w-[calc(100%-32px)] -translate-x-1/2 rounded-xl bg-ink px-4 py-2.5 text-sm text-bg shadow-lg">{note}</div>
      )}
    </div>
  );
}
