<script>
  import Icon from './Icon.svelte';
  import Field from './Field.svelte';
  import { cards, categories } from '../lib/registry.js';
  import {
    app, layout, DEVICES, DEFAULT_THEME, changed, addCard, selectedCard, selectedPlacement, removeSelected,
    duplicateSelected, copyLayout, importConfig, selectionSet, groupSelected, ungroupSelected, ensureEditable, setMode, MODES, zoneList, addView, removeView, setView, isPlacedAnywhere, placeExisting, zoneWidth,
  } from '../lib/config.svelte.js';

  import { fromFusion } from '../lib/fusion.js';
  import { toast } from '../lib/ha.svelte.js';
  let importing = $state(false);
  async function importFusion() {
    if (!confirm('Replace this dashboard with one built from ha-fusion?')) return;
    importing = true;
    try {
      const r = await fetch('api/fusion');
      const db = await r.json();
      if (!r.ok) throw new Error(db.error || 'Could not read ha-fusion');
      importConfig(fromFusion(db));
      app.view = app.config.views[0].id;
      toast('Imported from ha-fusion');
    } catch (e) {
      toast(e.message);
    } finally {
      importing = false;
    }
  }

  const card = $derived(selectedCard());
  const place = $derived(selectedPlacement());
  const def = $derived(card && cards[card.type]);
  let addTo = $state('main');
  let section = $state('content');

  const STYLE = [
    { key: 'background', label: 'Background', type: 'color', placeholder: 'rgba(...) / gradient / template' },
    { key: 'backgroundImage', label: 'Background image URL', type: 'text' },
    { key: 'color', label: 'Text colour', type: 'color' },
    { key: 'accent', label: 'Accent / active colour', type: 'color' },
    { key: 'radius', label: 'Corner radius', type: 'text', placeholder: '22' },
    { key: 'padding', label: 'Padding', type: 'text', placeholder: '16' },
    { key: 'border', label: 'Border', type: 'text', placeholder: '1px solid rgba(255,255,255,.1)' },
    { key: 'shadow', label: 'Shadow', type: 'text', placeholder: '0 8px 30px rgba(0,0,0,.3)' },
    { key: 'blur', label: 'Backdrop blur', type: 'text', placeholder: '18' },
    { key: 'opacity', label: 'Opacity', type: 'text', placeholder: '1' },
    { key: 'font', label: 'Font family', type: 'text' },
    { key: 'fontSize', label: 'Font size', type: 'text', placeholder: '16' },
    { key: 'fontWeight', label: 'Font weight', type: 'select', options: ['', '300', '400', '500', '600', '700'] },
    { key: 'align', label: 'Text align', type: 'select', options: ['', 'left', 'center', 'right'] },
    { key: 'css', label: 'Custom CSS (declarations)', type: 'textarea' },
  ];
  const ACTIONS = ['default', 'toggle', 'more-info', 'popup', 'navigate', 'service', 'url', 'none'];
  const actFields = (a) => [
    { key: 'action', label: 'Action', type: 'select', options: ACTIONS },
    ...(a?.action === 'popup' ? [{ key: 'title', label: 'Pop-up title', type: 'text' }, { key: 'cards', label: 'Cards in pop-up', type: 'cards' }] : []),
    ...(a?.action === 'navigate' ? [{ key: 'view', label: 'View', type: 'select', options: app.config.views.map((v) => ({ value: v.id, label: v.name })) }] : []),
    ...(a?.action === 'service' ? [{ key: 'service', label: 'Service (domain.service)', type: 'text', placeholder: 'light.turn_on' }, { key: 'data', label: 'Data (JSON, template ok)', type: 'textarea' }] : []),
    ...(a?.action === 'url' ? [{ key: 'url', label: 'URL', type: 'text' }] : []),
  ];
  const THEME = [
    { key: 'background', label: 'Page background (css)', type: 'textarea' },
    { key: 'sidebarBg', label: 'Sidebar background', type: 'color' },
    { key: 'text', label: 'Text', type: 'color' },
    { key: 'muted', label: 'Secondary text', type: 'color' },
    { key: 'accent', label: 'Accent', type: 'color' },
    { key: 'on', label: 'Active / on colour', type: 'color' },
    { key: 'cardBg', label: 'Card background', type: 'color' },
    { key: 'cardBorder', label: 'Card border', type: 'text' },
    { key: 'cardShadow', label: 'Card shadow', type: 'text' },
    { key: 'cardRadius', label: 'Card radius', type: 'number' },
    { key: 'cardPadding', label: 'Card padding', type: 'number' },
    { key: 'cardBlur', label: 'Card blur (0 = fastest)', type: 'number' },
    { key: 'font', label: 'Font family', type: 'text' },
    { key: 'fontUrl', label: 'Font stylesheet URL (e.g. Google Fonts)', type: 'text' },
    { key: 'customCss', label: 'Custom CSS (global)', type: 'textarea' },
  ];

  const unplaced = $derived(Object.values(app.config.cards).filter((c) => !Object.values(layout().zones).some((z) => z.some((p) => p.card === c.id))));
  const label = (c) => `${cards[c.type]?.meta.name || c.type}${c.props?.name ? ' · ' + c.props.name : c.props?.entity ? ' · ' + c.props.entity : c.props?.title ? ' · ' + c.props.title : ''}`;
  const num = (k, v) => { ensureEditable(); const p = selectedPlacement(); p[k] = Math.max(k === 'w' || k === 'h' ? 20 : 0, Number(v) || 0); changed(); };
  const multiCount = $derived(selectionSet().length);
  function align(k) {
    ensureEditable();
    const list = zoneList(app.selected.zone);
    const idx = selectionSet();
    const ref = list[app.selected.index];
    for (const i of idx) {
      if (k === 'left') list[i].x = Math.min(...idx.map((j) => list[j].x));
      if (k === 'top') list[i].y = Math.min(...idx.map((j) => list[j].y));
      if (k === 'width') list[i].w = ref.w;
      if (k === 'height') list[i].h = ref.h;
    }
    changed();
  }
  // Card sections that can be shown / hidden.
  const sections = $derived(def?.meta.sections || []);
  function toggleSection(k) {
    card.props.hide ??= {};
    card.props.hide[k] = !card.props.hide[k];
    changed();
  }
