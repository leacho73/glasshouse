<script module>
  import { find } from '../lib/octopus.js';
  export const meta = {
    type: 'myenergi', name: 'Zappi / Eddi', icon: 'mdi:ev-plug-type2', category: 'Energy',
    size: { w: 400, h: 250 }, tap: 'none',
    defaults: { device: 'zappi', boosts: '5,10,20', eddi_target: 'Heater 1', eddi_minutes: '30,60,120' },
    autofill: () => {
      const z = find(/^select\.myenergi_zappi_.+_charge_mode$/);
      const p = z.replace(/^select\.(myenergi_zappi_\d+)_charge_mode$/, '$1');
      return { mode: z, status: `sensor.${p}_status`, plug: `sensor.${p}_plug_status`, session: `sensor.${p}_charge_added_session`, power: find(/^sensor\.myenergi_hub_.+_power_charging/) };
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
  let { props } = $props();
  const show = (k) => !props.hide?.[k];
  const zappi = $derived(props.device !== 'eddi');
  const mode = $derived(ent(props.mode));
  const status = $derived(ent(props.status)?.state);
  const plug = $derived(ent(props.plug)?.state);
  const power = $derived(ent(props.power));
  const active = $derived(Number(power?.state) > 50);
  const C = $derived(zappi ? '#b48cff' : '#ff8a4c');
  const MODE_ICON = { Fast: 'mdi:flash', Eco: 'mdi:leaf', 'Eco+': 'mdi:solar-power', Stopped: 'mdi:stop', Normal: 'mdi:play', Boost: 'mdi:rocket-launch' };
  const list = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
  const target = $derived({ entity_id: props.mode });
</script>

<div class="me" style="--c:{C}">
  <div class="head">
    <span class="ic" class:on={active}><Icon icon={zappi ? 'mdi:ev-plug-type2' : 'mdi:water-boiler'} size="1.5em" /></span>
    <div class="t">
      <div class="title">{t(props.name) || (zappi ? 'Zappi' : 'Eddi')}</div>
      {#if show('status')}<div class="dim">{status || '—'}{#if plug}{' · '}{plug}{/if}</div>{/if}
    </div>
    {#if show('power')}<div class="pw"><b>{power ? stateText(power) : '—'}</b>{#if props.session}<span>{stateText(ent(props.session))}{zappi ? ' session' : ' today'}</span>{/if}{#if props.temp}<span>{stateText(ent(props.temp))}</span>{/if}</div>{/if}
  </div>
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
  .boosts { display: flex; gap: 6px; flex-wrap: wrap; }
  .boosts button { border: 0; border-radius: 10px; padding: 7px 12px; background: rgba(255,255,255,.07); color: inherit; font-size: .85em; font-weight: 600; }
  .boosts .stop { color: var(--muted); margin-left: auto; }
</style>
