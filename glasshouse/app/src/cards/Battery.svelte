<script module>
  import { find } from '../lib/octopus.js';
  export const meta = {
    type: 'battery', name: 'Home battery', icon: 'mdi:home-battery', category: 'Energy',
    size: { w: 400, h: 260 }, tap: 'none', hold: 'more-info',
    defaults: { reserve: 0, power_invert: false, graph: true },
    sections: [
      { key: 'gauge', label: 'Battery' }, { key: 'kwh', label: 'kWh remaining' }, { key: 'power', label: 'Power' }, { key: 'time', label: 'Time to full / empty' },
      { key: 'status', label: 'Status' }, { key: 'health', label: 'Health' }, { key: 'temp', label: 'Temperature' }, { key: 'today', label: 'Today in / out' }, { key: 'graph', label: '24h graph' },
    ],
    // SolarEdge Modbus Multi naming; any battery integration can be picked by hand.
    autofill: () => ({
      soc: find(/^sensor\.solaredge_(i\d_)?b\d_state_of_energy$/),
      capacity: find(/^sensor\.solaredge_(i\d_)?b\d_available_energy$/) || find(/^sensor\.solaredge_(i\d_)?b\d_maximum_energy$/),
      power: find(/^sensor\.solaredge_(i\d_)?b\d_dc_power$/),
      status: find(/^sensor\.solaredge_(i\d_)?b\d_status$/),
      health: find(/^sensor\.solaredge_(i\d_)?b\d_state_of_health$/),
      temp: find(/^sensor\.solaredge_(i\d_)?b\d_average_temperature$/),
      in_today: find(/^sensor\.[a-z0-9_]*battery_in_daily$/),
      out_today: find(/^sensor\.[a-z0-9_]*battery_out_daily$/),
    }),
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'soc', label: 'State of charge (%)', type: 'entity', domain: 'sensor', section: 'gauge' },
      { key: 'capacity', label: 'Usable capacity (kWh sensor) or a number', type: 'text', section: 'kwh' },
      { key: 'power', label: 'Battery power (W / kW)', type: 'entity', domain: 'sensor', section: 'power' },
      { key: 'power_invert', label: 'Invert power sign (tick if charging shows negative)', type: 'bool' },
      { key: 'reserve', label: 'Backup reserve % (for time-to-empty)', type: 'number', section: 'time' },
      { key: 'status', label: 'Status', type: 'entity', domain: 'sensor', section: 'status' },
      { key: 'health', label: 'State of health (%)', type: 'entity', domain: 'sensor', section: 'health' },
      { key: 'temp', label: 'Temperature', type: 'entity', domain: 'sensor', section: 'temp' },
      { key: 'in_today', label: 'Charged today (kWh)', type: 'entity', domain: 'sensor', section: 'today' },
      { key: 'out_today', label: 'Discharged today (kWh)', type: 'entity', domain: 'sensor', section: 'today' },
    ],
  };
</script>

