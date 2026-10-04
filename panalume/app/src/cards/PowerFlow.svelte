<script module>
  export const meta = {
    type: 'powerflow', name: 'Power flow', icon: 'mdi:home-lightning-bolt', category: 'Energy',
    size: { w: 340, h: 340 }, tap: 'none',
    defaults: { unit: 'W' },
    sections: [{ key: 'solar', label: 'Solar', section: 'solar' }, { key: 'grid', label: 'Grid', section: 'grid' }, { key: 'battery', label: 'Battery', section: 'battery' }, { key: 'ev', label: 'EV', section: 'ev' }, { key: 'home', label: 'Home', section: 'home' }, { key: 'flows', label: 'Flow lines' }],
    fields: [
      { key: 'solar', label: 'Solar power', type: 'entity', domain: 'sensor' },
      { key: 'grid', label: 'Grid power (+import / −export)', type: 'entity', domain: 'sensor' },
      { key: 'grid_invert', label: 'Invert grid sign', type: 'bool', section: 'grid' },
      { key: 'battery', label: 'Battery power (+discharge / −charge)', type: 'entity', domain: 'sensor' },
      { key: 'battery_invert', label: 'Invert battery sign', type: 'bool', section: 'battery' },
      { key: 'battery_soc', label: 'Battery %', type: 'entity', domain: 'sensor', section: 'battery' },
      { key: 'home', label: 'Home power (blank = calculated)', type: 'entity', domain: 'sensor' },
      { key: 'ev', label: 'EV / charger power', type: 'entity', domain: 'sensor' },
      { key: 'ev_label', label: 'EV label', type: 'text', section: 'ev' },
    ],
  };
</script>

<script>
  import { myenergiPower } from '../lib/octopus.js';
  import Icon from '../components/Icon.svelte';
  import { t, ent } from '../lib/tpl.js';
  let { props } = $props();
  const show = (k) => !props.hide?.[k];
  // Normalise any power sensor to watts.
  function watts(id) {
    const e = ent(id);
    const v = Number(e?.state);
    if (!e || Number.isNaN(v)) return null;
    const u = (e.attributes.unit_of_measurement || 'W').toLowerCase();
    return u === 'kw' ? v * 1000 : u === 'mw' ? v * 1e6 : v;
  }
  const solar = $derived(Math.max(0, watts(props.solar) ?? 0));
  const grid = $derived((watts(props.grid) ?? 0) * (props.grid_invert ? -1 : 1));
  const batt = $derived((watts(props.battery) ?? 0) * (props.battery_invert ? -1 : 1));
  const ev = $derived(Math.max(0, watts(myenergiPower(props.ev)) ?? 0));
  const home = $derived(props.home ? (watts(props.home) ?? 0) : Math.max(0, solar + grid + batt - ev));
  const soc = $derived(ent(props.battery_soc)?.state);
  const fmt = (w) => (Math.abs(w) >= 1000 ? (Math.abs(w) / 1000).toFixed(Math.abs(w) >= 10000 ? 0 : 1) + ' kW' : Math.round(Math.abs(w)) + ' W');
  const dur = (w) => Math.max(0.6, 3.5 - Math.log10(Math.max(1, Math.abs(w))) * 0.8) + 's';
  const C = { solar: '#ffc861', grid: '#8da2c0', home: '#7aa2ff', batt: '#5bd88f', ev: '#b48cff', exp: '#ff8fb1' };
  // Node positions in a 100x100 box.
  const P = { solar: [50, 13], grid: [13, 50], home: [50, 50], batt: [50, 87], ev: [87, 50] };
  const lines = $derived([
    props.solar && show('solar') && { from: 'solar', to: 'home', w: solar, color: C.solar },
    props.grid && show('grid') && { from: grid >= 0 ? 'grid' : 'home', to: grid >= 0 ? 'home' : 'grid', w: grid, color: grid >= 0 ? C.grid : C.exp, a: 'grid', b: 'home' },
    props.battery && show('battery') && { from: batt >= 0 ? 'batt' : 'home', to: batt >= 0 ? 'home' : 'batt', w: batt, color: C.batt, a: 'batt', b: 'home' },
    props.ev && show('ev') && { from: 'home', to: 'ev', w: ev, color: C.ev },
  ].filter(Boolean));
</script>

<div class="pf">
  <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
    {#each show('flows') ? lines : [] as l}
      {@const [x1, y1] = P[l.a || l.from]}
      {@const [x2, y2] = P[l.b || l.to]}
      <line {x1} {y1} {x2} {y2} stroke="rgba(255,255,255,.08)" stroke-width="1.2" />
      {#if Math.abs(l.w) > 5}
        <line x1={P[l.from][0]} y1={P[l.from][1]} x2={P[l.to][0]} y2={P[l.to][1]} style="stroke:{l.color};animation-duration:{dur(l.w)}" class="flow" stroke-width="1.6" stroke-linecap="round" />
      {/if}
    {/each}
  </svg>
  {#snippet node(key, icon, label, w, color, extra)}
    <div class="node" style="left:{P[key][0]}%;top:{P[key][1]}%;--c:{color}">
      <Icon {icon} size="1.3em" />
      <span class="v">{w == null ? '—' : fmt(w)}</span>
      {#if extra}<span class="x">{extra}</span>{/if}
      <span class="l">{label}</span>
    </div>
  {/snippet}
  {#if props.solar && show('solar')}{@render node('solar', 'mdi:solar-power', 'Solar', solar, C.solar)}{/if}
  {#if props.grid && show('grid')}{@render node('grid', 'mdi:transmission-tower', grid < 0 ? 'Export' : 'Grid', grid, grid < 0 ? C.exp : C.grid)}{/if}
  {#if show('home')}{@render node('home', 'mdi:home', 'Home', home, C.home)}{/if}
  {#if props.battery && show('battery')}{@render node('batt', 'mdi:home-battery', batt < 0 ? 'Charging' : 'Battery', batt, C.batt, soc != null ? Math.round(soc) + '%' : '')}{/if}
  {#if props.ev && show('ev')}{@render node('ev', 'mdi:car-electric', t(props.ev_label) || 'EV', ev, C.ev)}{/if}
</div>

<style>
  .pf { position: relative; height: 100%; aspect-ratio: 1; max-width: 100%; margin: 0 auto; container-type: size; }
  svg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .flow { stroke-dasharray: 2 4; animation: flow linear infinite; }
  @keyframes flow { to { stroke-dashoffset: -12; } }
  .node { position: absolute; transform: translate(-50%, -50%); width: 26%; aspect-ratio: 1; border-radius: 50%; border: 2px solid var(--c); background: color-mix(in srgb, var(--c) 10%, rgba(10,14,22,.9)); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; font-size: 4cqmin; line-height: 1.15; }
  .node :global(svg) { color: var(--c); position: static; width: 1.6em !important; height: 1.6em !important; }
  .v { font-weight: 600; font-size: 1.05em; }
  .x { color: var(--muted); font-size: .85em; }
  .l { position: absolute; bottom: -1.5em; color: var(--muted); font-size: .9em; white-space: nowrap; }
</style>
