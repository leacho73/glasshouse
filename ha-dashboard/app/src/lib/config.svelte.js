// Dashboard config: cards are defined once and placed per device layout.
// Each device layout has a design width (the stage is scaled to fit the screen),
// an optional sidebar, and per-zone placements ('sidebar' or a view id).
export const DEVICES = {
  tablet: { label: 'Tablet', width: 1280, sidebar: 300 },
  phone: { label: 'Phone', width: 420, sidebar: 0 },
  desktop: { label: 'Desktop', width: 1600, sidebar: 320 },
};
export const GRID = 10;

export const DEFAULT_THEME = {
  font: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  fontUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  background: 'radial-gradient(1200px 800px at 10% -10%, #1d2a4a 0%, transparent 60%), radial-gradient(1000px 700px at 110% 110%, #2a1d3d 0%, transparent 55%), #0b0f17',
  text: '#eef2f8',
  muted: 'rgba(238,242,248,.6)',
  accent: '#7aa2ff',
  on: '#ffc861',
  cardBg: 'rgba(255,255,255,.06)',
  cardBorder: '1px solid rgba(255,255,255,.08)',
  cardRadius: 22,
  cardBlur: 18,
  cardShadow: '0 8px 30px rgba(0,0,0,.25)',
  cardPadding: 16,
  sidebarBg: 'rgba(255,255,255,.03)',
  customCss: '',
};

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function starter() {
  const views = [{ id: 'home', name: 'Home', icon: 'mdi:home' }];
  const cards = {
    clock: { id: 'clock', type: 'clock', props: { seconds: false, date: true }, style: { background: 'transparent', border: 'none', shadow: 'none' } },
    nav: { id: 'nav', type: 'nav', props: { direction: 'vertical' }, style: { background: 'transparent', border: 'none', shadow: 'none' } },
    welcome: { id: 'welcome', type: 'markdown', props: { content: '# Welcome\nTap **Edit** (top-right, or press **E**) to add cards, drag them anywhere and resize from the corner.\n\nAny text can be a template, e.g. `{{ states("sun.sun") }}`' }, style: {} },
  };
  const layouts = {};
  for (const [dev, d] of Object.entries(DEVICES)) {
    const side = d.sidebar > 0;
    layouts[dev] = {
      width: d.width,
      sidebar: { enabled: side, side: 'left', width: d.sidebar || 300 },
      zones: {
        sidebar: side ? [{ card: 'clock', x: 20, y: 30, w: d.sidebar - 40, h: 130 }, { card: 'nav', x: 20, y: 180, w: d.sidebar - 40, h: 200 }] : [],
        home: [
          ...(side ? [] : [{ card: 'clock', x: 20, y: 20, w: d.width - 40, h: 120 }]),
          { card: 'welcome', x: 20, y: side ? 20 : 160, w: Math.min(560, d.width - 40), h: 200 },
        ],
      },
    };
  }
  return { version: 1, theme: { ...DEFAULT_THEME }, views, cards, layouts };
}

export function detectDevice() {
  const q = new URLSearchParams(location.search).get('device');
  if (q && DEVICES[q]) return q;
  const saved = localStorage.getItem('hd-device');
  if (saved && DEVICES[saved]) return saved;
  const w = innerWidth;
  if (w < 700) return 'phone';
  if (matchMedia('(pointer: coarse)').matches && w <= 1400) return 'tablet';
  return 'desktop';
}

export const app = $state({
  config: null,
  device: detectDevice(),
  view: (location.hash.slice(1) || 'home'),
  editing: false,
  selected: null, // { zone, index }
  popup: null, // { cardId } | { entity }
  dirty: false,
  saving: false,
  panel: null, // 'card' | 'theme' | 'views' | 'add'
});

export const layout = () => app.config.layouts[app.device];

export async function load() {
  let cfg = null;
  try {
    cfg = await fetch('api/config').then((r) => r.json());
  } catch {}
  init(cfg ?? starter());
}

export function importConfig(cfg) {
  init(cfg);
  changed();
}

function init(cfg) {
  for (const [dev, d] of Object.entries(DEVICES)) {
    cfg.layouts[dev] ??= { width: d.width, sidebar: { enabled: false, side: 'left', width: 300 }, zones: { sidebar: [] } };
    cfg.layouts[dev].zones.sidebar ??= [];
  }
  cfg.theme = { ...DEFAULT_THEME, ...cfg.theme };
  for (const c of Object.values(cfg.cards)) normalise(c);
  app.config = cfg;
  lastSaved = JSON.stringify(cfg);
  if (!cfg.views.some((v) => v.id === app.view)) app.view = cfg.views[0]?.id;
}

function normalise(c) {
  c.props ??= {};
  c.style ??= {};
  c.tap ??= {};
  c.hold ??= {};
  return c;
}

