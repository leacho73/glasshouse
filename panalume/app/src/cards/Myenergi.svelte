<script module>
  import { find, myenergiPower } from '../lib/octopus.js';
  export const meta = {
    type: 'myenergi', name: 'Zappi / Eddi', icon: 'mdi:ev-plug-type2', category: 'Energy',
    size: { w: 400, h: 250 }, tap: 'none',
    // More info on this card opens the device's own power reading (24 h charging history).
    infoEntity: (p) => myenergiPower(p.power, p.device === 'eddi' ? 'eddi' : 'zappi', p.mode || p.status),
    defaults: { device: 'zappi', boosts: '5,10,20', cap: false, cap_hours: 6, eddi_target: 'Heater 1', eddi_minutes: '30,60,120' },
    autofill: () => {
      const z = find(/^select\.myenergi_zappi_.+_charge_mode$/);
      const p = z.replace(/^select\.(myenergi_zappi_\d+)_charge_mode$/, '$1');
      return { mode: z, status: `sensor.${p}_status`, plug: `sensor.${p}_plug_status`, session: `sensor.${p}_charge_added_session`, power: myenergiPower(find(/^sensor\.myenergi_hub_.+_power_charging/), 'zappi', z) };
    },
    sections: [{ key: 'status', label: 'Status', section: 'status' }, { key: 'power', label: 'Power', section: 'power' }, { key: 'modes', label: 'Mode buttons' }, { key: 'boosts', label: 'Boost buttons', section: 'boosts' }],
    fields: [
      { key: 'device', label: 'Device', type: 'select', options: ['zappi', 'eddi'] },
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'mode', label: 'Mode select (charge mode / operating mode)', type: 'entity', domain: 'select', section: 'modes' },
      { key: 'status', label: 'Status', type: 'entity', domain: 'sensor' },
      { key: 'plug', label: 'Plug status (Zappi)', type: 'entity', domain: 'sensor' },
      { key: 'power', label: 'Power', type: 'entity', domain: 'sensor' },
      { key: 'session', label: 'Energy this session / today', type: 'entity', domain: 'sensor' },
      { key: 'temp', label: 'Tank temperature (Eddi)', type: 'entity', domain: 'sensor' },
      { key: 'boosts', label: 'Zappi boost kWh buttons', type: 'text' },
      { key: 'cap', label: 'Intelligent Octopus Go: track the cheap charging hours (midday to midday)', type: 'bool' },
      { key: 'cap_hours', label: 'Cheap charging hours (Intelligent Octopus Go: 6)', type: 'number' },
      { key: 'eddi_target', label: 'Eddi boost heater', type: 'text' },
      { key: 'eddi_minutes', label: 'Eddi boost minute buttons', type: 'text' },
    ],
  };
</script>

