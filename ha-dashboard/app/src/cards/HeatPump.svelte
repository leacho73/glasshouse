<script module>
  import { find } from '../lib/octopus.js';
  export const meta = {
    type: 'heatpump', name: 'Heat pump', icon: 'mdi:heat-pump', category: 'Energy',
    size: { w: 420, h: 330 }, tap: 'none',
    defaults: { boost_minutes: 60 },
    autofill: () => ({
      power_in: find(/^sensor\.octopus_energy_heat_pump_.+_live_power_input$/),
      heat_out: find(/^sensor\.octopus_energy_heat_pump_.+_live_heat_output$/),
      cop: find(/^sensor\.octopus_energy_heat_pump_.+_live_cop$/),
      scop: find(/^sensor\.octopus_energy_heat_pump_.+_lifetime_scop$/),
      outdoor: find(/^sensor\.octopus_energy_heat_pump_.+_live_outdoor_temperature$/),
      flow: find(/^sensor\.octopus_energy_heat_pump_.+_fixed_target_flow_temperature$/),
      water: find(/^water_heater\.octopus_energy_heat_pump_/),
      zone: find(/^climate\.octopus_energy_heat_pump_/),
    }),
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'power_in', label: 'Power input', type: 'entity', domain: 'sensor' },
      { key: 'heat_out', label: 'Heat output', type: 'entity', domain: 'sensor' },
      { key: 'cop', label: 'Live COP', type: 'entity', domain: 'sensor' },
      { key: 'scop', label: 'Lifetime SCOP', type: 'entity', domain: 'sensor' },
      { key: 'outdoor', label: 'Outdoor temperature', type: 'entity', domain: 'sensor' },
      { key: 'flow', label: 'Flow temperature', type: 'entity', domain: 'sensor' },
      { key: 'water', label: 'Hot water (water_heater)', type: 'entity', domain: 'water_heater' },
      { key: 'zone', label: 'Heating zone (climate)', type: 'entity', domain: 'climate' },
      { key: 'boost_minutes', label: 'Hot water boost minutes', type: 'number' },
    ],
  };
</script>

<script>
  import Icon from '../components/Icon.svelte';
  import Chart from '../components/Chart.svelte';
  import { t, ent } from '../lib/tpl.js';
  import { callService } from '../lib/ha.svelte.js';
  import { formatNumber } from '../lib/entity.js';
  import { useHistory } from '../lib/history.svelte.js';
  import { app } from '../lib/config.svelte.js';
  let { props } = $props();
  const n = (id) => { const v = Number(ent(id)?.state); return isNaN(v) ? null : v; };
  const kw = (id) => { const e = ent(id); const v = n(id); if (v == null) return null; return (e.attributes.unit_of_measurement || '').toLowerCase() === 'w' ? v / 1000 : v; };
  const pin = $derived(kw(props.power_in));
  const hout = $derived(kw(props.heat_out));
  const running = $derived((pin ?? 0) > 0.05);
  const wh = $derived(ent(props.water));
  const zone = $derived(ent(props.zone));
  const hist = useHistory(() => [props.power_in, props.heat_out].filter(Boolean), () => 24);
  const boost = () => {
    const m = Number(props.boost_minutes) || 60;
    callService('octopus_energy', 'boost_water_heater', { hours: Math.floor(m / 60), minutes: m % 60, target_temperature: wh?.attributes.max_temp ?? 60 }, { entity_id: wh.entity_id });
  };
</script>

<div class="hp" class:running>
  <div class="head">
    <span class="ic"><Icon icon="mdi:heat-pump" size="1.6em" /></span>
    <div class="t"><div class="title">{t(props.title) || 'Heat pump'}</div><div class="dim">{running ? 'Running' : 'Idle'}{#if n(props.outdoor) != null}{' · '}{formatNumber(n(props.outdoor), 1)}° outside{/if}</div></div>
    {#if n(props.cop) != null}<div class="cop"><b>{n(props.cop).toFixed(2)}</b><span>COP</span></div>{/if}
  </div>
  <div class="kpis">
    <div><b>{pin != null ? pin.toFixed(2) : '—'}</b><span>kW in</span></div>
    <div class="heat"><b>{hout != null ? hout.toFixed(2) : '—'}</b><span>kW heat</span></div>
    {#if props.flow}<div><b>{formatNumber(n(props.flow), 0)}°</b><span>flow</span></div>{/if}
    {#if props.scop}<div><b>{n(props.scop)?.toFixed(2) ?? '—'}</b><span>SCOP</span></div>{/if}
  </div>
  <div class="chart">
    <Chart series={[{ points: hist.series[props.heat_out] || [], color: '#ff8a4c' }, { points: hist.series[props.power_in] || [], color: '#7aa2ff' }]} hours={24} strokeWidth={1.8} />
  </div>
  <div class="row" data-stop>
    {#if wh}
      <button class="wh" onclick={() => (app.popup = { entity: wh.entity_id })}>
        <Icon icon="mdi:water-boiler" size="1.3em" />
        <span><b>{formatNumber(wh.attributes.current_temperature, 1)}°</b>{#if (wh.attributes.temperature ?? wh.attributes.target_temp_high) != null}{' / '}{formatNumber(wh.attributes.temperature ?? wh.attributes.target_temp_high, 0)}°{/if} <span class="dim">{(wh.attributes.operation_mode || wh.state).replace(/_/g, ' ')}</span></span>
      </button>
      <button class="boost" onclick={boost}><Icon icon="mdi:rocket-launch" size="1.1em" /> Boost</button>
    {/if}
    {#if zone}
      <button class="wh" onclick={() => (app.popup = { entity: zone.entity_id })}><Icon icon="mdi:radiator" size="1.3em" /><span><b>{formatNumber(zone.attributes.current_temperature, 1)}°</b> <span class="dim">{zone.state}</span></span></button>
    {/if}
  </div>
</div>

<style>
  .hp { height: 100%; display: flex; flex-direction: column; gap: 10px; }
  .head { display: flex; align-items: center; gap: 12px; }
  .ic { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: rgba(255,255,255,.07); color: var(--muted); }
  .running .ic { background: rgba(255,138,76,.22); color: #ff8a4c; }
  .t { flex: 1; }
  .title { font-weight: 600; }
  .dim { color: var(--muted); font-size: .85em; font-weight: 400; }
  .cop { text-align: right; display: flex; flex-direction: column; }
  .cop b { font-size: 1.6em; color: #5bd88f; line-height: 1; }
  .cop span { font-size: .7em; color: var(--muted); }
  .kpis { display: flex; gap: 6px; }
  .kpis div { flex: 1; background: rgba(255,255,255,.05); border-radius: 12px; padding: 7px 10px; display: flex; flex-direction: column; }
  .kpis b { font-size: 1.2em; }
  .kpis span { font-size: .72em; color: var(--muted); }
  .heat b { color: #ff8a4c; }
  .chart { flex: 1; min-height: 40px; }
  .row { display: flex; gap: 6px; flex-wrap: wrap; }
  .row button { border: 0; border-radius: 12px; padding: 8px 12px; background: rgba(255,255,255,.07); color: inherit; display: flex; align-items: center; gap: 8px; font-size: .9em; }
  .boost { background: rgba(255,138,76,.25) !important; color: #ffb38a !important; font-weight: 600; }
</style>