let saveTimer;
let lastSaved = '';
const undoStack = [];
export const undo = $state({ count: 0 });
export function changed() {
  app.dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 800);
}

export async function save() {
  clearTimeout(saveTimer);
  app.saving = true;
  const body = JSON.stringify($state.snapshot(app.config));
  try {
    const r = await fetch('api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });
    if (!r.ok) throw new Error('save failed');
    if (lastSaved && lastSaved !== body) undoStack.push(lastSaved);
    if (undoStack.length > 50) undoStack.shift();
    undo.count = undoStack.length;
    lastSaved = body;
    app.dirty = false;
  } finally {
    app.saving = false;
  }
}

export async function undoLast() {
  if (app.dirty) await save();
  const prev = undoStack.pop();
  undo.count = undoStack.length;
  if (!prev) return;
  app.selected = null;
  app.config = JSON.parse(prev);
  lastSaved = prev;
  await fetch('api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: prev });
}

export function setDevice(d) {
  app.device = d;
  app.selected = null;
  localStorage.setItem('hd-device', d);
}

export function setView(id) {
  app.view = id;
  app.selected = null;
  history.replaceState(null, '', '#' + id);
}

export function zoneList(zone) {
  const z = layout().zones;
  return (z[zone] ??= []);
}

export function selectedPlacement() {
  const s = app.selected;
  if (!s) return null;
  return layout().zones[s.zone]?.[s.index] || null;
}

export function selectedCard() {
  const p = selectedPlacement();
  return p ? app.config.cards[p.card] : null;
}

export function addCard(type, meta, zone = app.view) {
  const id = uid();
  app.config.cards[id] = normalise({ id, type, props: structuredClone(meta.defaults || {}) });
  const list = zoneList(zone);
  const y = list.reduce((m, p) => Math.max(m, p.y + p.h), 0) + (list.length ? GRID * 2 : GRID * 2);
  const w = Math.min(meta.size?.w || 200, zoneWidth(zone) - GRID * 4);
  list.push({ card: id, x: GRID * 2, y, w, h: meta.size?.h || 120 });
  app.selected = { zone, index: list.length - 1 };
  app.panel = 'card';
  changed();
  return id;
}

export function placeExisting(cardId, zone = app.view) {
  const list = zoneList(zone);
  const y = list.reduce((m, p) => Math.max(m, p.y + p.h), 0) + GRID * 2;
  list.push({ card: cardId, x: GRID * 2, y, w: 240, h: 140 });
  app.selected = { zone, index: list.length - 1 };
  changed();
}

export function zoneWidth(zone) {
  const l = layout();
  const sb = l.sidebar.enabled ? l.sidebar.width : 0;
  return zone === 'sidebar' ? sb : l.width - sb;
}

export function removeSelected(deleteCard = false) {
  const s = app.selected;
  if (!s) return;
  const [p] = zoneList(s.zone).splice(s.index, 1);
  app.selected = null;
  if (deleteCard && p && !isPlacedAnywhere(p.card)) delete app.config.cards[p.card];
  changed();
}

export function duplicateSelected() {
  const p = selectedPlacement();
  const card = selectedCard();
  if (!p || !card) return;
  const id = uid();
  app.config.cards[id] = { ...$state.snapshot(card), id };
  const list = zoneList(app.selected.zone);
  list.push({ ...$state.snapshot(p), card: id, x: p.x + GRID * 2, y: p.y + GRID * 2 });
  app.selected = { zone: app.selected.zone, index: list.length - 1 };
  changed();
}

export function isPlacedAnywhere(cardId) {
  for (const l of Object.values(app.config.layouts)) for (const z of Object.values(l.zones)) if (z.some((p) => p.card === cardId)) return true;
  return false;
}

export function copyLayout(from) {
  const src = $state.snapshot(app.config.layouts[from]);
  const dst = layout();
  const scale = dst.width / src.width;
  dst.sidebar = { ...src.sidebar };
  dst.zones = {};
  for (const [z, list] of Object.entries(src.zones)) {
    const s = z === 'sidebar' ? 1 : scale;
    dst.zones[z] = list.map((p) => ({ ...p, x: Math.round((p.x * s) / GRID) * GRID, w: Math.round((p.w * s) / GRID) * GRID }));
  }
  app.selected = null;
  changed();
}

export function addView(name) {
  const id = uid();
  app.config.views.push({ id, name, icon: 'mdi:view-dashboard' });
  setView(id);
  changed();
}

export function removeView(id) {
  if (app.config.views.length < 2) return;
  app.config.views = app.config.views.filter((v) => v.id !== id);
  for (const l of Object.values(app.config.layouts)) delete l.zones[id];
  if (app.view === id) setView(app.config.views[0].id);
  changed();
}
