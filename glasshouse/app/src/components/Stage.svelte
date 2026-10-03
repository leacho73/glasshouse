<script>
  // The dashboard canvas. Laid out at the layout's design width and scaled
  // (CSS zoom) to fit the screen. In edit mode cards can be dragged anywhere
  // (including between the sidebar and main area) and resized from any edge or
  // corner. Grouped cards (rooms) move together; double-tap one to move it alone.
  // Shift/Ctrl-click or drag a box on empty space to select several.
  // Positions snap to a 10px grid (hold Shift while dragging for 1px).
  import CardFrame from './CardFrame.svelte';
  import { app, layout, GRID, changed, zoneList, ensureEditable, selectionSet } from '../lib/config.svelte.js';

  let { available, autoDevice } = $props();
  let vh = $state(innerHeight);
  let scrollY = $state(0);
  let sbEl = $state();

  const L = $derived(layout());
  const sb = $derived(L.sidebar.enabled ? L.sidebar.width : 0);
  const fit = $derived(available / L.width);
  // Sizing per device (Layout tab, or ?fit=width|screen|actual in the URL):
  // fill the width, fit the whole view on screen (wall tablets), or actual size.
  const display = $derived(new URLSearchParams(location.search).get('fit') || app.config.layouts[app.device]?.display || 'width');
  const contentH = $derived(Math.max(
    (L.zones[app.view] || []).reduce((m, p) => Math.max(m, p.y + p.h), 0),
    sb ? (L.zones.sidebar || []).reduce((m, p) => Math.max(m, p.y + p.h), 0) : 0,
  ) + 20);
  const scale = $derived.by(() => {
    if (L.width < 700 && app.device !== autoDevice) return Math.min(fit, 1); // phone preview on a big screen
    if (display === 'actual') return Math.min(fit, 1);
    if (display === 'screen' && !app.editing) return Math.min(fit, vh / contentH);
    return fit;
  });
  const left = $derived(Math.max(0, (available - L.width * scale) / 2));
  const mainW = $derived(L.width - sb);
  const origin = (zone) => ({
    x: zone === 'sidebar' ? (L.sidebar.side === 'right' ? L.width - sb : 0) : L.sidebar.side === 'right' ? 0 : sb,
    y: zone === 'sidebar' ? scrollY / scale - (sbEl?.scrollTop || 0) : 0,
  });
  /** Pointer position in a zone's own coordinates. */
  const local = (e, zone) => ({ x: (e.clientX - left) / scale - origin(zone).x, y: (e.clientY + scrollY) / scale - origin(zone).y });
  const mainList = $derived(L.zones[app.view] || []);
  const sideList = $derived(L.zones.sidebar || []);
  const mainH = $derived(Math.max(vh / scale, mainList.reduce((m, p) => Math.max(m, p.y + p.h), 0) + (app.editing ? 400 : 20)));
  const sideH = $derived(Math.max(vh / scale, sideList.reduce((m, p) => Math.max(m, p.y + p.h), 0) + 20));

  const sel = $derived(app.editing ? new Set(selectionSet()) : new Set());
  const inSel = (zone, i) => app.selected?.zone === zone && sel.has(i);
  const isPrimary = (zone, i) => app.selected?.zone === zone && app.selected.index === i;
  const selBox = $derived.by(() => {
    if (sel.size < 2 || !app.selected) return null;
    const list = L.zones[app.selected.zone] || [];
    const ps = [...sel].map((i) => list[i]).filter(Boolean);
    const x = Math.min(...ps.map((p) => p.x)), y = Math.min(...ps.map((p) => p.y));
    return { zone: app.selected.zone, x, y, w: Math.max(...ps.map((p) => p.x + p.w)) - x, h: Math.max(...ps.map((p) => p.y + p.h)) - y };
  });

  let op = $state(null); // active drag / resize / box-select
  const snap = (v, free) => (free ? Math.round(v) : Math.round(v / GRID) * GRID);

  function begin(e, zone, index, mode, dir) {
    if (!app.editing || e.button > 0) return;
    e.stopPropagation();
    e.preventDefault();
    ensureEditable();
    if (mode === 'move' && (e.shiftKey || e.ctrlKey || e.metaKey)) {
      // Add / remove from the selection.
      if (app.selected?.zone !== zone) { app.selected = { zone, index }; app.multi = [index]; return; }
      const cur = new Set(app.multi.length ? app.multi : selectionSet());
      cur.has(index) ? cur.delete(index) : cur.add(index);
      app.multi = [...cur];
      if (!cur.has(app.selected.index) && cur.size) app.selected = { zone, index: [...cur][0] };
      return;
    }
    const list = L.zones[zone];
    const keep = app.selected?.zone === zone && sel.has(index);
    if (!keep) { app.multi = []; app.single = false; }
    if (!keep || mode === 'resize') app.selected = { zone, index };
    app.panel = 'card';
    const idx = mode === 'move' ? selectionSet() : [index];
    op = { zone, index, mode, dir, sx: e.clientX, sy: e.clientY, idx, o: idx.map((i) => ({ ...list[i] })), moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function move(e) {
    if (!op) return;
    if (op.mode === 'box') {
      const p = local(e, op.zone);
      op.x2 = p.x; op.y2 = p.y;
      return;
    }
    const list = L.zones[op.zone];
    const dx = (e.clientX - op.sx) / scale;
    const dy = (e.clientY - op.sy) / scale;
    if (!op.moved && Math.hypot(dx, dy) < 3) return;
    op.moved = true;
    const free = e.shiftKey;
    if (op.mode === 'move') {
      // Snap the group's first card; move the rest by the same amount.
      const o0 = op.o[0];
      const sx = snap(o0.x + dx, free) - o0.x;
      const minY = Math.min(...op.o.map((o) => o.y));
      const sy = Math.max(-minY, snap(o0.y + dy, free) - o0.y);
      op.idx.forEach((i, k) => { list[i].x = op.o[k].x + sx; list[i].y = op.o[k].y + sy; });
      return;
    }
    const p = list[op.index];
    const o = op.o[0];
    const d = op.dir;
    const MIN = 30;
    if (d.includes('e')) p.w = Math.max(MIN, snap(o.w + dx, free));
    if (d.includes('s')) p.h = Math.max(MIN, snap(o.h + dy, free));
    if (d.includes('w')) { const nx = Math.min(o.x + o.w - MIN, snap(o.x + dx, free)); p.w = o.w + (o.x - nx); p.x = nx; }
    if (d.includes('n')) { const ny = Math.max(0, Math.min(o.y + o.h - MIN, snap(o.y + dy, free))); p.h = o.h + (o.y - ny); p.y = ny; }
  }

  function end(e) {
    if (!op) return;
    const cur = op;
    op = null;
    if (cur.mode === 'box') return finishBox(cur);
    if (!cur.moved) return;
    const { zone, mode } = cur;
    const list = L.zones[zone];
    let target = zone;
    if (mode === 'move' && sb) {
      const sx = (e.clientX - left) / scale;
      const sbX = origin('sidebar').x;
      target = sx >= sbX && sx < sbX + sb ? 'sidebar' : app.view;
    }
    if (target !== zone) {
      // Move the whole selection into the other zone, keeping its screen position.
      const from = origin(zone), to = origin(target);
      const moving = cur.idx.map((i) => list[i]);
      for (const i of [...cur.idx].sort((a, b) => b - a)) list.splice(i, 1);
      const dst = zoneList(target);
      const start = dst.length;
      for (const p of moving) {
        p.x = snap(from.x + p.x - to.x);
        p.y = Math.max(0, snap(from.y + p.y - to.y));
        dst.push(p);
      }
      app.selected = { zone: target, index: start };
      app.multi = moving.length > 1 && !moving[0].group ? moving.map((_, k) => start + k) : [];
    }
    // Keep everything inside its zone horizontally.
    const z = app.selected.zone;
    const zl = L.zones[z];
    const zw = z === 'sidebar' ? sb : mainW;
    const idx = selectionSet();
    const minX = Math.min(...idx.map((i) => zl[i].x));
    const maxX = Math.max(...idx.map((i) => zl[i].x + zl[i].w));
    const shift = minX < 0 ? -minX : maxX > zw ? Math.max(-minX, zw - maxX) : 0;
    for (const i of idx) { zl[i].w = Math.min(zl[i].w, zw); zl[i].x += shift; }
    changed();
  }

  function bgDown(e, zone) {
    if (!app.editing || e.target !== e.currentTarget || e.button > 0) return;
    const p = local(e, zone);
    op = { mode: 'box', zone, x1: p.x, y1: p.y, x2: p.x, y2: p.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function finishBox(b) {
    const x1 = Math.min(b.x1, b.x2), x2 = Math.max(b.x1, b.x2), y1 = Math.min(b.y1, b.y2), y2 = Math.max(b.y1, b.y2);
    if (x2 - x1 < 6 && y2 - y1 < 6) { app.selected = null; app.multi = []; return; }
    const list = L.zones[b.zone] || [];
    const hit = list.map((p, i) => (p.x < x2 && p.x + p.w > x1 && p.y < y2 && p.y + p.h > y1 ? i : -1)).filter((i) => i >= 0);
    if (!hit.length) { app.selected = null; app.multi = []; return; }
    ensureEditable();
    app.selected = { zone: b.zone, index: hit[0] };
    app.multi = hit;
    app.single = false;
    app.panel = 'card';
  }

  function dbl(zone, i) {
    // Double-tap a grouped card to work on it alone.
    app.selected = { zone, index: i };
    app.multi = [];
    app.single = true;
  }

  const HANDLES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

  /** Scale everything inside a card (text, buttons, toggles…) without changing its box. */
  function setScale(card, v) {
    card.style.scale = Math.min(250, Math.max(40, v));
    if (card.style.scale === 100) delete card.style.scale;
    changed();
  }
</script>

<svelte:window bind:innerHeight={vh} bind:scrollY />

{#snippet zone(name, list)}
  {#each list as p, i (p.card + ':' + i)}
    {@const card = app.config.cards[p.card]}
    {#if card}
      <div class="place" class:sel={inSel(name, i)} class:primary={isPrimary(name, i) && sel.size === 1} class:grouped={app.editing && p.group}
        style="left:{p.x}px;top:{p.y}px;width:{p.w}px;height:{p.h}px;z-index:{(p.z || 0) + (op && inSel(name, i) ? 1000 : isPrimary(name, i) ? 500 : 0)}">
        <CardFrame {card} w={p.w} h={p.h} editing={app.editing} />
        {#if app.editing}
          <div class="grab" role="button" tabindex="-1" ondblclick={() => dbl(name, i)}
            onpointerdown={(e) => begin(e, name, i, 'move')} onpointermove={move} onpointerup={end} onpointercancel={end}></div>
          {#if isPrimary(name, i) && sel.size === 1}
            {#each HANDLES as d}
              <div class="h h-{d}" role="button" tabindex="-1" onpointerdown={(e) => begin(e, name, i, 'resize', d)} onpointermove={move} onpointerup={end} onpointercancel={end}></div>
            {/each}
            {#if !op}
              {@const sc = Number(card.style?.scale) || 100}
              <div class="zoomer" role="toolbar" tabindex="-1" onpointerdown={(e) => e.stopPropagation()}>
                <button title="Smaller" onclick={() => setScale(card, sc - 10)}>−</button>
                <span>{sc}%</span>
                <button title="Bigger" onclick={() => setScale(card, sc + 10)}>+</button>
              </div>
            {/if}
            {#if op && op.mode !== 'box'}<div class="size">{p.w} × {p.h}{op.mode === 'move' ? `  @ ${p.x}, ${p.y}` : ''}</div>{/if}
          {/if}
        {/if}
      </div>
    {/if}
  {/each}
  {#if selBox && selBox.zone === name}
    <div class="selbox" style="left:{selBox.x - 6}px;top:{selBox.y - 6}px;width:{selBox.w + 12}px;height:{selBox.h + 12}px">
      <span>{sel.size} cards{list[app.selected.index]?.group && app.multi.length < 2 ? ' · group' : ''}</span>
    </div>
  {/if}
  {#if op?.mode === 'box' && op.zone === name}
    <div class="band" style="left:{Math.min(op.x1, op.x2)}px;top:{Math.min(op.y1, op.y2)}px;width:{Math.abs(op.x2 - op.x1)}px;height:{Math.abs(op.y2 - op.y1)}px"></div>
  {/if}
{/snippet}

<div class="stage" class:editing={app.editing} class:dragging={!!op} class:right={L.sidebar.side === 'right'}
  style="width:{L.width}px;zoom:{scale};margin-left:{left / scale}px;--grid:{GRID}px">
  {#if sb}
    <aside class="zone sidebar" bind:this={sbEl} style="width:{sb}px;height:{vh / scale}px">
      <div class="inner" role="presentation" style="height:{sideH}px" onpointerdown={(e) => bgDown(e, 'sidebar')} onpointermove={move} onpointerup={end}>{@render zone('sidebar', sideList)}</div>
    </aside>
  {/if}
  <main class="zone main" role="presentation" data-size="{L.width}px layout · edge of the canvas" style="width:{mainW}px;height:{mainH}px;{app.config.views.find((v) => v.id === app.view)?.background ? 'background:' + app.config.views.find((v) => v.id === app.view).background : ''}"
    onpointerdown={(e) => bgDown(e, app.view)} onpointermove={move} onpointerup={end}>
    {@render zone(app.view, mainList)}
  </main>
</div>

<style>
  .stage { display: flex; position: relative; }
  .stage.right { flex-direction: row-reverse; }
  .zone { position: relative; flex: none; }
  .sidebar { position: sticky; top: 0; overflow-y: auto; overflow-x: hidden; background: var(--sidebar-bg); border-right: 1px solid rgba(255,255,255,.05); scrollbar-width: none; }
  .right .sidebar { border-right: 0; border-left: 1px solid rgba(255,255,255,.05); }
  .sidebar .inner { position: relative; }
  .dragging .sidebar { overflow: visible; z-index: 5; }
  .editing .zone { background-image: radial-gradient(circle, rgba(255,255,255,.09) 1px, transparent 1.2px); background-size: calc(var(--grid) * 2) calc(var(--grid) * 2); touch-action: none; }
  .editing .sidebar { outline: 1px dashed rgba(122,162,255,.35); outline-offset: -1px; }
  .editing .main { outline: 1px dashed rgba(122,162,255,.35); outline-offset: -1px; }
  .editing .main::after { content: attr(data-size); position: absolute; right: 8px; bottom: 8px; font-size: 11px; color: var(--muted); pointer-events: none; }
  .place { position: absolute; }
  .editing .place:hover { outline: 1px solid rgba(122,162,255,.4); outline-offset: 2px; border-radius: var(--radius); }
  .editing .place.grouped:not(.sel)::after { content: ''; position: absolute; top: 6px; right: 6px; width: 6px; height: 6px; border-radius: 50%; background: rgba(122,162,255,.6); z-index: 3; pointer-events: none; }
  .place.sel { outline: 1px solid rgba(122,162,255,.7) !important; outline-offset: 2px; border-radius: var(--radius); }
  .place.primary { outline: 2px solid var(--accent) !important; }
  .grab { position: absolute; inset: 0; cursor: move; touch-action: none; z-index: 2; }
  .h { position: absolute; z-index: 3; touch-action: none; }
  .h::after { content: ''; position: absolute; inset: 50% auto auto 50%; width: 12px; height: 12px; transform: translate(-50%, -50%); background: #fff; border: 2px solid var(--accent); border-radius: 4px; box-shadow: 0 1px 4px rgba(0,0,0,.4); }
  .h-n, .h-s { left: 16px; right: 16px; height: 20px; cursor: ns-resize; }
  .h-e, .h-w { top: 16px; bottom: 16px; width: 20px; cursor: ew-resize; }
  .h-n { top: -12px; } .h-s { bottom: -12px; } .h-e { right: -12px; } .h-w { left: -12px; }
  .h-ne, .h-nw, .h-se, .h-sw { width: 26px; height: 26px; }
  .h-ne { top: -13px; right: -13px; cursor: nesw-resize; } .h-sw { bottom: -13px; left: -13px; cursor: nesw-resize; }
  .h-nw { top: -13px; left: -13px; cursor: nwse-resize; } .h-se { bottom: -13px; right: -13px; cursor: nwse-resize; }
  .h-ne::after, .h-nw::after, .h-se::after, .h-sw::after { width: 14px; height: 14px; border-radius: 50%; }
  .size { position: absolute; left: 50%; top: -34px; transform: translateX(-50%); background: var(--accent); color: #000; font-size: 12px; font-weight: 600; padding: 3px 8px; border-radius: 8px; white-space: pre; z-index: 4; pointer-events: none; }
  .zoomer { position: absolute; right: 0; bottom: -46px; z-index: 5; display: flex; align-items: center; gap: 2px; background: rgba(20,24,36,.96); border: 1px solid rgba(122,162,255,.5); border-radius: 12px; padding: 3px; box-shadow: 0 6px 20px rgba(0,0,0,.4); font-size: 13px; }
  .zoomer button { width: 30px; height: 28px; border: 0; border-radius: 9px; background: rgba(255,255,255,.08); color: var(--text); font-size: 17px; line-height: 1; }
  .zoomer button:hover { background: var(--accent); color: #000; }
  .zoomer span { min-width: 44px; text-align: center; color: var(--muted); font-variant-numeric: tabular-nums; }
  .selbox { position: absolute; border: 2px dashed var(--accent); border-radius: calc(var(--radius) + 6px); pointer-events: none; z-index: 900; }
  .selbox span { position: absolute; top: -26px; left: 0; background: var(--accent); color: #000; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 8px; white-space: nowrap; }
  .band { position: absolute; border: 1px solid var(--accent); background: rgba(122,162,255,.12); z-index: 950; pointer-events: none; }
</style>