<script>
  import Icon from '../components/Icon.svelte';
  import { t, ent } from '../lib/tpl.js';
  import { callService } from '../lib/ha.svelte.js';
  import { stateText } from '../lib/entity.js';
  import { useHistory } from '../lib/history.svelte.js';
  import { clock } from '../lib/clock.svelte.js';
  let { props } = $props();
  const show = (k) => !props.hide?.[k];
  const zappi = $derived(props.device !== 'eddi');
  const mode = $derived(ent(props.mode));
  const status = $derived(ent(props.status)?.state);
  const plug = $derived(ent(props.plug)?.state);
  // Power as kW from 1 kW up (7.2 kW), watts below (420 W).
  function kw(e) {
    const v = Number(e.state);
    if (!Number.isFinite(v)) return stateText(e);
    const w = /^kw$/i.test(e.attributes.unit_of_measurement || '') ? v * 1000 : v;
    return Math.abs(w) >= 1000 ? `${(w / 1000).toFixed(1)} kW` : `${Math.round(w)} W`;
  }
  const power = $derived(ent(myenergiPower(props.power, props.device === 'eddi' ? 'eddi' : 'zappi', props.mode || props.status)));
  const active = $derived(Number(power?.state) > 50);
  const C = $derived(zappi ? '#b48cff' : '#ff8a4c');
  const MODE_ICON = { Fast: 'mdi:flash', Eco: 'mdi:leaf', 'Eco+': 'mdi:solar-power', Stopped: 'mdi:stop', Normal: 'mdi:play', Boost: 'mdi:rocket-launch' };
  const list = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
  const target = $derived({ entity_id: props.mode });

  // Intelligent Octopus Go: only the first 6 hours the car actually charges,
  // midday to midday, get the cheap rate. Add up the time the Zappi has drawn
  // power since the last midday from its power history.
  const capOn = $derived(zappi && props.cap === true && !!power);
  const capH = $derived(Number(props.cap_hours) || 6);
  const hist = useHistory(() => (capOn ? [power.entity_id] : []), () => 24.5);
  const since = $derived.by(() => { const d = new Date(clock.now); if (d.getHours() < 12) d.setDate(d.getDate() - 1); d.setHours(12, 0, 0, 0); return +d; });
  const watts = (v) => (/^kw$/i.test(power?.attributes.unit_of_measurement || '') ? v * 1000 : v);
  const usedMs = $derived.by(() => {
    const pts = capOn ? hist.series[power.entity_id] || [] : [];
    let ms = 0;
    for (let i = 0; i < pts.length; i++) {
      const [t0, v] = pts[i];
      const t1 = i + 1 < pts.length ? pts[i + 1][0] : clock.now;
      const a = Math.max(t0, since), b = Math.min(t1, clock.now);
      if (b > a && watts(v) >= 500) ms += b - a;
    }
    return ms;
  });
  const leftMs = $derived(Math.max(0, capH * 3600e3 - usedMs));
  const hm = (ms) => { const m = Math.round(ms / 60e3); return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`; };
  const nowKw = $derived(active ? watts(Number(power.state)) / 1000 : 0);
</script>

<div class="me" style="--c:{C}">
  <div class="head">
    <span class="ic" class:on={active}><Icon icon={zappi ? 'mdi:ev-plug-type2' : 'mdi:water-boiler'} size="1.5em" /></span>
    <div class="t">
      <div class="title">{t(props.name) || (zappi ? 'Zappi' : 'Eddi')}</div>
      {#if show('status')}<div class="dim">{status || '—'}{#if plug}{' · '}{plug}{/if}</div>{/if}
    </div>
    {#if show('power')}<div class="pw"><b>{power ? kw(power) : '—'}</b>{#if props.session}<span>{stateText(ent(props.session))}{zappi ? ' session' : ' today'}</span>{/if}{#if props.temp}<span>{stateText(ent(props.temp))}</span>{/if}</div>{/if}
  </div>
  {#if capOn}
    <div class="cap" class:over={!leftMs} title="Intelligent Octopus Go: only the first {capH} hours of charging between middays are at the cheap rate">
      <div class="cl">
        <span><Icon icon={leftMs ? 'mdi:timer-sand' : 'mdi:alert-circle-outline'} size="1em" />{leftMs ? `${hm(leftMs)} cheap charging left` : 'Cheap hours used up'}</span>
        <span class="dim">{[`${hm(usedMs)} of ${capH}h`, !leftMs ? 'peak rate until 12:00' : nowKw ? `≈${(nowKw * leftMs / 3600e3).toFixed(0)} kWh at this rate` : 'resets 12:00'].join(' · ')}</span>
      </div>
      <div class="bar"><i style="width:{Math.min(100, (usedMs / (capH * 3600e3)) * 100)}%"></i></div>
    </div>
  {/if}
  {#if mode && show('modes')}
    <div class="modes" data-stop>
      {#each mode.attributes.options || [] as o}
        <button class:sel={o === mode.state} onclick={() => callService('select', 'select_option', { option: o }, target)}><Icon icon={MODE_ICON[o] || 'mdi:circle-medium'} size="1.1em" />{o}</button>
      {/each}
    </div>
  {/if}
  {#if show('boosts')}<div class="boosts" data-stop>
    {#if zappi}
      {#each list(props.boosts) as k}<button onclick={() => callService('myenergi', 'myenergi_boost', { amount: Number(k) }, target)}>+{k} kWh</button>{/each}
    {:else}
      {#each list(props.eddi_minutes) as m}<button onclick={() => callService('myenergi', 'myenergi_eddi_boost', { target: props.eddi_target || 'Heater 1', time: Number(m) }, target)}>{m} min</button>{/each}
    {/if}
    <button class="stop" onclick={() => callService('myenergi', 'myenergi_stop_boost', {}, target)}>Stop boost</button>
  </div>{/if}
</div>

<style>
  .me { height: 100%; display: flex; flex-direction: column; gap: 10px; justify-content: space-between; }
  .head { display: flex; align-items: center; gap: 12px; }
  .ic { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: rgba(255,255,255,.07); color: var(--muted); flex: none; }
  .ic.on { background: color-mix(in srgb, var(--c) 28%, transparent); color: var(--c); }
  .t { flex: 1; min-width: 0; }
  .title { font-weight: 600; }
  .dim { color: var(--muted); font-size: .85em; }
  .pw { text-align: right; display: flex; flex-direction: column; }
  .pw b { font-size: 1.3em; }
  .pw span { font-size: .75em; color: var(--muted); }
  .modes { display: flex; gap: 4px; }
  .modes button { flex: 1; border: 0; border-radius: 12px; padding: 9px 4px; background: rgba(255,255,255,.06); color: var(--muted); display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: .8em; }
  .modes .sel { background: color-mix(in srgb, var(--c) 28%, transparent); color: var(--text); }
  .modes .sel :global(svg) { color: var(--c); }
  .cap { display: flex; flex-direction: column; gap: 5px; }
  .cl { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: .85em; flex-wrap: wrap; }
  .cl span:first-child { display: inline-flex; align-items: center; gap: 5px; font-weight: 600; }
  .cl .dim { font-size: .92em; }
  .bar { height: 6px; border-radius: 3px; background: rgba(255,255,255,.08); overflow: hidden; }
  .bar i { display: block; height: 100%; border-radius: 3px; background: var(--c); transition: width .6s; }
  .over .bar i { background: #ffb547; }
  .over .cl span:first-child { color: #ffb547; }
  .boosts { display: flex; gap: 6px; flex-wrap: wrap; }
  .boosts button { border: 0; border-radius: 10px; padding: 7px 12px; background: rgba(255,255,255,.07); color: inherit; font-size: .85em; font-weight: 600; }
  .boosts .stop { color: var(--muted); margin-left: auto; }
</style>
