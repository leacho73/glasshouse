<script module>
  import { find } from '../lib/octopus.js';
  const first = (...res) => { for (const re of res) { const id = find(re); if (id) return id; } return ''; };
  export const meta = {
    type: 'energyflow', name: 'Energy flow', icon: 'mdi:transit-connection-variant', category: 'Energy',
    size: { w: 460, h: 320 }, tap: 'none',
    defaults: { name: 'Energy flow' },
    sections: [{ key: 'self', label: 'Self-powered %' }, { key: 'tiles', label: 'Solar / battery / house figures' }, { key: 'flow', label: 'Flow chart' }, { key: 'grid', label: 'Grid', section: 'grid' }, { key: 'battery', label: 'Battery', section: 'battery' }],
    // Totals plus, where the integration has them, a sensor for each route
    // (solar→house etc.). Without route sensors the routes are worked out.
    autofill: () => ({
      solar: first(/^sensor\.solar_panel_production_w$/, /^sensor\.solaredge_(i\d_)?ac_power$/, /^sensor\.solar_production_w$/),
      home: first(/^sensor\.solar_house_consumption_w$/, /^sensor\.house_power$/),
      battery_soc: first(/^sensor\.solaredge_(i\d_)?b\d_state_of_energy$/, /^sensor\.battery_level$/),
      // SolarEdge reports battery DC power as + charging, so it's inverted.
      ...(find(/^sensor\.solaredge_(i\d_)?b\d_dc_power$/) ? { battery: find(/^sensor\.solaredge_(i\d_)?b\d_dc_power$/), battery_invert: true } : { battery: first(/^sensor\.battery_power$/) }),
      grid_import: first(/^sensor\.solar_imported_power_w$/),
      grid_export: first(/^sensor\.solar_exported_power_w$/),
      solar_home: first(/^sensor\.solar_panel_to_house_w$/),
      solar_battery: first(/^sensor\.solar_panel_to_battery_w$/),
      solar_grid: first(/^sensor\.solar_panel_to_grid_w$/),
      battery_home: first(/^sensor\.solar_battery_to_house_w$/),
      battery_grid: first(/^sensor\.solar_battery_to_grid_w$/),
      grid_home: first(/^sensor\.solar_grid_to_house_w$/),
      grid_battery: first(/^sensor\.solar_grid_to_battery_w$/),
    }),
    fields: [
      { key: 'name', label: 'Title', type: 'text' },
      { key: 'solar', label: 'Solar power', type: 'entity', domain: 'sensor' },
      { key: 'home', label: 'House power (blank = worked out)', type: 'entity', domain: 'sensor' },
      { key: 'grid', label: 'Grid power, one sensor (+import / −export)', type: 'entity', domain: 'sensor', section: 'grid' },
      { key: 'grid_invert', label: 'Invert grid sign', type: 'bool', section: 'grid' },
      { key: 'grid_import', label: '…or grid import power', type: 'entity', domain: 'sensor', section: 'grid' },
      { key: 'grid_export', label: '…and grid export power', type: 'entity', domain: 'sensor', section: 'grid' },
      { key: 'battery', label: 'Battery power, one sensor (+discharge / −charge)', type: 'entity', domain: 'sensor', section: 'battery' },
      { key: 'battery_invert', label: 'Invert battery sign', type: 'bool', section: 'battery' },
      { key: 'battery_soc', label: 'Battery %', type: 'entity', domain: 'sensor', section: 'battery' },
      { key: 'solar_home', label: 'Route: solar → house (optional)', type: 'entity', domain: 'sensor' },
      { key: 'solar_battery', label: 'Route: solar → battery (optional)', type: 'entity', domain: 'sensor' },
      { key: 'solar_grid', label: 'Route: solar → grid (optional)', type: 'entity', domain: 'sensor' },
      { key: 'battery_home', label: 'Route: battery → house (optional)', type: 'entity', domain: 'sensor' },
      { key: 'battery_grid', label: 'Route: battery → grid (optional)', type: 'entity', domain: 'sensor' },
      { key: 'grid_home', label: 'Route: grid → house (optional)', type: 'entity', domain: 'sensor' },
      { key: 'grid_battery', label: 'Route: grid → battery (optional)', type: 'entity', domain: 'sensor' },
    ],
  };
