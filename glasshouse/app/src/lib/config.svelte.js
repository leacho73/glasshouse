import { param } from './params.js';
import { toast } from './ha.svelte.js';
// Dashboard config: cards are defined once and placed on layouts. The main
// (tablet) layout is shown everywhere by default: desktop scales it, phone gets
// an automatic single-column reflow. Either can be switched to a custom layout.
// Each layout has a design width (the stage is scaled to fit the screen), an
// optional sidebar, and per-zone placements ('sidebar' or a view id).
import { reflow } from './reflow.js';
import { clientId } from './live.js';

export const DEVICES = {
  tablet: { label: 'Main', width: 1280, sidebar: 300, display: 'width' },
  phone: { label: 'Phone', width: 420, sidebar: 0, mode: 'auto', display: 'width' },
  desktop: { label: 'Desktop', width: 1600, sidebar: 320, mode: 'same', display: 'actual' },
};
/** How a layout is sized on the screen. */
export const DISPLAYS = { width: 'Fill the screen width (scroll down)', screen: 'Fit the whole view on screen (no scrolling — wall tablets)', actual: 'Actual size, centred (big monitors)' };
export const MODES = { same: 'Same as main (scaled)', auto: 'Automatic (single column)', custom: 'Custom layout' };
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
  cardScale: 100,
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
  const q = param('device');
  if (q && DEVICES[q]) return q;
  const saved = localStorage.getItem('hd-device');
  if (saved && DEVICES[saved]) return saved;
  const w = Math.min(innerWidth, screen.width || innerWidth);
  if (w < 700) return 'phone';
  // Touch-only screens are tablets whatever their reported width (high-DPI
  // tablets can report 1400+ CSS px). Anything with a mouse is a desktop.
  const touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
  if (touchOnly || (matchMedia('(pointer: coarse)').matches && w <= 1400)) return 'tablet';
  return 'desktop';
}

export const app = $state({
  config: null,
  device: detectDevice(),
  view: (location.hash.slice(1) || 'home'),
  editing: false,
  selected: null, // { zone, index } — the primary selected card
  multi: [], // extra indices selected (shift/ctrl-click or drag-select)
  single: false, // edit one card of a group on its own
  popup: null, // { cardId } | { entity }
  dirty: false,
  saving: false,
  panel: null, // 'card' | 'theme' | 'views' | 'add'
});

/** The layout a device actually shows (main, a reflow of main, or its own). */
export function layout(dev = app.device) {
  const ls = app.config.layouts;
  const l = ls[dev];
  if (dev === 'tablet' || l.mode === 'custom') return l;
  if (l.mode === 'same') return ls.tablet;
  return reflow(ls.tablet, l.width, app.config.views, app.config.cards);
}

/** Which stored layout edits on this device go to. */
export const editTarget = (dev = app.device) => (dev === 'tablet' || app.config.layouts[dev].mode === 'custom' ? dev : app.config.layouts[dev].mode === 'same' ? 'tablet' : null);

/** An automatic layout becomes custom the moment it's edited. */
export function ensureEditable() {
  if (editTarget() !== null) return;
  const l = app.config.layouts[app.device];
  const r = layout();
  app.config.layouts[app.device] = { ...r, width: l.width, mode: 'custom', display: l.display };
  toast(`${DEVICES[app.device].label} layout is now custom — switch back to automatic in Layout`);
}

export function setMode(dev, mode) {
  const l = app.config.layouts[dev];
  if (mode === 'custom' && l.mode !== 'custom') {
    const r = $state.snapshot(layout(dev));
    app.config.layouts[dev] = { ...r, width: l.mode === 'same' ? r.width : l.width, mode: 'custom', display: l.display };
  } else {
    app.config.layouts[dev] = { width: DEVICES[dev].width, mode, display: l.display, sidebar: { enabled: false, side: 'left', width: 300 }, zones: { sidebar: [] } };
  }
  app.selected = null;
  changed();
}

export async function load() {
  let cfg = null;
  try {
    cfg = await fetch('api/config', { cache: 'no-store' }).then((r) => r.json());
  } catch {}
  init(cfg ?? starter());
}

