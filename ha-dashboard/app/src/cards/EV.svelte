<script module>
  import { find } from '../lib/octopus.js';
  export const meta = {
    type: 'ev', name: 'Electric vehicle', icon: 'mdi:car-electric', category: 'Energy',
    size: { w: 380, h: 220 }, tap: 'none',
    defaults: {},
    autofill: () => {
      const soc = find(/^sensor\.(?!octopus)[a-z0-9_]+(?<!target)_state_of_charge$/);
      const p = soc.replace(/_state_of_charge$/, '');
      const s = (x) => `${p}_${x}`;
      return { soc, range: s('range'), charging: s('charging_state'), power: s('charging_power'), target: s('target_state_of_charge'), remaining: s('remaining_charge_time'), plug: s('plug_state').replace('sensor.', 'binary_sensor.'), lock: s('doors_lock').replace('sensor.', 'binary_sensor.'), climate: s('climatisation').replace('sensor.', 'climate.'), mileage: s('mileage') };
    },
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'soc', label: 'Battery %', type: 'entity', domain: 'sensor' },
      { key: 'range', label: 'Range', type: 'entity', domain: 'sensor' },
      { key: 'target', label: 'Target %', type: 'entity', domain: 'sensor' },
      { key: 'charging', label: 'Charging state', type: 'entity', domain: 'sensor' },
      { key: 'power', label: 'Charging power', type: 'entity', domain: 'sensor' },
      { key: 'remaining', label: 'Remaining charge time', type: 'entity', domain: 'sensor' },
      { key: 'plug', label: 'Plugged in', type: 'entity', domain: 'binary_sensor' },
      { key: 'lock', label: 'Locked (doors lock)', type: 'entity', domain: ['binary_sensor', 'lock'] },
      { key: 'climate', label: 'Climatisation', type: 'entity', domain: 'climate' },
      { key: 'mileage', label: 'Mileage', type: 'entity', domain: 'sensor' },
      { key: 'image', label: 'Car image URL', type: 'text' },
    ],
  };
</script>

<script>
  import Icon from '../components/Icon.svelte';
  import { t, ent } from '../lib/tpl.js';
  import { callService, haImage } from '../lib/ha.svelte.js';
  import { stateText, formatNumber } from '../lib/entity.js';
  let { props } = $props();
  const soc = $derived(Number(ent(props.soc)?.state));
  const tgt = $derived(Number(ent(props.target)?.state));
  const charging = $derived(/charg/i.test(ent(props.charging)?.state || '') && !/not|complete|error/i.test(ent(props.charging)?.state || ''));
  const plug = $derived(ent(props.plug));
  const lock = $derived(ent(props.lock));
  const clim = $derived(ent(props.climate));
  const color = $derived(soc < 20 ? '#ff7a90' : soc < 50 ? '#ffc861' : '#5bd88f');
  const name = $derived(t(props.name) || (props.soc ? props.soc.replace(/^sensor\.|_state_of_charge$/g, '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : 'EV'));
  const R = 42, C = 2 * Math.PI * R;
  const human = (s) => (s || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase();
</script>

<div class="ev">
  <div class="ring">
    <svg viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,.08)" stroke-width="8" />
      {#if !isNaN(tgt)}<circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,.18)" stroke-width="8" stroke-dasharray="1.2 {C}" stroke-dashoffset={-C * (tgt / 100) + 0.6} transform="rotate(-90 50 50)" />{/if}
      <circle cx="50" cy="50" r={R} fill="none" style="stroke:{color};transition:stroke-dasharray .6s" stroke-width="8" stroke-linecap="round" stroke-dasharray="{isNaN(soc) ? 0 : (C * soc) / 100} {C}" transform="rotate(-90 50 50)" class:pulse={charging} />
    </svg>
    <div class="pct">{isNaN(soc) ? '—' : Math.round(soc) + '%'}{#if charging}<Icon icon="mdi:lightning-bolt" size=".7em" style="color:{color}" />{/if}</div>
  </div>
  <div class="info">
    <div class="name">{name}</div>
    {#if props.range}<div class="range">{formatNumber(ent(props.range)?.state, 0)} <span>{ent(props.range)?.attributes.unit_of_measurement || ''}</span></div>{/if}
    <div class="dim">
      {#if charging}Charging {props.power ? stateText(ent(props.power)) : ''}{#if props.remaining && Number(ent(props.remaining)?.state)}{' · '}{Math.floor(ent(props.remaining).state / 60)}h {ent(props.remaining).state % 60}m left{/if}
      {:else}{human(ent(props.charging)?.state) || ''}{/if}
      {#if !isNaN(tgt)}{' · '}target {tgt}%{/if}
    </div>
    <div class="chips" data-stop>
      {#if plug}<span class="chip" class:on={plug.state === 'on'}><Icon icon={plug.state === 'on' ? 'mdi:power-plug' : 'mdi:power-plug-off'} size="1em" />{plug.state === 'on' ? 'Plugged' : 'Unplugged'}</span>{/if}
      {#if lock}<span class="chip" class:warn={lock.state === 'on' && lock.entity_id.startsWith('binary_sensor')}><Icon icon={lock.state === 'on' ? 'mdi:lock-open-variant' : 'mdi:lock'} size="1em" />{lock.entity_id.startsWith('binary_sensor') ? (lock.state === 'on' ? 'Unlocked' : 'Locked') : stateText(lock)}</span>{/if}
      {#if clim}<button class="chip" class:on={clim.state !== 'off'} onclick={() => callService('climate', clim.state === 'off' ? 'turn_on' : 'turn_off', {}, { entity_id: clim.entity_id })}><Icon icon="mdi:fan" size="1em" />{clim.state === 'off' ? 'Climate' : 'Climate on'}</button>{/if}
    </div>
    {#if props.mileage}<div class="dim small">{formatNumber(ent(props.mileage)?.state, 0)} {ent(props.mileage)?.attributes.unit_of_measurement || ''}</div>{/if}
  </div>
  {#if props.image}<img class="car" src={haImage(t(props.image))} alt="" />{/if}
</div>

<style>
  .ev { height: 100%; display: flex; align-items: center; gap: 16px; position: relative; }
  .ring { position: relative; height: 100%; max-height: 150px; aspect-ratio: 1; flex: none; }
  .ring svg { width: 100%; height: 100%; }
  .pulse { animation: pulse 2s infinite; }
  @keyframes pulse { 50% { opacity: .55; } }
  .pct { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 1.6em; font-weight: 600; }
  .info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; z-index: 1; }
  .name { font-weight: 600; font-size: 1.1em; }
  .range { font-size: 1.6em; font-weight: 600; line-height: 1; }
  .range span { font-size: .5em; color: var(--muted); }
  .dim { color: var(--muted); font-size: .85em; text-transform: none; }
  .small { font-size: .75em; }
  .chips { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 4px; }
  .chip { display: inline-flex; align-items: center; gap: 4px; font-size: .75em; padding: 4px 8px; border-radius: 8px; background: rgba(255,255,255,.07); color: var(--muted); border: 0; }
  .chip.on { color: #5bd88f; background: rgba(91,216,143,.14); }
  .chip.warn { color: #ffc861; }
  .car { position: absolute; right: -10px; bottom: -10px; height: 70%; opacity: .9; pointer-events: none; }
</style>
