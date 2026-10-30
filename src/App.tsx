import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Frame } from './components/Frame';
import { SettingsPanel } from './components/SettingsPanel';
import { TemplateList } from './components/TemplateList';
import { Button } from './components/ui';
import { addFontFile, ensureFonts, fontLoaded, registerLocalFonts } from './lib/fonts';
import { FORMATS } from './lib/formats';
import { canvasToPng, drawFrame, type BlockLayout } from './lib/render';
import { assetUrl, BUILTIN, blankBlock, clampBlocks, clone, isTemplate, templateToJson, uid } from './lib/templates';
import type { FormatId, Template, TextBlock } from './lib/types';

const DRAFTS_KEY = 'studio-drafts';

function loadDrafts(): Record<string, Template> {
  try { const o = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '{}'); return Object.fromEntries(Object.entries(o).filter(([, v]) => isTemplate(v))) as Record<string, Template>; }
  catch { return {}; }
}
function saveDrafts(d: Record<string, Template>) {
  try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(Object.fromEntries(Object.entries(d).map(([k, v]) => [k, JSON.parse(templateToJson(v))])))); } catch { /* сховище браузера недоступне: правки живуть до перезавантаження */ }
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function App() {
  const [library, setLibrary] = useState<Template[]>(BUILTIN);
  const [drafts, setDrafts] = useState<Record<string, Template>>(loadDrafts);
  const [currentId, setCurrentId] = useState<string>(BUILTIN[0]?.id ?? '');
  const [selected, setSelected] = useState<string | null>(null);
  const [guides, setGuides] = useState(true);
  const [fontTick, setFontTick] = useState(0);
  const [fontsVersion, setFontsVersion] = useState(0);
  const [fontsReady, setFontsReady] = useState(false);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [imgReady, setImgReady] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const heights = useRef<Record<string, number>>({});

  const base = library.find(x => x.id === currentId) ?? library[0];
  const t = drafts[currentId] ?? base;
  const edited = useMemo(() => new Set(Object.keys(drafts).filter(id => {
    const b = library.find(x => x.id === id); return b && templateToJson(b) !== templateToJson(drafts[id]);
  })), [drafts, library]);

  useEffect(() => { saveDrafts(drafts); }, [drafts]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('studio-theme', dark ? 'dark' : 'light'); } catch { /* немає сховища */ }
  }, [dark]);

  useEffect(() => {
    const bump = () => setFontTick(n => n + 1);
    document.fonts.addEventListener('loadingdone', bump);
    registerLocalFonts().then(list => { if (list.length) setFontsVersion(v => v + 1); bump(); }).catch(() => {});
    return () => document.fonts.removeEventListener('loadingdone', bump);
  }, []);

  // шрифти кадру: кнопка PNG чекає, поки вони реально завантажаться
  useEffect(() => {
    if (!t) return;
    let live = true;
    setFontsReady(t.blocks.every(fontLoaded));
    ensureFonts(t.blocks).then(ok => { if (live) { setFontsReady(ok); setFontTick(n => n + 1); } });
    return () => { live = false; };
  }, [t?.blocks, fontsVersion]);

  // фонове зображення
  const bgSrc = t?.background.kind === 'image' ? t.background.src : '';
  useEffect(() => {
    if (!bgSrc) { setImg(null); setImgReady(true); return; }
    let live = true; setImgReady(false);
    const im = new Image();
    im.onload = () => { if (live) { setImg(im); setImgReady(true); } };
    im.onerror = () => { if (live) { setImg(null); setImgReady(true); setNote('Не вдалося відкрити фон. Перевір шлях до файлу в шаблоні.'); } };
    im.src = assetUrl(bgSrc);
    return () => { live = false; };
  }, [bgSrc]);

  useEffect(() => { if (!note) return; const id = setTimeout(() => setNote(''), 4200); return () => clearTimeout(id); }, [note]);

  const update = useCallback((fn: (t: Template) => Template) => {
    setDrafts(d => {
      const curT = d[currentId] ?? library.find(x => x.id === currentId); if (!curT) return d;
      return { ...d, [currentId]: clampBlocks(fn(clone(curT)), heights.current) };
    });
  }, [currentId, library]);

  const onLayouts = useCallback((l: Record<string, BlockLayout>) => {
    heights.current = Object.fromEntries(Object.entries(l).map(([k, v]) => [k, v.height]));
  }, []);

  const patchBlock = useCallback((id: string, patch: Partial<TextBlock>) => {
    update(x => ({ ...x, blocks: x.blocks.map(b => (b.id === id ? { ...b, ...patch } : b)) }));
  }, [update]);

  const setFormat = (f: FormatId) => update(x => {
    const r = FORMATS[f].h / FORMATS[x.format].h;
    return { ...x, format: f, blocks: x.blocks.map(b => ({ ...b, y: Math.round(b.y * r) })) };
  });

  const open = (id: string) => { setCurrentId(id); setSelected(null); };

  const resetCurrent = () => {
    setDrafts(d => { const n = { ...d }; delete n[currentId]; return n; });
    setSelected(null); setNote('Шаблон повернуто до версії з репозиторію');
  };

  const exportPng = async () => {
    setBusy(true);
    try {
      const ok = await ensureFonts(t.blocks);
      if (!ok) { setFontsReady(false); setNote('Шрифт ще не завантажився. Зачекай кілька секунд і спробуй знову.'); return; }
      if (!imgReady) { setNote('Фон ще завантажується. Спробуй за мить.'); return; }
      const c = document.createElement('canvas');
      drawFrame(c, t, img);
      const { w, h } = FORMATS[t.format];
      download(await canvasToPng(c), `${t.id}-${w}x${h}.png`);
      setNote(`PNG ${w}×${h} збережено`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Не вдалося зберегти PNG');
    } finally { setBusy(false); }
  };

  const exportJson = () => {
    download(new Blob([templateToJson(t)], { type: 'application/json' }), `${t.id}.json`);
    setNote(`Поклади ${t.id}.json у папку src/templates репозиторію`);
  };

  const importJson = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (!isTemplate(data)) throw new Error();
      const taken = library.some(x => x.id === data.id);
      const tpl = taken ? { ...data, id: `${data.id}-${uid()}`, name: `${data.name} (відкритий)` } : data;
      setLibrary(l => [...l, tpl]); open(tpl.id);
      setNote(`Шаблон «${tpl.name}» відкрито`);
    } catch { setNote('Це не схоже на шаблон. Потрібен JSON, експортований із цього редактора.'); }
  };

  const onBgFile = (f: File) => {
    const url = URL.createObjectURL(f);
    update(x => x.background.kind === 'image' ? { ...x, background: { ...x.background, src: url } } : x);
  };

  const onFontFile = async (f: File) => {
    try {
      const opt = await addFontFile(f);
      setFontsVersion(v => v + 1);
      if (selected) patchBlock(selected, { fontFamily: opt.family });
      setNote(`Шрифт «${opt.family}» додано. Він працює, поки відкрита сторінка.`);
    } catch { setNote('Не вдалося відкрити шрифт. Підійдуть файли .woff2, .woff, .ttf або .otf.'); }
  };

  if (!t) return <div className="p-8">У папці src/templates немає шаблонів.</div>;
  const canExport = fontsReady && imgReady && !busy;

  return (
    <div className="flex min-h-full flex-col lg:h-full">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-panel px-4 py-3">
        <div className="mr-auto flex items-baseline gap-2">
          <h1 className="text-lg font-bold tracking-tight">Майстерня поста</h1>
          <span className="hidden text-sm text-muted sm:inline">@iamsonia.psy</span>
        </div>
        <Button variant="ghost" onClick={() => setDark(d => !d)} aria-label="Перемкнути тему інтерфейсу">{dark ? 'Світла тема' : 'Темна тема'}</Button>
        <Button onClick={exportJson} title="Зберегти шаблон як JSON для репозиторію">Експорт JSON</Button>
        {edited.has(t.id) && <Button variant="ghost" onClick={resetCurrent}>Скинути зміни</Button>}
        <Button variant="primary" onClick={exportPng} disabled={!canExport}>
          {busy ? 'Готую PNG…' : !fontsReady ? 'Чекаю на шрифт…' : !imgReady ? 'Чекаю на фон…' : 'Завантажити PNG'}
        </Button>
      </header>

      <div className="grid flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[250px_minmax(0,1fr)_350px]">
        <TemplateList templates={library} edited={edited} current={currentId} onOpen={open} onImport={importJson} />
        <main className="flex min-w-0 flex-col lg:min-h-0">
          <Frame t={t} img={img} fontTick={fontTick} selected={selected} guides={guides}
            onSelect={setSelected} onBlock={patchBlock} onLayouts={onLayouts} />
        </main>
        <SettingsPanel t={t} selected={selected} guides={guides} fontsVersion={fontsVersion} onGuides={setGuides}
          onChange={patch => update(x => ({ ...x, ...patch }))} onFormat={setFormat} onBlock={patchBlock} onSelect={setSelected}
          onAddBlock={() => { const nb = blankBlock(t); update(x => ({ ...x, blocks: [...x.blocks, nb] })); setSelected(nb.id); }}
          onDuplicateBlock={id => { const src = t.blocks.find(b => b.id === id); if (!src) return; const nb = { ...src, id: uid(), y: src.y + 60 }; update(x => ({ ...x, blocks: [...x.blocks, nb] })); setSelected(nb.id); }}
          onDeleteBlock={id => { update(x => ({ ...x, blocks: x.blocks.filter(b => b.id !== id) })); setSelected(null); }}
          onBgFile={onBgFile} onFontFile={onFontFile} />
      </div>

      {note && (
        <div role="status" className="fixed bottom-4 left-1/2 z-50 max-w-[calc(100%-32px)] -translate-x-1/2 rounded-xl bg-ink px-4 py-2.5 text-sm text-bg shadow-lg">{note}</div>
      )}
    </div>
  );
}