/** Another screen saved: pick up its layout unless we're editing here. */
export async function reloadFromServer() {
  if (app.editing || app.dirty) return;
  try {
    const cfg = await fetch('api/config', { cache: 'no-store' }).then((r) => r.json());
    if (cfg && !app.editing && !app.dirty) init(cfg);
  } catch {}
}

export function importConfig(cfg) {
  init(cfg);
  changed();
}

let firstInit = true;
let homeView = null;
/** This screen's own view: ?view= if given, else the first view. */
export const startView = () => (app.config.views.some((v) => v.id === homeView) ? homeView : app.config.views[0]?.id);
function init(cfg) {
  for (const [dev, d] of Object.entries(DEVICES)) {
    cfg.layouts[dev] ??= { width: d.width, sidebar: { enabled: false, side: 'left', width: 300 }, zones: { sidebar: [] } };
    cfg.layouts[dev].zones.sidebar ??= [];
    if (dev !== 'tablet') cfg.layouts[dev].mode ??= d.mode;
    cfg.layouts[dev].display ??= d.display;
  }
  cfg.theme = { ...DEFAULT_THEME, ...cfg.theme };
  for (const c of Object.values(cfg.cards)) normalise(c);
  app.config = cfg;
  lastSaved = JSON.stringify(cfg);
  // ?view= (a view's id or name) picks the starting view, e.g. upstairs tablets.
  if (firstInit) {
    const want = (param('view') || '').toLowerCase();
    const v = want && cfg.views.find((x) => x.id.toLowerCase() === want || x.name.toLowerCase() === want);
    if (v) app.view = v.id;
    homeView = v?.id ?? null;
  }
  firstInit = false;
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
    const r = await fetch('api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Client': clientId }, body });
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
  await fetch('api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Client': clientId }, body: prev });
}

export function setDevice(d) {
  app.device = d;
  app.selected = null;
  app.multi = [];
  localStorage.setItem('hd-device', d);
}

export function setView(id) {
  app.view = id;
  app.selected = null;
  app.multi = [];
  history.replaceState(null, '', '#' + id);
}

export function zoneList(zone, l = layout()) {
  return (l.zones[zone] ??= []);
}

/** Stored layouts that hold their own placements (main + any custom ones). */
const storedLayouts = () => Object.entries(app.config.layouts).filter(([dev, l]) => dev === 'tablet' || l.mode === 'custom').map(([, l]) => l);

export function selectedPlacement() {
  const s = app.selected;
  if (!s) return null;
  return layout().zones[s.zone]?.[s.index] || null;
}

export function selectedCard() {
  const p = selectedPlacement();
  return p ? app.config.cards[p.card] : null;
}

// New cards go on every stored layout (at the bottom), so they show on all devices.
function placeEverywhere(cardId, zone, size) {
  ensureEditable();
  const here = layout();
  for (const l of new Set([here, ...storedLayouts()])) {
    const z = zone === 'sidebar' && !l.sidebar.enabled ? app.view : zone;
    const list = zoneList(z, l);
    const y = list.reduce((m, p) => Math.max(m, p.y + p.h), 0) + GRID * 2;
    const w = Math.min(size.w, zoneWidth(z, l) - GRID * 4);
    list.push({ card: cardId, x: GRID * 2, y, w, h: size.h });
  }
  const list = zoneList(zone, here);
  app.selected = { zone, index: list.length - 1 };
  app.multi = [];
}

export function addCard(type, meta, zone = app.view) {
  const id = uid();
  app.config.cards[id] = normalise({ id, type, props: { ...structuredClone(meta.defaults || {}), ...(meta.autofill?.() || {}) } });
  placeEverywhere(id, zone, { w: meta.size?.w || 200, h: meta.size?.h || 120 });
  app.panel = 'card';
  changed();
  return id;
}

export function placeExisting(cardId, zone = app.view) {
  ensureEditable();
  const list = zoneList(zone);
  const y = list.reduce((m, p) => Math.max(m, p.y + p.h), 0) + GRID * 2;
  list.push({ card: cardId, x: GRID * 2, y, w: 240, h: 140 });
  app.selected = { zone, index: list.length - 1 };
  changed();
}

