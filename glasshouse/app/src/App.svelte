<script>
  import Stage from './components/Stage.svelte';
  import Editor from './components/Editor.svelte';
  import Popup from './components/Popup.svelte';
  import Icon from './components/Icon.svelte';
  import { app, load, save, layout, DEVICES, detectDevice, setView, removeSelected, duplicateSelected, selectedPlacement, changed, undo, undoLast, selectionSet, ensureEditable, zoneList, groupSelected } from './lib/config.svelte.js';
  import { conn, toasts, watchEntities } from './lib/ha.svelte.js';
  import { GRID } from './lib/config.svelte.js';
  import { setKiosk } from './lib/kiosk.js';

  let vw = $state(innerWidth);
  const autoDevice = detectDevice();
  const panelOpen = $derived(app.editing && !!app.panel && vw > 760);
  const available = $derived(vw - (panelOpen ? 360 : 0));

  load();

  // Subscribe only to entities the dashboard uses (all of them while editing, for pickers).
  let watchTimer;
  $effect(() => {
    if (!app.config || !conn.connected) return;
    if (app.editing) return watchEntities(null);
    const ids = new Set();
    const walk = (v) => {
      if (typeof v === 'string') { if (/^[a-z_]+\.[a-z0-9_]+$/.test(v)) ids.add(v); }
      else if (v && typeof v === 'object') for (const x of Object.values(v)) walk(x);
    };
    walk(app.config.cards);
    if (app.popup?.entity) ids.add(app.popup.entity);
    clearTimeout(watchTimer);
    watchTimer = setTimeout(() => watchEntities(ids), 50);
  });

  // Hide HA's header bar: per device (Layout tab) or ?kiosk / ?kiosk=0 in the URL.
  const kioskParam = new URLSearchParams(location.search).get('kiosk');
  $effect(() => {
    if (!app.config) return;
    const on = kioskParam != null ? kioskParam !== '0' : !!app.config.layouts[app.device]?.kiosk;
    setKiosk(on);
  });

  const th = $derived(app.config?.theme);
  const rootStyle = $derived(th ? [
    `--text:${th.text}`, `--muted:${th.muted}`, `--accent:${th.accent}`, `--on:${th.on}`,
    `--card-bg:${th.cardBg}`, `--card-border:${th.cardBorder}`, `--card-shadow:${th.cardShadow}`,
    `--radius:${th.cardRadius}px`, `--pad:${th.cardPadding}px`, `--blur:${th.cardBlur}px`, `--sidebar-bg:${th.sidebarBg}`,
    `--font:${th.font}`, `--page-bg:${th.background}`,
  ].join(';') : '');
  $effect(() => { document.documentElement.style.cssText = rootStyle; });

  function toggleEdit() {
    app.editing = !app.editing;
    app.selected = null;
    if (app.editing) app.panel ??= 'add';
    else { if (app.dirty) save(); app.device = detectDevice(); }
  }

  function key(e) {
    if (e.target.closest('input,textarea,select,[contenteditable]')) return;
    if (e.key === 'e' && !e.ctrlKey && !e.metaKey) return toggleEdit();
    if (!app.editing) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); return undoLast(); }
    const p = selectedPlacement();
    if (e.key === 'Escape') { app.selected = null; app.multi = []; return; }
    if (!p) return;
    if (e.key === 'Delete' || e.key === 'Backspace') return removeSelected(false);
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); return duplicateSelected(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'g') { e.preventDefault(); return groupSelected(); }
    const step = e.shiftKey ? 1 : GRID;
    const mv = { ArrowLeft: ['x', -step], ArrowRight: ['x', step], ArrowUp: ['y', -step], ArrowDown: ['y', step] }[e.key];
    if (mv) {
      e.preventDefault();
      ensureEditable();
      const list = zoneList(app.selected.zone);
      for (const i of selectionSet()) list[i][mv[0]] = Math.max(0, list[i][mv[0]] + mv[1]);
      changed();
    }
  }

  // Keep the wall tablet awake-friendly: reload config if it changes elsewhere (every 60s while idle viewing).
  $effect(() => {
    if (app.editing) return;
    const i = setInterval(async () => {
      if (app.editing || app.dirty) return;
      const remote = await fetch('api/config').then((r) => r.text()).catch(() => null);
      if (remote && remote !== 'null' && remote !== JSON.stringify($state.snapshot(app.config))) load();
    }, 60000);
    return () => clearInterval(i);
  });
