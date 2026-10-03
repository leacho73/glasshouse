<script module>
  import { find } from '../lib/octopus.js';
  export const meta = {
    type: 'octopus-intelligent', name: 'Intelligent Octopus', icon: 'mdi:ev-station', category: 'Energy',
    size: { w: 400, h: 360 }, tap: 'none',
    defaults: {},
    autofill: () => ({
      dispatching: find(/^binary_sensor\.octopus_energy_.+_intelligent_dispatching$/),
      state: find(/^sensor\.octopus_energy_.+_intelligent_state$/),
      smart_charge: find(/^switch\.octopus_energy_.+_intelligent_smart_charge$/),
      bump_charge: find(/^switch\.octopus_energy_.+_intelligent_bump_charge$/),
      target: find(/^number\.octopus_energy_.+_intelligent_charge_target$/),
      ready_time: find(/^select\.octopus_energy_.+_intelligent_target_time$/),
    }),
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'dispatching', label: 'Intelligent dispatching', type: 'entity', domain: 'binary_sensor' },
      { key: 'state', label: 'Intelligent state', type: 'entity', domain: 'sensor' },
      { key: 'smart_charge', label: 'Smart charge switch', type: 'entity', domain: 'switch' },
      { key: 'bump_charge', label: 'Bump charge switch', type: 'entity', domain: 'switch' },
      { key: 'target', label: 'Charge target', type: 'entity', domain: 'number' },
      { key: 'ready_time', label: 'Ready-by time', type: 'entity', domain: 'select' },
      { key: 'ev_soc', label: 'EV battery % (optional)', type: 'entity', domain: 'sensor' },
    ],
  };
</script>

<script>
  import Icon from '../components/Icon.svelte';
  import Toggle from '../components/Toggle.svelte';
  import Slider from '../components/Slider.svelte';
  import { t, ent } from '../lib/tpl.js';
  import { clock } from '../lib/clock.svelte.js';
  import { callService } from '../lib/ha.svelte.js';
  import { toggle } from '../lib/entity.js';
  import { dispatches, merge, hm, day, until, KIND } from '../lib/octopus.js';
  let { props } = $props();
  const now = $derived(clock.now);
  const de = $derived(ent(props.dispatching));
  const d = $derived(props.dispatching ? dispatches(props.dispatching) : { planned: [], completed: [], a: {} });
  const planned = $derived(merge(d.planned).filter((p) => p.end > now));
  const plannedKwh = $derived(d.planned.reduce((a, p) => a + p.kwh, 0));
  const today0 = $derived(new Date(new Date(now).toDateString()).getTime());
  const doneToday = $derived(d.completed.filter((c) => c.start >= now - 864e5));
  const recent = $derived(merge(d.completed).filter((c) => c.end <= now).slice(-4).reverse());
  const doneKwh = $derived(doneToday.reduce((a, p) => a + p.kwh, 0));
  const active = $derived(de?.state === 'on');
  const st = $derived(ent(props.state)?.state?.replace(/_/g, ' ').toLowerCase());
  const smart = $derived(ent(props.smart_charge));
  const bump = $derived(ent(props.bump_charge));
  const target = $derived(ent(props.target));
  const ready = $derived(ent(props.ready_time));
  const soc = $derived(ent(props.ev_soc));
  const C = KIND.dispatch.color;
</script>