<script>
  // Home battery: charge level, energy left, live charge/discharge and an
  // estimate of time until full or until the reserve is reached.
  import Icon from '../components/Icon.svelte';
  import Chart from '../components/Chart.svelte';
  import { t, ent } from '../lib/tpl.js';
  import { formatNumber } from '../lib/entity.js';
  import { states } from '../lib/ha.svelte.js';
  import { useHistory } from '../lib/history.svelte.js';
  let { props, w = 400, h = 260 } = $props();
  const show = (k) => !props.hide?.[k];
  const num = (id) => { const v = Number(ent(id)?.state); return Number.isFinite(v) ? v : null; };
  const soc = $derived(num(props.soc));
  // Capacity: a sensor (kWh / Wh) or a plain number typed in.
  const capacity = $derived.by(() => {
    const c = props.capacity;
    if (c == null || c === '') return null;
    if (!isNaN(Number(c))) return Number(c);
    const e = ent(c);
    const v = Number(e?.state);
    if (!Number.isFinite(v)) return null;
    return (e.attributes.unit_of_measurement || '').toLowerCase() === 'wh' ? v / 1000 : v;
  });
  // Positive = charging, negative = discharging (after optional invert), in watts.
  const watts = $derived.by(() => {
    const e = ent(props.power);
    const v = Number(e?.state);
    if (!Number.isFinite(v)) return null;
    const wv = (e.attributes.unit_of_measurement || 'W').toLowerCase() === 'kw' ? v * 1000 : v;
    return props.power_invert ? -wv : wv;
  });
  const idle = $derived(watts == null || Math.abs(watts) < 30);
  const charging = $derived(!idle && watts > 0);
  const kwhLeft = $derived(soc != null && capacity != null ? (soc / 100) * capacity : null);
  const reserve = $derived(Number(props.reserve) || 0);
  const eta = $derived.by(() => {
    if (idle || soc == null || capacity == null) return null;
    const kw = Math.abs(watts) / 1000;
    const kwh = charging ? ((100 - soc) / 100) * capacity : ((soc - reserve) / 100) * capacity;
    if (kwh <= 0) return null;
    const mins = Math.round((kwh / kw) * 60);
    const hh = Math.floor(mins / 60), mm = mins % 60;
    const done = new Date(Date.now() + mins * 60e3).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    return { text: hh ? `${hh}h ${mm}m` : `${mm}m`, at: done, label: charging ? 'until full' : reserve ? `until ${reserve}%` : 'until empty' };
  });
  const color = $derived(soc == null ? '#8a94a8' : soc <= Math.max(15, reserve) ? '#ff7a90' : soc < 40 ? '#ffc861' : '#5bd88f');
  const statusText = $derived.by(() => {
    const s = ent(props.status)?.state;
    if (!s || s === 'unknown') return idle ? 'Idle' : charging ? 'Charging' : 'Discharging';
    return s.replace(/^B_STATUS_/, '').replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
  });
  const fmtW = (v) => (Math.abs(v) >= 1000 ? (Math.abs(v) / 1000).toFixed(2) + ' kW' : Math.round(Math.abs(v)) + ' W');
  const hist = useHistory(() => (props.graph !== false && show('graph') && props.soc ? [props.soc] : []), () => 24);
  const wide = $derived(w > h * 2);
</script>