</script>

<script>
  // Where the house's power is coming from and going to right now: solar,
  // battery and house figures, and a flow chart whose bands are as thick as
  // the power on each route (solar → house, solar → battery, battery → house…).
  import { untrack } from 'svelte';
  import Icon from '../components/Icon.svelte';
  import { t, ent } from '../lib/tpl.js';
  let { props, w = 460, h = 320 } = $props();
  const show = (k) => !props.hide?.[k];

  const read = (id) => {
    const e = ent(id);
    const v = Number(e?.state);
    if (!e || !Number.isFinite(v)) return null;
    const u = (e.attributes.unit_of_measurement || 'W').toLowerCase();
    return u === 'kw' ? v * 1000 : u === 'mw' ? v * 1e6 : v;
  };
  // Solar, grid and battery sensors often report a moment apart, and adding up
  // a half-updated set makes the figures flicker through in-between values.
  // Wait for them to settle (at most a second) before redrawing.
  const ids = $derived(Object.entries(props).filter(([k, v]) => k !== 'battery_soc' && typeof v === 'string' && v.startsWith('sensor.')).map(([, v]) => v));
  const live = $derived(Object.fromEntries(ids.map((id) => [id, read(id)])));
  let settled = $state.raw(null);
  let timer, since = 0;
  $effect(() => {
    const v = live;
    if (!untrack(() => settled)) return void (settled = v);
    clearTimeout(timer);
    since ||= Date.now();
    const go = () => { settled = v; since = 0; };
    Date.now() - since > 1000 ? go() : (timer = setTimeout(go, 350));
  });
  $effect(() => () => clearTimeout(timer));
  const watts = (id) => (settled && id in settled ? settled[id] : read(id));
  const pos = (v) => Math.max(0, v ?? 0);

  const hasGrid = $derived(show('grid') && !!(props.grid || props.grid_import || props.grid_export || props.grid_home));
  const hasBatt = $derived(show('battery') && !!(props.battery || props.battery_soc || props.solar_battery || props.battery_home));

  // Totals: + grid = importing, + battery = discharging.
  const solar = $derived(pos(watts(props.solar)));
  const grid = $derived(props.grid ? (watts(props.grid) ?? 0) * (props.grid_invert ? -1 : 1) : pos(watts(props.grid_import)) - pos(watts(props.grid_export)));
  const batt = $derived(props.battery ? (watts(props.battery) ?? 0) * (props.battery_invert ? -1 : 1) : null);

  // Each route: its own sensor where there is one, otherwise worked out —
  // solar feeds the house first, then the battery, then export; the battery
  // covers the rest of the house; the grid makes up anything left.
  const routes = $derived.by(() => {
    const given = { sh: props.solar_home, sb: props.solar_battery, sg: props.solar_grid, bh: props.battery_home, bg: props.battery_grid, gh: props.grid_home, gb: props.grid_battery };
    if (Object.values(given).some(Boolean)) {
      const r = Object.fromEntries(Object.entries(given).map(([k, id]) => [k, pos(watts(id))]));
      // Route sensors are often templates that don't quite add up (e.g. battery
      // → house missing the inverter's share). Trust the totals where we have them.
      if (batt != null) {
        const dis = pos(batt), charge = pos(-batt);
        if (Math.abs(r.bh + r.bg - dis) > 50) r.bh = pos(dis - r.bg);
        if (Math.abs(r.sb + r.gb - charge) > 50) r.gb = pos(charge - r.sb);
      } else if (props.home) {
        // No battery power sensor: whatever the house uses that solar and the
        // grid don't cover is coming from the battery.
        const short = pos(watts(props.home)) - r.sh - r.bh - r.gh;
        if (short > 50 && (r.bh > 0 || r.bg > 0)) r.bh += short;
      }
      return r;
    }
    const b = batt ?? 0, charge = pos(-b), dis = pos(b), imp = pos(grid), exp = pos(-grid);
    const house = props.home ? pos(watts(props.home)) : pos(solar + grid + b);
    const sh = Math.min(solar, house), sb = Math.min(solar - sh, charge), sg = Math.min(pos(solar - sh - sb), exp);
    const bh = Math.min(dis, pos(house - sh)), bg = Math.min(pos(dis - bh), pos(exp - sg));
    return { sh, sb, sg, bh, bg, gh: Math.min(imp, pos(house - sh - bh)), gb: Math.min(pos(imp - (house - sh - bh)), pos(charge - sb)) };
  });
  const house = $derived(props.home ? pos(watts(props.home)) : routes.sh + routes.bh + routes.gh);
  const battNet = $derived(batt ?? routes.bh + routes.bg - routes.sb - routes.gb);
  const gridNet = $derived(props.grid || props.grid_import || props.grid_export ? grid : routes.gh + routes.gb - routes.sg - routes.bg);
  const soc = $derived(Number(ent(props.battery_soc)?.state));
  // Share of the house's power that isn't coming from the grid.
  const selfPct = $derived(house > 20 ? Math.round(((routes.sh + routes.bh) / Math.max(house, routes.sh + routes.bh + routes.gh)) * 100) : null);

  const C = { solar: '#ffc247', batt: '#5bd88f', grid: '#9aa9c4', house: '#7aa2ff', exp: '#c792ff' };
  const fmt = (v) => (v == null ? '—' : Math.abs(v) >= 1000 ? (Math.abs(v) / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 2) : String(Math.round(Math.abs(v))));
  const u = (v) => (v != null && Math.abs(v) >= 1000 ? 'kW' : 'W');
  const kfmt = (v) => `${fmt(v)} ${u(v)}`;
  const IDLE = 15;

  // Flow chart: sources on the left, where it goes on the right.
  const SRC = [['s', 'Solar', C.solar], ['b', 'Battery', C.batt], ['g', 'Grid', C.grid]];
  const DST = [['h', 'House', C.house], ['b', 'Battery', C.batt], ['g', 'Export', C.exp]];
  let cw = $state(400), ch = $state(160);
  const BAR = 8, GAP = 8;
  const chart = $derived.by(() => {
    const flows = Object.entries(routes).filter(([k, v]) => v > IDLE && (hasGrid || !k.includes('g')) && (hasBatt || !k.includes('b'))).map(([k, v]) => ({ k, from: k[0], to: k[1], v }));
    const total = flows.reduce((a, f) => a + f.v, 0);
    if (!total || cw < 80 || ch < 40) return null;
    const srcs = SRC.filter(([id]) => flows.some((f) => f.from === id));
    const dsts = DST.filter(([id]) => flows.some((f) => f.to === id));
    // Small routes (e.g. 45 W of export next to 2 kW) still get a visible band
    // and each end a bar tall enough to label; the rest shrinks to make room.
    const MIN_TH = 3, MIN_NODE = 14;
    const nodeH = (id, side, sc) => Math.max(MIN_NODE, flows.filter((f) => f[side] === id).reduce((a, f) => a + Math.max(MIN_TH, f.v * sc), 0));
    const height = (list, side, sc) => list.reduce((a, [id]) => a + nodeH(id, side, sc), 0) + GAP * (list.length - 1);
    let scale = (ch - GAP * (Math.max(srcs.length, dsts.length) - 1)) / total;
    for (let i = 0; i < 8; i++) {
      const tall = Math.max(height(srcs, 'from', scale), height(dsts, 'to', scale));
      if (tall <= ch + 0.5) break;
      scale *= Math.max(0.5, (ch - (tall - total * scale)) / (total * scale));
    }
    const thick = (f) => Math.max(MIN_TH, f.v * scale);
    const stack = (list, side) => {
      let y = Math.max(0, (ch - height(list, side, scale)) / 2);
      return Object.fromEntries(list.map(([id, label, c]) => {
        const mine = flows.filter((f) => f[side] === id);
        const v = mine.reduce((a, f) => a + f.v, 0), bandH = mine.reduce((a, f) => a + thick(f), 0);
        const n = { id, label, c, v, y, h: nodeH(id, side, scale), at: 0 };
        n.at = y + (n.h - bandH) / 2;
        y += n.h + GAP;
        return [id, n];
      }));
    };
    const L = stack(srcs, 'from'), R = stack(dsts, 'to');
    // Labels: centred on their bar, nudged apart so they never overlap or leave the chart.
    for (const side of [L, R]) {
      const ns = Object.values(side);
      ns.forEach((n) => (n.ly = n.y + n.h / 2));
      for (let i = 1; i < ns.length; i++) ns[i].ly = Math.max(ns[i].ly, ns[i - 1].ly + 14);
      if (ns.length) ns[ns.length - 1].ly = Math.min(ns[ns.length - 1].ly, ch - 7);
      for (let i = ns.length - 2; i >= 0; i--) ns[i].ly = Math.min(ns[i].ly, ns[i + 1].ly - 14);
      ns.forEach((n) => (n.ly = Math.max(7, n.ly)));
    }
    const x0 = BAR, x1 = cw - BAR, mx = (x0 + x1) / 2;
    const bands = flows.map((f) => {
      const a = L[f.from], b = R[f.to], th = thick(f);
      const ya = a.at, yb = b.at;
      a.at += th; b.at += th;
      const d = `M${x0},${ya} C${mx},${ya} ${mx},${yb} ${x1},${yb} L${x1},${yb + th} C${mx},${yb + th} ${mx},${ya + th} ${x0},${ya + th} Z`;
      const mid = `M${x0},${ya + th / 2} C${mx},${ya + th / 2} ${mx},${yb + th / 2} ${x1},${yb + th / 2}`;
      return { ...f, d, mid, th, ca: a.c, cb: b.c };
    });
    return { L: Object.values(L), R: Object.values(R), bands };
  });
  const speed = (v) => Math.max(1.2, 5 - Math.log10(Math.max(10, v)) * 1.0);

  const strip = $derived(h < 150);
  const narrow = $derived(w < 330);
  const uid = Math.random().toString(36).slice(2, 8);