export function zoneWidth(zone, l = layout()) {
  const sb = l.sidebar.enabled ? l.sidebar.width : 0;
  return zone === 'sidebar' ? sb : l.width - sb;
}

/** Indices (in the selected zone) of everything that moves together. */
export function selectionSet() {
  const s = app.selected;
  if (!s) return [];
  if (app.multi.length > 1) return [...app.multi];
  const list = layout().zones[s.zone] || [];
  const g = list[s.index]?.group;
  if (!g || app.single) return [s.index];
  return list.map((p, i) => (p.group === g ? i : -1)).filter((i) => i >= 0);
}

/** Unplace removes from this layout only; delete removes the card everywhere. */
export function removeSelected(deleteCard = false) {
  const s = app.selected;
  if (!s) return;
  ensureEditable();
  const list = zoneList(s.zone);
  const idx = selectionSet().sort((a, b) => b - a);
  const ids = idx.map((i) => list[i].card);
  for (const i of idx) list.splice(i, 1);
  app.selected = null;
  app.multi = [];
  if (deleteCard) {
    for (const l of Object.values(app.config.layouts)) for (const [z, zl] of Object.entries(l.zones)) l.zones[z] = zl.filter((p) => !ids.includes(p.card));
    for (const id of ids) delete app.config.cards[id];
  }
  changed();
}

export function groupSelected() {
  ensureEditable();
  const list = zoneList(app.selected.zone);
  const g = uid();
  for (const i of selectionSet()) list[i].group = g;
  app.multi = [];
  app.single = false;
  changed();
}

export function ungroupSelected() {
  ensureEditable();
  const list = zoneList(app.selected.zone);
  for (const i of selectionSet()) delete list[i].group;
  app.multi = [];
  changed();
}

export function duplicateSelected() {
  ensureEditable();
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
  ensureEditable();
  const src = $state.snapshot(layout(from));
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

// Changing the design width or the sidebar changes the main area's width. Cards
// that would spill off the edge (or that filled the old width) are scaled
// across to fit, so equal gaps stay equal. Scaling is always from where things
// were when the edit began (until it pauses for 2 s), so typing "350" (via 3 and 35) doesn't drift.
let fitBase = null, fitTimer;
export function setMainWidth(apply) {
  clearTimeout(fitTimer);
  fitTimer = setTimeout(() => (fitBase = null), 2000);
  const l = layout();
  if (fitBase?.l !== l) fitBase = { l, w: zoneWidth('main', l), zones: $state.snapshot(l.zones) };
  apply(l);
  const w = zoneWidth('main', l);
  if (w > 100 && fitBase.w > 100) {
    for (const [z, list] of Object.entries(fitBase.zones)) {
      if (z === 'sidebar' || !l.zones[z]) continue;
      const right = list.reduce((m, p) => Math.max(m, p.x + p.w), 0);
      const k = right > fitBase.w ? (right > w ? w / (right + Math.max(0, Math.min(...list.map((p) => p.x)))) : 1)
        : right > w || right >= fitBase.w - GRID * 3 ? w / fitBase.w : 1;
      l.zones[z] = list.map((p) => {
        const x = Math.round(p.x * k);
        return { ...p, x, w: Math.max(GRID * 4, Math.round((p.x + p.w) * k) - x) };
      });
    }
  }
  changed();
}

/** Scale any view whose cards run past the main area's right edge back inside it. */
export function fitOverflow(l) {
  const w = zoneWidth('main', l);
  if (w < 100) return;
  let any = false;
  for (const [z, list] of Object.entries(l.zones)) {
    if (z === 'sidebar') continue;
    const right = list.reduce((m, p) => Math.max(m, p.x + p.w), 0);
    if (right <= w) continue;
    const k = w / (right + Math.max(0, Math.min(...list.map((p) => p.x)))); // right margin = left margin
    for (const p of list) {
      const x = Math.round(p.x * k);
      p.w = Math.max(GRID * 4, Math.round((p.x + p.w) * k) - x);
      p.x = x;
    }
    any = true;
  }
  if (any) changed();
}