<div class="io" style="--c:{C}">
  <div class="head">
    <span class="ic" class:on={active}><Icon icon="mdi:ev-station" size="1.5em" /></span>
    <div class="t">
      <div class="title">{t(props.title) || 'Intelligent Octopus'}</div>
      <div class="st">{active ? `Dispatching until ${hm(Date.parse(d.a.current_end))}` : planned.length ? `Next slot ${day(planned[0].start, now)} ${hm(planned[0].start)} (in ${until(planned[0].start, now)})` : st || 'No slots planned'}</div>
    </div>
    {#if soc}<div class="soc">{Math.round(soc.state)}%</div>{/if}
  </div>

  <div class="kpis">
    <div><b>{plannedKwh.toFixed(1)}</b><span>kWh planned</span></div>
    <div><b>{doneKwh.toFixed(1)}</b><span>kWh dispatched 24h</span></div>
    {#if d.a.charge_point_power_in_kw}<div><b>{d.a.charge_point_power_in_kw}</b><span>kW charger</span></div>{/if}
  </div>

  <div class="slots">
    {#each planned as p}
      <div class="slot" class:now={p.start <= now}><Icon icon="mdi:clock-outline" size="1em" /> {day(p.start, now)} {hm(p.start)}–{hm(p.end)}{#if p.kwh}<span class="dim">{' · '}{p.kwh.toFixed(1)} kWh</span>{/if}</div>
    {/each}
    {#if !planned.length && recent.length}
      <div class="dim">No planned slots. Recent:</div>
      {#each recent as p}<div class="slot dim"><Icon icon="mdi:check" size="1em" /> {day(p.start, now)} {hm(p.start)}–{hm(p.end)}{#if p.kwh}{' · '}{p.kwh.toFixed(1)} kWh{/if}</div>{/each}
    {/if}
  </div>

  <div class="ctl" data-stop>
    {#if smart}<label><span>Smart charge</span><Toggle on={smart.state === 'on'} color={C} onclick={() => toggle(smart)} /></label>{/if}
    {#if bump}<label><span>Bump charge</span><Toggle on={bump.state === 'on'} color={C} onclick={() => toggle(bump)} /></label>{/if}
    {#if ready}
      <label><span>Ready by</span>
        <select value={ready.state} onchange={(e) => callService('select', 'select_option', { option: e.currentTarget.value }, { entity_id: ready.entity_id })}>
          {#each ready.attributes.options || [] as o}<option value={o}>{o}</option>{/each}
        </select></label>
    {/if}
    {#if target}
      <div class="tg"><span>Charge target <b>{Math.round(target.state)}%</b></span>
        <Slider value={Number(target.state)} min={target.attributes.min ?? 0} max={target.attributes.max ?? 100} step={target.attributes.step ?? 5} height={30} color={C}
          onchange={(v) => callService('number', 'set_value', { value: v }, { entity_id: target.entity_id })} /></div>
    {/if}
  </div>
</div>

<style>
  .io { height: 100%; display: flex; flex-direction: column; gap: 10px; }
  .head { display: flex; align-items: center; gap: 12px; }
  .ic { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: rgba(255,255,255,.07); color: var(--muted); flex: none; }
  .ic.on { background: color-mix(in srgb, var(--c) 30%, transparent); color: var(--c); animation: glow 2s infinite; }
  @keyframes glow { 50% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--c) 20%, transparent); } }
  .t { flex: 1; min-width: 0; }
  .title { font-weight: 600; }
  .st { color: var(--muted); font-size: .85em; text-transform: none; }
  .soc { font-size: 1.4em; font-weight: 600; }
  .kpis { display: flex; gap: 8px; }
  .kpis div { flex: 1; background: rgba(255,255,255,.05); border-radius: 12px; padding: 8px 10px; display: flex; flex-direction: column; }
  .kpis b { font-size: 1.3em; }
  .kpis span { font-size: .72em; color: var(--muted); }
  .slots { flex: 1; overflow: auto; display: flex; flex-direction: column; gap: 4px; min-height: 0; font-size: .88em; }
  .slot { display: flex; align-items: center; gap: 6px; }
  .slot.now { color: var(--c); font-weight: 600; }
  .dim { color: var(--muted); font-weight: 400; }
  .ctl { display: flex; flex-direction: column; gap: 8px; font-size: .9em; }
  .ctl label { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .ctl select { width: auto; min-width: 90px; }
  .tg { display: flex; flex-direction: column; gap: 6px; }
</style>
