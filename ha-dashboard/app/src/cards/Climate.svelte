<script module>
  export const meta = {
    type: 'climate', name: 'Thermostat', icon: 'mdi:thermostat', category: 'Controls',
    size: { w: 260, h: 220 }, tap: 'none', hold: 'more-info',
    defaults: { entity: '', show_modes: true },
    fields: [
      { key: 'entity', label: 'Climate / water heater', type: 'entity', domain: ['climate', 'water_heater'] },
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'show_modes', label: 'Show modes', type: 'bool' },
    ],
  };
</script>

<script>
  import Icon from '../components/Icon.svelte';
  import { t, ent } from '../lib/tpl.js';
  import { name, domain, formatNumber } from '../lib/entity.js';
  import { callService } from '../lib/ha.svelte.js';
  let { props } = $props();
  const e = $derived(ent(props.entity));
  const a = $derived(e?.attributes || {});
  const d = $derived(domain(e?.entity_id));
  const step = $derived(a.target_temp_step || (a.temperature_unit === '°F' ? 1 : 0.5));
  const target = $derived(a.temperature ?? a.target_temp_low);
  let pendingT = $state(null);
  let timer;
  function bump(dir) {
    const base = pendingT ?? target;
    if (base == null) return;
    pendingT = Math.min(a.max_temp ?? 100, Math.max(a.min_temp ?? 0, Math.round((base + dir * step) / step) * step));
    clearTimeout(timer);
    timer = setTimeout(() => {
      callService(d, 'set_temperature', { temperature: pendingT }, { entity_id: e.entity_id }).finally(() => setTimeout(() => (pendingT = null), 1500));
    }, 900);
  }
  const modes = $derived(d === 'water_heater' ? a.operation_list || [] : a.hvac_modes || []);
  const mode = $derived(d === 'water_heater' ? a.operation_mode || e?.state : e?.state);
  const MODE_ICON = { off: 'mdi:power', heat: 'mdi:fire', cool: 'mdi:snowflake', auto: 'mdi:thermostat-auto', heat_cool: 'mdi:sun-snowflake-variant', dry: 'mdi:water-percent', fan_only: 'mdi:fan', eco: 'mdi:leaf', heat_pump: 'mdi:heat-pump', electric: 'mdi:flash', performance: 'mdi:rocket-launch', boost: 'mdi:rocket-launch' };
  function setMode(m) {
    if (d === 'water_heater') callService(d, 'set_operation_mode', { operation_mode: m }, { entity_id: e.entity_id });
    else callService(d, 'set_hvac_mode', { hvac_mode: m }, { entity_id: e.entity_id });
  }
  const action = $derived(a.hvac_action);
  const color = $derived(action === 'heating' || mode === 'heat' ? '#ff8a4c' : action === 'cooling' || mode === 'cool' ? '#59b8ff' : 'var(--accent)');
</script>

<div class="clim" style="--ac:{color}">
  <div class="head">
    <span class="name">{t(props.name) || name(e)}</span>
    <span class="cur">{a.current_temperature != null ? formatNumber(a.current_temperature, 1) + '°' : ''}</span>
  </div>
  <div class="set" data-stop>
    <button onclick={() => bump(-1)} aria-label="Lower"><Icon icon="mdi:minus" /></button>
    <div class="tgt" class:pending={pendingT != null}>
      {(pendingT ?? target) != null ? formatNumber(pendingT ?? target, step < 1 ? 1 : 0) : '—'}<small>{a.temperature_unit || '°'}</small>
      <div class="act">{action ? action.replace(/_/g, ' ') : mode || ''}</div>
    </div>
    <button onclick={() => bump(1)} aria-label="Raise"><Icon icon="mdi:plus" /></button>
  </div>
  {#if props.show_modes && modes.length}
    <div class="modes" data-stop>
      {#each modes as m}
        <button class:sel={m === mode} title={m} onclick={() => setMode(m)}><Icon icon={MODE_ICON[m] || 'mdi:circle-medium'} size="1.2em" /></button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .clim { height: 100%; display: flex; flex-direction: column; justify-content: space-between; }
  .head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .name { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cur { color: var(--muted); }
  .set { display: flex; align-items: center; justify-content: space-between; }
  .set button { width: 48px; height: 48px; border-radius: 50%; border: 0; background: rgba(255,255,255,.08); color: inherit; display: grid; place-items: center; }
  .set button:active { background: color-mix(in srgb, var(--ac) 40%, transparent); }
  .tgt { font-size: 2.6em; font-weight: 600; text-align: center; color: var(--ac); line-height: 1; transition: opacity .2s; }
  .tgt.pending { opacity: .7; }
  .tgt small { font-size: .4em; color: var(--muted); }
  .act { font-size: .32em; color: var(--muted); font-weight: 500; text-transform: capitalize; margin-top: 4px; }
  .modes { display: flex; gap: 4px; justify-content: center; flex-wrap: wrap; }
  .modes button { flex: 1; max-width: 52px; height: 36px; border-radius: 12px; border: 0; background: rgba(255,255,255,.06); color: var(--muted); display: grid; place-items: center; }
  .modes .sel { background: color-mix(in srgb, var(--ac) 30%, transparent); color: var(--ac); }
</style>