{#snippet graph()}
  {#if props.graph !== false && show('graph') && (hist.series[props.soc]?.length || 0) > 1}
    <div class="graph"><Chart series={[{ points: hist.series[props.soc], color }]} hours={24} min={0} max={100} strokeWidth={2} /></div>
  {/if}
{/snippet}

<div class="bat" class:wide style="--c:{color}">
  <div class="head">
    <span class="title">{t(props.name) || 'Home battery'}</span>
    {#if show('status')}<span class="chip" class:chg={charging} class:dis={!idle && !charging}>
      <Icon icon={idle ? 'mdi:pause' : charging ? 'mdi:arrow-up-bold' : 'mdi:arrow-down-bold'} size="1em" />{statusText}</span>{/if}
  </div>

  <div class="main">
    {#if show('gauge')}
      <div class="cell" class:anim={!idle} class:up={charging}>
        <div class="cap"></div>
        <div class="body">
          <div class="fill" style="height:{soc ?? 0}%"></div>
          {#if reserve}<div class="res" style="bottom:{reserve}%"></div>{/if}
          <div class="pct"><span>{soc != null ? Math.round(soc) : '—'}<small>%</small></span></div>
        </div>
      </div>
    {/if}
    <div class="info">
      {#if show('kwh') && kwhLeft != null}
        <div class="big">{kwhLeft.toFixed(1)}<small>kWh</small></div>
        <div class="dim">of {capacity.toFixed(1)} kWh available</div>
      {:else if !show('gauge') && soc != null}
        <div class="big">{Math.round(soc)}<small>%</small></div>
      {/if}
      {#if show('power') && watts != null}
        <div class="pw" class:chg={charging} class:dis={!idle && !charging}>
          {idle ? 'Idle' : `${charging ? 'Charging' : 'Discharging'} ${fmtW(watts)}`}
        </div>
      {/if}
      {#if show('time') && eta}<div class="eta"><Icon icon="mdi:timer-outline" size="1em" /> {eta.text} {eta.label} <span class="dim">(~{eta.at})</span></div>{/if}
      <div class="stats">
        {#if show('health') && num(props.health) != null}<span><Icon icon="mdi:heart-pulse" size="1em" />{Math.round(num(props.health))}% health</span>{/if}
        {#if show('temp') && num(props.temp) != null}<span><Icon icon="mdi:thermometer" size="1em" />{formatNumber(num(props.temp), 1)}°</span>{/if}
        {#if show('today') && props.in_today}<span><Icon icon="mdi:arrow-up" size="1em" />{formatNumber(num(props.in_today), 1)} in</span>{/if}
        {#if show('today') && props.out_today}<span><Icon icon="mdi:arrow-down" size="1em" />{formatNumber(num(props.out_today), 1)} out</span>{/if}
      </div>
    </div>
    {#if wide}{@render graph()}{/if}
  </div>

  {#if !wide}{@render graph()}{/if}
</div>

<style>
  .bat { height: 100%; display: flex; flex-direction: column; gap: 10px; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .chip { display: inline-flex; align-items: center; gap: 4px; font-size: .75em; font-weight: 600; padding: 3px 9px; border-radius: 10px; background: rgba(255,255,255,.07); color: var(--muted); white-space: nowrap; }
  .chip.chg { background: rgba(91,216,143,.16); color: #5bd88f; }
  .chip.dis { background: rgba(255,200,97,.16); color: #ffc861; }
  .main { flex: 1; min-height: 0; display: flex; gap: 18px; align-items: center; overflow: hidden; }
  .cell { height: 100%; max-height: 160px; aspect-ratio: .55; display: flex; flex-direction: column; align-items: center; flex: none; }
  .cap { width: 34%; height: 6%; min-height: 5px; border-radius: 4px 4px 0 0; background: rgba(255,255,255,.18); }
  .body { position: relative; flex: 1; width: 100%; border-radius: 14px; border: 2px solid rgba(255,255,255,.18); overflow: hidden; background: rgba(255,255,255,.04); }
  .fill { position: absolute; left: 0; right: 0; bottom: 0; background: linear-gradient(0deg, color-mix(in srgb, var(--c) 70%, transparent), var(--c)); transition: height .8s ease; box-shadow: 0 0 22px color-mix(in srgb, var(--c) 55%, transparent); }
  .anim .fill::after { content: ''; position: absolute; inset: 0; background: linear-gradient(0deg, transparent 0%, rgba(255,255,255,.35) 50%, transparent 100%); background-size: 100% 200%; animation: flow 2.2s linear infinite; }
  .anim:not(.up) .fill::after { animation-direction: reverse; }
  @keyframes flow { from { background-position: 0 100%; } to { background-position: 0 -100%; } }
  .res { position: absolute; left: 0; right: 0; border-top: 2px dashed rgba(255,255,255,.55); }
  .pct { position: absolute; inset: 0; display: grid; place-items: center; font-size: 1.5em; font-weight: 700; text-shadow: 0 1px 6px rgba(0,0,0,.5); }
  .pct small { font-size: .55em; }
  .info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .big { font-size: 2.2em; font-weight: 600; letter-spacing: -.02em; line-height: 1; }
  .big small { margin-left: .15em; font-size: .45em; color: var(--muted); font-weight: 500; }
  .dim { color: var(--muted); font-size: .85em; }
  .pw { font-weight: 600; margin-top: 4px; }
  .pw.chg { color: #5bd88f; } .pw.dis { color: #ffc861; }
  .eta { display: flex; align-items: center; gap: 5px; font-size: .9em; }
  .stats { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 4px; font-size: .8em; color: var(--muted); }
  .stats span { display: inline-flex; align-items: center; gap: 4px; }
  .graph { height: 22%; min-height: 34px; }
  .wide .graph { flex: 1.1; height: 80%; min-width: 0; align-self: center; }
  .wide .info { flex: 1; }
</style>