</script>

<aside class="ed">
  <div class="tabs">
    {#each [['add', 'mdi:plus', 'Add'], ['card', 'mdi:card-bulleted-settings-outline', 'Card'], ['layout', 'mdi:devices', 'Layout'], ['views', 'mdi:view-dashboard-outline', 'Views'], ['theme', 'mdi:palette-outline', 'Theme']] as [k, ic, l]}
      <button class:on={app.panel === k} onclick={() => (app.panel = k)}><Icon icon={ic} size="1.2em" /><span>{l}</span></button>
    {/each}
  </div>

  <div class="body">
    {#if app.panel === 'add'}
      <div class="row seg">
        <button class:on={addTo === 'main'} onclick={() => (addTo = 'main')}>Main area</button>
        <button class:on={addTo === 'sidebar'} disabled={!layout().sidebar.enabled} onclick={() => (addTo = 'sidebar')}>Sidebar</button>
      </div>
      {#each categories as cat}
        {@const list = Object.values(cards).filter((c) => c.meta.category === cat)}
        {#if list.length}
          <h4>{cat}</h4>
          <div class="types">
            {#each list as c}
              <button onclick={() => addCard(c.meta.type, c.meta, addTo === 'sidebar' && layout().sidebar.enabled ? 'sidebar' : app.view)}>
                <Icon icon={c.meta.icon} size="1.5em" /><span>{c.meta.name}</span>
              </button>
            {/each}
          </div>
        {/if}
      {/each}
      {#if unplaced.length}
        <h4>Existing cards not on this device</h4>
        {#each unplaced as c}
          <div class="line"><span>{label(c)}</span><button class="sm" onclick={() => placeExisting(c.id, addTo === 'sidebar' && layout().sidebar.enabled ? 'sidebar' : app.view)}>Place</button></div>
        {/each}
      {/if}
    {:else if app.panel === 'card'}
      {#if multiCount > 1 && app.single === false && app.multi.length > 1}
        <div class="title"><Icon icon="mdi:select-group" size="1.3em" /> {multiCount} cards selected</div>
        <div class="row">
          <button class="sm" onclick={groupSelected}><Icon icon="mdi:group" size="1em" /> Group (Ctrl+G)</button>
          <button class="sm" onclick={ungroupSelected}><Icon icon="mdi:ungroup" size="1em" /> Ungroup</button>
        </div>
        <h4>Align &amp; size</h4>
        <div class="row">
          {#each [['left', 'mdi:align-horizontal-left'], ['top', 'mdi:align-vertical-top'], ['width', 'mdi:arrow-expand-horizontal'], ['height', 'mdi:arrow-expand-vertical']] as [k, ic]}
            <button class="sm" onclick={() => align(k)} title={k === 'width' || k === 'height' ? `Same ${k}` : `Align ${k}`}><Icon icon={ic} size="1.1em" /> {k === 'width' || k === 'height' ? `Same ${k}` : `Align ${k}`}</button>
          {/each}
        </div>
        <p class="hint">Drag any selected card to move them all. Shift/Ctrl-click to add or remove cards; drag a box on empty space to select.</p>
        <div class="row danger">
          <button class="sm" onclick={() => removeSelected(false)}><Icon icon="mdi:eye-off-outline" size="1em" /> Unplace</button>
          <button class="sm red" onclick={() => confirm(`Delete ${multiCount} cards from every layout?`) && removeSelected(true)}><Icon icon="mdi:delete-outline" size="1em" /> Delete</button>
        </div>
      {:else if !card}
        <p class="hint">Select a card to edit it, or use <b>Add</b> to create one. Drag cards to move them; drag any edge or corner to resize. Hold Shift for pixel-precise moves. Arrow keys nudge, Delete removes, Ctrl+D duplicates.</p>
      {:else}
        <div class="title"><Icon icon={def?.meta.icon} size="1.3em" /> {def?.meta.name || card.type}</div>
        {#if place?.group}
          <div class="grp">
            <Icon icon="mdi:group" size="1.1em" />
            <span>{app.single ? 'Editing one card of a group' : `In a group of ${multiCount} — moves together. Double-tap a card to move it alone.`}</span>
            {#if app.single}<button class="sm" onclick={() => (app.single = false)}>Whole group</button>{/if}
            <button class="sm" onclick={ungroupSelected}>Ungroup</button>
          </div>
        {/if}
        <div class="seg row">
          {#each [['content', 'Content'], ['style', 'Style'], ['actions', 'Actions'], ['position', 'Size']] as [k, l]}
            <button class:on={section === k} onclick={() => (section = k)}>{l}</button>
          {/each}
        </div>
        {#if section === 'content'}
          {#if sections.length}
            <div class="secs">
              <span class="lbl">Show</span>
              {#each sections as sct}
                <button class:off={card.props.hide?.[sct.key]} onclick={() => toggleSection(sct.key)}><Icon icon={card.props.hide?.[sct.key] ? 'mdi:eye-off-outline' : 'mdi:eye'} size="1em" /> {sct.label}</button>
              {/each}
            </div>
          {/if}
          <div class="fields">{#each def?.meta.fields || [] as f (f.key)}<Field obj={card.props} {f} hide={f.section && card.props.hide?.[f.section]} ontoggle={f.section ? () => toggleSection(f.section) : null} />{/each}</div>
          <Field obj={card} f={{ key: 'visible', label: 'Visible when (template, blank = always)', type: 'text', placeholder: "{{ is_state('sun.sun','below_horizon') }}" }} />
        {:else if section === 'style'}
          <div class="fields">{#each STYLE as f (f.key)}<Field obj={card.style} {f} />{/each}</div>
          <button class="sm" onclick={() => { card.style = {}; changed(); }}>Reset style</button>
        {:else if section === 'actions'}
          <h4>Tap</h4>
          <div class="fields">{#each actFields(card.tap) as f (f.key)}<Field obj={card.tap} {f} />{/each}</div>
          <h4>Hold</h4>
          <div class="fields">{#each actFields(card.hold) as f (f.key)}<Field obj={card.hold} {f} />{/each}</div>
          <Field obj={card} f={{ key: 'popupHeight', label: 'Height when shown inside a pop-up', type: 'number' }} />
        {:else}
          <div class="grid4">
            {#each [['x', 'X'], ['y', 'Y'], ['w', 'Width'], ['h', 'Height']] as [k, l]}
              <label>{l}<input type="number" step="10" value={place[k]} oninput={(e) => num(k, e.currentTarget.value)} /></label>
            {/each}
          </div>
          <div class="row">
            <button class="sm" onclick={() => { place.x = 0; place.w = zoneWidth(app.selected.zone); changed(); }}>Full width</button>
            <button class="sm" onclick={() => { place.z = (place.z || 0) + 1; changed(); }}>Bring forward</button>
            <button class="sm" onclick={() => { place.z = (place.z || 0) - 1; changed(); }}>Send back</button>
          </div>
        {/if}
        <div class="row danger">
          <button class="sm" onclick={duplicateSelected}><Icon icon="mdi:content-copy" size="1em" /> Duplicate</button>
          <button class="sm" onclick={() => removeSelected(false)} title="Remove from this layout (keeps the card for pop-ups / other devices)"><Icon icon="mdi:eye-off-outline" size="1em" /> Unplace{multiCount > 1 ? ' group' : ''}</button>
          <button class="sm red" onclick={() => (multiCount < 2 || confirm(`Delete all ${multiCount} cards in this group?`)) && removeSelected(true)}><Icon icon="mdi:delete-outline" size="1em" /> Delete{multiCount > 1 ? ` group (${multiCount})` : ''}</button>
        </div>
      {/if}
    {:else if app.panel === 'layout'}
      <h4>Devices</h4>
      <div class="row seg">
        {#each Object.entries(DEVICES) as [k, d]}<button class:on={app.device === k} onclick={() => { app.device = k; app.selected = null; app.multi = []; }}>{d.label}</button>{/each}
      </div>
      {#if app.device === 'tablet'}
        <p class="hint">The <b>main layout</b> is shown on every device unless you give a device its own. Pin a screen to a device with <code>?device=phone</code> / <code>desktop</code> in the URL.</p>
      {:else}
        <div class="fields">
          <Field obj={{ mode: app.config.layouts[app.device].mode }} f={{ key: 'mode', label: `${DEVICES[app.device].label} shows`, type: 'select', options: Object.entries(MODES).map(([value, label]) => ({ value, label })) }} onset={(v) => (v === 'custom' || confirm('Discard this device\'s own layout?')) && setMode(app.device, v)} />
        </div>
        <p class="hint">{app.config.layouts[app.device].mode === 'custom' ? 'This device has its own layout. Cards added anywhere are still added here too.' : 'Edits here change the main layout' + (app.config.layouts[app.device].mode === 'auto' ? ' — or drag something to start a custom phone layout.' : '.')}</p>
      {/if}
      {#if app.device === 'tablet' || app.config.layouts[app.device].mode === 'custom'}
        <div class="fields">
          <Field obj={layout()} f={{ key: 'width', label: 'Design width (px) — scaled to fit the screen', type: 'number' }} />
        </div>
        <h4>Sidebar</h4>
        <div class="fields">
          <Field obj={layout().sidebar} f={{ key: 'enabled', label: 'Show sidebar', type: 'bool' }} />
          <Field obj={layout().sidebar} f={{ key: 'side', label: 'Side', type: 'select', options: ['left', 'right'] }} />
          <Field obj={layout().sidebar} f={{ key: 'width', label: 'Width', type: 'number' }} />
        </div>
      {/if}
      {#if app.device !== 'tablet' && app.config.layouts[app.device].mode === 'custom'}
        <div class="row"><button class="sm" onclick={() => confirm('Replace with the main layout scaled to fit?') && copyLayout('tablet')}>Copy from main layout</button></div>
      {/if}
      <h4>Import</h4>
      <button class="sm" disabled={importing} onclick={importFusion}><Icon icon="mdi:import" size="1em" /> {importing ? 'Importing…' : 'Import from ha-fusion'}</button>
      <p class="hint">Rebuilds all three device layouts from your ha-fusion dashboard (rooms, buttons with their templates, cameras, sidebar) and adds an Energy view. Replaces the current dashboard — export first if you want a backup.</p>
      <h4>Backup</h4>
      <div class="row">
        <button class="sm" onclick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify($state.snapshot(app.config), null, 2)])); a.download = 'dashboard.json'; a.click(); }}>Export</button>
        <label class="sm file">Import<input type="file" accept=".json" onchange={async (e) => { const f = e.currentTarget.files[0]; if (f && confirm('Replace the whole dashboard?')) { importConfig(JSON.parse(await f.text())); } }} /></label>
      </div>
    {:else if app.panel === 'views'}
      {#each app.config.views as v, i (v.id)}
        <div class="view" class:cur={app.view === v.id}>
          <div class="row">
            <button class="sm" onclick={() => setView(v.id)}>Open</button>
            <button class="sm" disabled={i === 0} onclick={() => { const a = app.config.views; [a[i - 1], a[i]] = [a[i], a[i - 1]]; changed(); }}><Icon icon="mdi:arrow-up" size="1em" /></button>
            <button class="sm red" disabled={app.config.views.length < 2} onclick={() => confirm(`Delete view ${v.name}?`) && removeView(v.id)}><Icon icon="mdi:delete-outline" size="1em" /></button>
          </div>
          <div class="fields">
            <Field obj={v} f={{ key: 'name', label: 'Name', type: 'text' }} />
            <Field obj={v} f={{ key: 'icon', label: 'Icon', type: 'icon' }} />
            <Field obj={v} f={{ key: 'background', label: 'Background (overrides theme)', type: 'text' }} />
          </div>
        </div>
      {/each}
      <button class="sm" onclick={() => addView('New view')}><Icon icon="mdi:plus" size="1em" /> Add view</button>
    {:else if app.panel === 'theme'}
      <div class="fields">{#each THEME as f (f.key)}<Field obj={app.config.theme} {f} />{/each}</div>
      <button class="sm" onclick={() => { app.config.theme = { ...DEFAULT_THEME }; changed(); }}>Reset theme</button>
    {/if}
  </div>
</aside>

<style>
  .ed { position: fixed; top: 0; right: 0; bottom: 0; width: 360px; z-index: 800; background: rgba(16,19,28,.97); border-left: 1px solid rgba(255,255,255,.08); display: flex; flex-direction: column; font-size: 14px; box-shadow: -10px 0 40px rgba(0,0,0,.4); }
  .tabs { display: flex; border-bottom: 1px solid rgba(255,255,255,.08); }
  .tabs button { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 10px 0 8px; background: none; border: 0; color: var(--muted); font: inherit; font-size: 11px; border-bottom: 2px solid transparent; }
  .tabs button.on { color: var(--text); border-bottom-color: var(--accent); }
  .body { flex: 1; overflow: auto; padding: 14px 16px 40px; display: flex; flex-direction: column; gap: 12px; }
  h4 { margin: 8px 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); font-weight: 600; }
  .title { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 16px; }
  .fields { display: flex; flex-direction: column; gap: 10px; }
  .types { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .types button { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 4px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.06); border-radius: 12px; color: inherit; font: inherit; font-size: 12px; text-align: center; }
  .types button:hover { background: rgba(122,162,255,.15); border-color: rgba(122,162,255,.4); }
  .row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
  .seg { background: rgba(255,255,255,.05); border-radius: 10px; padding: 3px; flex-wrap: nowrap; }
  .seg button { flex: 1; background: none; border: 0; color: var(--muted); padding: 7px 4px; border-radius: 8px; font: inherit; font-size: 13px; }
  .seg button.on { background: rgba(255,255,255,.1); color: var(--text); }
  .sm { display: inline-flex; align-items: center; gap: 5px; background: rgba(255,255,255,.07); border: 0; color: inherit; padding: 7px 11px; border-radius: 9px; font: inherit; font-size: 13px; cursor: pointer; }
  .sm:hover { background: rgba(255,255,255,.13); }
  .sm:disabled { opacity: .35; }
  .red { color: #ff8a8a; }
  .danger { margin-top: 8px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,.08); }
  .hint { color: var(--muted); font-size: 13px; line-height: 1.5; margin: 0; }
  .grid4 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .grid4 label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--muted); }
  .line { display: flex; align-items: center; gap: 8px; font-size: 13px; }
  .line span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .view { padding: 10px; border-radius: 12px; background: rgba(255,255,255,.03); display: flex; flex-direction: column; gap: 8px; }
  .view.cur { outline: 1px solid rgba(122,162,255,.4); }
  .file input { display: none; }
  .grp { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12.5px; color: var(--muted); background: rgba(122,162,255,.08); border-radius: 10px; padding: 8px 10px; }
  .grp span { flex: 1; min-width: 150px; }
  .secs { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
  .secs .lbl { font-size: 12px; color: var(--muted); margin-right: 2px; }
  .secs button { display: inline-flex; align-items: center; gap: 4px; border: 1px solid rgba(122,162,255,.4); background: rgba(122,162,255,.12); color: var(--text); border-radius: 20px; padding: 4px 10px; font-size: 12px; }
  .secs button.off { border-color: rgba(255,255,255,.1); background: none; color: var(--muted); text-decoration: line-through; }
  code { background: rgba(255,255,255,.08); padding: 1px 5px; border-radius: 5px; }
</style>