</script>

<div class="ef" class:strip class:narrow>
  <div class="head">
    <span class="title"><Icon icon="mdi:transit-connection-variant" size="1.1em" />{t(props.name) || 'Energy flow'}</span>
    {#if show('self') && selfPct != null}
      <span class="chip" class:good={selfPct >= 50}>{selfPct}%{narrow ? '' : ' self-powered'}</span>
    {/if}
  </div>

  {#if show('tiles')}
    <div class="tiles">
      <div class="tile" style="--c:{C.solar}">
        <small><Icon icon="mdi:solar-power-variant" size="1.1em" />Solar</small>
        <b class:off={solar <= IDLE}>{fmt(solar)}<i>{u(solar)}</i></b>
      </div>
      {#if hasBatt}
        <div class="tile" style="--c:{C.batt}">
          <small><Icon icon={battNet < -IDLE ? 'mdi:battery-charging' : 'mdi:home-battery'} size="1.1em" />Battery{#if Number.isFinite(soc)}<span class="soc">{Math.round(soc)}%</span>{/if}</small>
          <b class:off={Math.abs(battNet) <= IDLE}>{Math.abs(battNet) <= IDLE ? 'Idle' : fmt(battNet)}{#if Math.abs(battNet) > IDLE}<i>{u(battNet)}</i>{/if}</b>
          {#if !strip}<em>{battNet < -IDLE ? 'charging' : battNet > IDLE ? 'discharging' : Number.isFinite(soc) ? 'holding' : ''}</em>{/if}
          {#if Number.isFinite(soc) && !strip}<div class="lvl"><span style="width:{Math.min(100, soc)}%"></span></div>{/if}
        </div>
      {/if}
      <div class="tile" style="--c:{C.house}">
        <small><Icon icon="mdi:home" size="1.1em" />House</small>
        <b>{fmt(house)}<i>{u(house)}</i></b>
        {#if hasGrid && !strip}<em class:exp={gridNet < -IDLE}>{gridNet < -IDLE ? `exporting ${kfmt(gridNet)}` : gridNet > IDLE ? `${kfmt(gridNet)} from grid` : 'nothing from grid'}</em>{/if}
      </div>
    </div>
  {/if}

  {#if strip && house > IDLE}
    <!-- Thin strip: what the house is running on, as one bar. -->
    {@const parts = [[routes.sh, C.solar], [routes.bh, C.batt], [routes.gh, C.grid]].filter((p) => p[0] > IDLE)}
    <div class="mix">{#each parts as [v, c]}<span style="flex:{v};background:{c}"></span>{/each}</div>
  {:else if !strip && show('flow')}
    <div class="flow" bind:clientWidth={cw} bind:clientHeight={ch}>
      {#if chart}
        <svg width={cw} height={ch} aria-hidden="true">
          <defs>
            {#each chart.bands as b (b.k)}
              <linearGradient id="g{uid}{b.k}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color={b.ca} /><stop offset="1" stop-color={b.cb} /></linearGradient>
            {/each}
          </defs>
          {#each chart.bands as b (b.k)}
            <path d={b.d} fill="url(#g{uid}{b.k})" fill-opacity=".32" />
            <path d={b.mid} fill="none" stroke="#fff" stroke-opacity=".35" stroke-width={Math.max(1, Math.min(3, b.th / 6))} stroke-dasharray="2 14" stroke-linecap="round" class="run" style="animation-duration:{speed(b.v)}s" />
          {/each}
          {#each chart.L as n}<rect x="0" y={n.y} width={BAR} height={Math.max(2, n.h)} rx="3" fill={n.c} />{/each}
          {#each chart.R as n}<rect x={cw - BAR} y={n.y} width={BAR} height={Math.max(2, n.h)} rx="3" fill={n.c} />{/each}
          {#each chart.L as n}<text x={BAR + 7} y={n.ly} dominant-baseline="middle" class="nl">{n.label} <tspan>{kfmt(n.v)}</tspan></text>{/each}
          {#each chart.R as n}<text x={cw - BAR - 7} y={n.ly} dominant-baseline="middle" text-anchor="end" class="nl">{n.label} <tspan>{kfmt(n.v)}</tspan></text>{/each}
        </svg>
      {:else}
        <div class="none">Nothing flowing right now</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .ef { height: 100%; display: flex; flex-direction: column; gap: 12px; min-height: 0; }
  .head { display: flex; justify-content: space-between; align-items: center; gap: 8px; white-space: nowrap; }
  .title { display: flex; align-items: center; gap: 7px; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .title :global(svg) { color: #ffc247; flex: none; }
  .chip { font-size: .72em; font-weight: 600; padding: 3px 9px; border-radius: 10px; background: rgba(255,255,255,.07); color: var(--muted); }
  .chip.good { background: rgba(91,216,143,.14); color: #5bd88f; }
  .tiles { display: flex; gap: 8px; }
  .tile { flex: 1; min-width: 0; padding: 8px 10px; border-radius: 12px; background: rgba(255,255,255,.04); display: flex; flex-direction: column; gap: 2px; }
  .tile small { display: flex; align-items: center; gap: 5px; color: var(--muted); font-size: .74em; white-space: nowrap; }
  .tile small :global(svg) { color: var(--c); flex: none; }
  .soc { margin-left: auto; color: var(--text); font-weight: 600; }
  .tile b { font-size: 1.45em; font-weight: 600; color: var(--c); line-height: 1.1; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .tile b.off { color: var(--muted); }
  .tile b i { font-style: normal; font-size: .55em; color: var(--muted); font-weight: 500; margin-left: .2em; }
  .tile em { font-style: normal; font-size: .72em; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tile em.exp { color: #c792ff; }
  .lvl { height: 3px; border-radius: 2px; background: rgba(255,255,255,.08); margin-top: 3px; overflow: hidden; }
  .lvl span { display: block; height: 100%; background: var(--c); }
  .flow { flex: 1; min-height: 40px; position: relative; }
  .flow svg { position: absolute; inset: 0; display: block; }
  .run { animation: run linear infinite; }
  @keyframes run { to { stroke-dashoffset: -16; } }
  .nl { font-size: 11px; font-weight: 600; fill: var(--text); paint-order: stroke; stroke: rgba(15,19,28,.5); stroke-width: 2.5px; stroke-linejoin: round; }
  .nl tspan { fill: var(--muted); font-weight: 500; }
  .none { position: absolute; inset: 0; display: grid; place-items: center; color: var(--muted); font-size: .85em; }
  .mix { display: flex; gap: 2px; height: 6px; border-radius: 3px; overflow: hidden; }
  .mix span { min-width: 3px; }
  .strip { gap: 8px; }
  .strip .tile { padding: 4px 8px; }
  .strip .tile b { font-size: 1.2em; }
  .narrow .tiles { gap: 5px; }
  .narrow .tile { padding: 6px 7px; }
  .narrow .tile b { font-size: 1.2em; }
</style>
