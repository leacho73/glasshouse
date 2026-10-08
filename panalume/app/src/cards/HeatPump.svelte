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
    sections: [{ key: 'cop', label: 'Live COP', section: 'cop' }, { key: 'power', label: 'kW in' }, { key: 'heat', label: 'kW heat' }, { key: 'flow', label: 'Flow temp', section: 'flow' }, { key: 'scop', label: 'SCOP', section: 'scop' }, { key: 'chart', label: 'Graph' }, { key: 'water', label: 'Hot water', section: 'water' }, { key: 'boost', label: 'Boost button' }, { key: 'zone', label: 'Heating zone', section: 'zone' }],
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'power_in', label: 'Power input', type: 'entity', domain: 'sensor', section: 'power' },
      { key: 'heat_out', label: 'Heat output', type: 'entity', domain: 'sensor', section: 'heat' },
      { key: 'cop', label: 'Live COP', type: 'entity', domain: 'sensor' },
      { key: 'scop', label: 'Lifetime SCOP', type: 'entity', domain: 'sensor' },
      { key: 'outdoor', label: 'Outdoor temperature', type: 'entity', domain: 'sensor' },
      { key: 'flow', label: 'Flow temperature', type: 'entity', domain: 'sensor' },
      { key: 'water', label: 'Hot water (water_heater)', type: 'entity', domain: 'water_heater' },
      { key: 'zone', label: 'Heating zone (climate)', type: 'entity', domain: 'climate' },
      { key: 'boost_minutes', label: 'Hot water boost minutes', type: 'number', section: 'boost' },
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
  let { props, w = 420 } = $props();
  // Under ~560px the hot water, Boost and heating share one row in short form.
  const tight = $derived(w < 560);
  const show = (k) => !props.hide?.[k];
  const n = (id) => { const v = Number(ent(id)?.state); return isNaN(v) ? null : v; };
  const kw = (id) => { const e = ent(id); const v = n(id); if (v == null) return null; return (e.attributes.unit_of_measurement || '').toLowerCase() === 'w' ? v / 1000 : v; };
  const pin = $derived(kw(props.power_in));
  const hout = $derived(kw(props.heat_out));
  const running = $derived((pin ?? 0) > 0.05);
  const wh = $derived(ent(props.water));
  const zone = $derived(ent(props.zone));
  const hist = useHistory(() => [props.power_in, props.heat_out].filter(Boolean), () => 24);
  // Heating zone target: − / + nudge it, sent once you stop tapping.
  const za = $derived(zone?.attributes || {});
  const zstep = $derived(Number(za.target_temp_step) || 0.5);
  let pending = $state(null), timer;
  const ztarget = $derived(pending ?? (za.temperature != null ? Number(za.temperature) : null));
  function nudge(d) {
    pending = Math.min(za.max_temp ?? 30, Math.max(za.min_temp ?? 7, Math.round((ztarget + d * zstep) / zstep) * zstep));
    clearTimeout(timer);
    timer = setTimeout(() => callService('climate', 'set_temperature', { temperature: pending }, { entity_id: zone.entity_id }).finally(() => setTimeout(() => (pending = null), 1500)), 900);
  }
  const boost = () => {
    const m = Number(props.boost_minutes) || 60;
    callService('octopus_energy', 'boost_water_heater', { hours: Math.floor(m / 60), minutes: m % 60, target_temperature: wh?.attributes.max_temp ?? 60 }, { entity_id: wh.entity_id });
  };
</script>

<div class="hp" class:running>
  <div class="head">
    <span class="ic"><Icon icon="mdi:heat-pump" size="1.6em" /></span>
    <div class="t"><div class="title">{t(props.title) || 'Heat pump'}</div><div class="dim">{running ? 'Running' : 'Idle'}{#if n(props.outdoor) != null}{' · '}{formatNumber(n(props.outdoor), 1)}° outside{/if}</div></div>
    {#if n(props.cop) != null && show('cop')}<div class="cop"><b>{n(props.cop).toFixed(2)}</b><span>COP</span></div>{/if}
  </div>
  <div class="kpis">
    {#if show('power')}<div><b>{pin != null ? pin.toFixed(2) : '—'}</b><span>kW in</span></div>{/if}
    {#if show('heat')}<div class="heat"><b>{hout != null ? hout.toFixed(2) : '—'}</b><span>kW heat</span></div>{/if}
    {#if props.flow && show('flow')}<div><b>{formatNumber(n(props.flow), 0)}°</b><span>{props.flow.includes('target') ? 'target flow' : 'flow'}</span></div>{/if}
    {#if props.scop && show('scop')}<div><b>{n(props.scop)?.toFixed(2) ?? '—'}</b><span>SCOP</span></div>{/if}
  </div>
  {#if show('chart')}<div class="chart">
    <Chart series={[{ points: hist.series[props.heat_out] || [], color: '#ff8a4c' }, { points: hist.series[props.power_in] || [], color: '#7aa2ff' }]} hours={24} strokeWidth={1.8} />
  </div>{/if}
  <div class="row" class:tight data-stop>
    {#if wh && show('water')}
      <button class="wh" onclick={() => (app.popup = { entity: wh.entity_id })}>
        <Icon icon="mdi:water-boiler" size="1.3em" />
        <span><b>{formatNumber(wh.attributes.current_temperature, 1)}°</b>{#if (wh.attributes.temperature ?? wh.attributes.target_temp_high) != null}{' / '}{formatNumber(wh.attributes.temperature ?? wh.attributes.target_temp_high, 0)}°{/if}{#if !tight}{' '}<span class="dim">{(wh.attributes.operation_mode || wh.state).replace(/_/g, ' ')}</span>{/if}</span>
      </button>
      {#if show('boost')}<button class="boost" title="Boost hot water" onclick={boost}><Icon icon="mdi:rocket-launch" size="1.1em" />{#if !tight}{' '}Boost{/if}</button>{/if}
    {/if}
    {#if zone && show('zone')}
      <div class="zone">
        <button class="wh" onclick={() => (app.popup = { entity: zone.entity_id })}><Icon icon="mdi:radiator" size="1.3em" /><span><b>{formatNumber(za.current_temperature, 1)}°</b>{#if ztarget != null}{tight ? '→' : ' → '}{formatNumber(ztarget, 1)}°{/if}{#if !tight}{' '}<span class="dim">{za.hvac_action === 'heating' ? 'heating' : zone.state}</span>{/if}</span></button>
        {#if ztarget != null && zone.state !== 'off'}
          <button class="nb" aria-label="Cooler" onclick={() => nudge(-1)}><Icon icon="mdi:minus" size="1.1em" /></button>
          <button class="nb" aria-label="Warmer" onclick={() => nudge(1)}><Icon icon="mdi:plus" size="1.1em" /></button>
        {/if}
      </div>
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
  .chart { flex: 1; min-height: 0; }
  .row { display: flex; gap: 6px; flex-wrap: wrap; }
  .row button { border: 0; border-radius: 12px; padding: 8px 12px; background: rgba(255,255,255,.07); color: inherit; display: flex; align-items: center; gap: 8px; font-size: .9em; }
  .zone { display: flex; gap: 4px; }
  .row.tight button { padding: 8px 10px; gap: 6px; }
  .row.tight .nb { width: 2.2em; padding: 0; }
  .row .nb { padding: 0; width: 2.4em; justify-content: center; }
  .boost { background: rgba(255,138,76,.25) !important; color: #ffb38a !important; font-weight: 600; }
</style>
