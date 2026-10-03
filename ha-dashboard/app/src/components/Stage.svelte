<script>
  // The dashboard canvas. Laid out at the device layout's design width and
  // scaled (CSS zoom) to fit the screen. In edit mode cards can be dragged
  // anywhere (including between the sidebar and main area) and resized from
  // any edge or corner. Positions snap to a 10px grid (hold Shift for 1px).
  import CardFrame from './CardFrame.svelte';
  import { app, layout, GRID, changed, zoneList } from '../lib/config.svelte.js';

  let { available, autoDevice } = $props();
  let vh = $state(innerHeight);
  let scrollY = $state(0);
  let sbEl = $state();

  const L = $derived(layout());
  const sb = $derived(L.sidebar.enabled ? L.sidebar.width : 0);
  const fit = $derived(available / L.width);
  const scale = $derived(app.device === autoDevice && !app.editing ? fit : Math.min(fit, 1));
  const left = $derived(Math.max(0, (available - L.width * scale) / 2));
  const mainW = $derived(L.width - sb);
  const origin = (zone) => ({
    x: zone === 'sidebar' ? (L.sidebar.side === 'right' ? L.width - sb : 0) : L.sidebar.side === 'right' ? 0 : sb,
    y: zone === 'sidebar' ? scrollY / scale - (sbEl?.scrollTop || 0) : 0,
  });
  const mainList = $derived(L.zones[app.view] || []);
  const sideList = $derived(L.zones.sidebar || []);
  const mainH = $derived(Math.max(vh / scale, mainList.reduce((m, p) => Math.max(m, p.y + p.h), 0) + (app.editing ? 400 : 20)));
  const sideH = $derived(Math.max(vh / scale, sideList.reduce((m, p) => Math.max(m, p.y + p.h), 0) + 20));

  let op = $state(null); // active drag/resize: { zone, index, mode, dir, sx, sy, o }
  const snap = (v, free) => (free ? Math.round(v) : Math.round(v / GRID) * GRID);

  function begin(e, zone, index, mode, dir) {
    if (!app.editing || e.button > 0) return;
    e.stopPropagation();
    e.preventDefault();
    app.selected = { zone, index };
    if (!app.panel) app.panel = 'card';
    const p = L.zones[zone][index];
    op = { zone, index, mode, dir, sx: e.clientX, sy: e.clientY, o: { ...p }, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function move(e) {
    if (!op) return;
    const p = L.zones[op.zone][op.index];
    const dx = (e.clientX - op.sx) / scale;
    const dy = (e.clientY - op.sy) / scale;
    if (!op.moved && Math.hypot(dx, dy) < 3) return;
    op.moved = true;
    const free = e.shiftKey;
    const o = op.o;
    if (op.mode === 'move') {
      p.x = snap(o.x + dx, free);
      p.y = Math.max(0, snap(o.y + dy, free));
      return;
    }
    const d = op.dir;
    const MIN = 40;
    if (d.includes('e')) p.w = Math.max(MIN, snap(o.w + dx, free));
    if (d.includes('s')) p.h = Math.max(MIN, snap(o.h + dy, free));
    if (d.includes('w')) { const nx = Math.min(o.x + o.w - MIN, snap(o.x + dx, free)); p.w = o.w + (o.x - nx); p.x = nx; }
    if (d.includes('n')) { const ny = Math.max(0, Math.min(o.y + o.h - MIN, snap(o.y + dy, free))); p.h = o.h + (o.y - ny); p.y = ny; }
  }

  function end(e) {
    if (!op) return;
    const { zone, index, mode, moved } = op;
    op = null;
    if (!moved) return;
    const list = L.zones[zone];
    const p = list[index];
    if (mode === 'move' && sb) {
      // Work out which zone the pointer was released over and move the card there.
      const sx = (e.clientX - left) / scale;
      const sbX = origin('sidebar').x;
      const target = sx >= sbX && sx < sbX + sb ? 'sidebar' : app.view;
      if (target !== zone) {
        const from = origin(zone), to = origin(target);
        list.splice(index, 1);
        p.x = snap(from.x + p.x - to.x);
        p.y = Math.max(0, snap(from.y + p.y - to.y));
        const dst = zoneList(target);
        dst.push(p);
        app.selected = { zone: target, index: dst.length - 1 };
      }
    }
    const z = app.selected.zone;
    const q = L.zones[z][app.selected.index];
    const zw = z === 'sidebar' ? sb : mainW;
    q.w = Math.min(q.w, zw);
    q.x = Math.max(0, Math.min(q.x, zw - q.w));
    changed();
  }

  function bgClick(e) {
    if (app.editing && e.target === e.currentTarget) app.selected = null;
  }

  const HANDLES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
  const isSel = (zone, i) => app.selected?.zone === zone && app.selected?.index === i;
</script>

<svelte:window bind:innerHeight={vh} bind:scrollY />

{#snippet zone(name, list, width)}
  {#each list as p, i (p.card + ':' + i)}
    {@const card = app.config.cards[p.card]}
    {#if card}
      <div class="place" class:sel={isSel(name, i)} class:active={op && isSel(name, i)}
        style="left:{p.x}px;top:{p.y}px;width:{p.w}px;height:{p.h}px;z-index:{(p.z || 0) + (op && isSel(name, i) ? 1000 : 0)}">
        <CardFrame {card} w={p.w} h={p.h} editing={app.editing} />
        {#if app.editing}
          <div class="grab" role="button" tabindex="-1" onpointerdown={(e) => begin(e, name, i, 'move')} onpointermove={move} onpointerup={end} onpointercancel={end}></div>
          {#if isSel(name, i)}
            {#each HANDLES as d}
              <div class="h h-{d}" role="button" tabindex="-1" onpointerdown={(e) => begin(e, name, i, 'resize', d)} onpointermove={move} onpointerup={end} onpointercancel={end}></div>
            {/each}
            {#if op}<div class="size">{p.w} × {p.h}{op.mode === 'move' ? `  @ ${p.x}, ${p.y}` : ''}</div>{/if}
          {/if}
        {/if}
      </div>
    {/if}
  {/each}
{/snippet}

<div class="stage" class:editing={app.editing} class:dragging={!!op} class:right={L.sidebar.side === 'right'}
  style="width:{L.width}px;zoom:{scale};margin-left:{left / scale}px;--grid:{GRID}px">
  {#if sb}
    <aside class="zone sidebar" bind:this={sbEl} style="width:{sb}px;height:{vh / scale}px" onpointerdown={bgClick}>
      <div class="inner" style="height:{sideH}px">{@render zone('sidebar', sideList, sb)}</div>
    </aside>
  {/if}
  <main class="zone main" style="width:{mainW}px;height:{mainH}px;{app.config.views.find((v) => v.id === app.view)?.background ? 'background:' + app.config.views.find((v) => v.id === app.view).background : ''}" onpointerdown={bgClick}>
    {@render zone(app.view, mainList, mainW)}
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
  .editing .zone { background-image: radial-gradient(circle, rgba(255,255,255,.09) 1px, transparent 1.2px); background-size: calc(var(--grid) * 2) calc(var(--grid) * 2); }
  .editing .sidebar { outline: 1px dashed rgba(122,162,255,.35); outline-offset: -1px; }
  .place { position: absolute; }
  .editing .place:hover { outline: 1px solid rgba(122,162,255,.4); outline-offset: 2px; border-radius: var(--radius); }
  .place.sel { outline: 2px solid var(--accent) !important; outline-offset: 2px; border-radius: var(--radius); }
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
</style>