</script>

<svelte:window bind:innerWidth={vw} onkeydown={key} onhashchange={() => { const v = location.hash.slice(1); if (v) app.view = v; }} />
<svelte:head>
  {#if th?.fontUrl}<link rel="stylesheet" href={th.fontUrl} />{/if}
  {#if th?.customCss}{@html `<style>${th.customCss.replace(/<\/style/gi, '')}</style>`}{/if}
</svelte:head>

{#if app.config}
  <div class="app" class:noblur={!Number(th.cardBlur)}>
    <Stage {available} {autoDevice} />
  </div>

  {#if app.editing}
    {#if app.panel}<Editor />{/if}
    <div class="bar" style:right={panelOpen ? '380px' : '20px'}>
      <button class="done" onclick={toggleEdit}><Icon icon="mdi:check" size="1.2em" /> Done</button>
      <button title="Undo (Ctrl+Z)" disabled={!undo.count && !app.dirty} onclick={undoLast}><Icon icon="mdi:undo" size="1.2em" /></button>
      <select value={app.view} onchange={(e) => setView(e.currentTarget.value)} title="View">
        {#each app.config.views as v}<option value={v.id}>{v.name}</option>{/each}
      </select>
      <select value={app.device} onchange={(e) => { app.device = e.currentTarget.value; app.selected = null; app.multi = []; }} title="Preview / edit device">
        {#each Object.entries(DEVICES) as [k, d]}<option value={k}>{d.label}{k !== 'tablet' ? ` · ${app.config.layouts[k].mode}` : ''}</option>{/each}
      </select>
      <button title="Toggle panel" onclick={() => (app.panel = app.panel ? null : 'add')}><Icon icon="mdi:dock-right" size="1.2em" /></button>
      <span class="st">{app.saving ? 'Saving…' : app.dirty ? 'Unsaved' : 'Saved'}</span>
    </div>
  {:else}
    <button class="edit-fab" onclick={toggleEdit} aria-label="Edit dashboard"><Icon icon="mdi:pencil" size="1.1em" /></button>
  {/if}
{/if}

{#if !conn.connected}<div class="offline"><Icon icon="mdi:lan-disconnect" size="1em" /> Connecting to Home Assistant…</div>{/if}
<div class="toasts">{#each toasts as t (t.id)}<div class="toast">{t.text}</div>{/each}</div>
<Popup />

<style>
  .app { min-height: 100dvh; }
  .noblur :global(.card) { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
  .bar { position: fixed; bottom: 20px; z-index: 850; display: flex; align-items: center; gap: 6px; padding: 6px; background: rgba(20,24,36,.95); border: 1px solid rgba(255,255,255,.1); border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,.5); font-size: 13px; transition: right .2s; }
  .bar button, .bar select { background: rgba(255,255,255,.07); border: 0; color: inherit; height: 36px; padding: 0 10px; border-radius: 10px; font: inherit; display: inline-flex; align-items: center; gap: 6px; }
  .bar button:disabled { opacity: .35; }
  .bar .done { background: var(--accent); color: #000; font-weight: 600; }
  .st { color: var(--muted); padding: 0 6px; min-width: 56px; }
  .edit-fab { position: fixed; top: 10px; right: 10px; z-index: 700; width: 36px; height: 36px; border-radius: 50%; border: 0; background: rgba(255,255,255,.06); color: var(--muted); opacity: .25; display: grid; place-items: center; transition: opacity .2s; }
  .edit-fab:hover { opacity: 1; }
  .offline { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 950; background: rgba(255,120,80,.9); color: #000; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; display: flex; gap: 6px; align-items: center; }
  .toasts { position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%); z-index: 960; display: flex; flex-direction: column; gap: 6px; }
  .toast { background: #2a2f40; padding: 10px 16px; border-radius: 12px; box-shadow: 0 6px 20px rgba(0,0,0,.4); font-size: 14px; }
  @media (max-width: 760px) {
    .app :global(.ed) { top: auto; height: 55dvh; width: 100%; border-left: 0; border-top: 1px solid rgba(255,255,255,.1); border-radius: 18px 18px 0 0; }
    .bar { bottom: calc(55dvh + 10px); right: 10px !important; left: 10px; overflow-x: auto; }
  }
</style>
