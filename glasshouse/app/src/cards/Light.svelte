<script module>
  export const meta = {
    type: 'light', name: 'Light', icon: 'mdi:lightbulb', category: 'Controls',
    size: { w: 280, h: 130 }, tap: 'toggle', hold: 'more-info',
    defaults: { entity: '' },
    fields: [
      { key: 'entity', label: 'Light', type: 'entity', domain: 'light' },
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'icon', label: 'Icon', type: 'icon' },
    ],
  };
</script>

<script>
  import Icon from '../components/Icon.svelte';
  import Slider from '../components/Slider.svelte';
  import { t, ent } from '../lib/tpl.js';
  import { name, entityIcon, lightColor, toggle } from '../lib/entity.js';
  import { callService } from '../lib/ha.svelte.js';
  let { props } = $props();
  const e = $derived(ent(props.entity));
  const on = $derived(e?.state === 'on');
  const pct = $derived(on ? Math.round(((e.attributes.brightness ?? 255) / 255) * 100) : 0);
  const color = $derived(lightColor(e) || 'var(--on)');
  const dimmable = $derived(e?.attributes.supported_color_modes?.some((m) => m !== 'onoff'));
</script>

<div class="light" style="--ac:{color}">
  <div class="top">
    <button class="ic" class:on data-stop onclick={() => e && toggle(e)}><Icon icon={t(props.icon) || entityIcon(e)} size="1.5em" /></button>
    <div class="txt">
      <div class="name">{t(props.name) || name(e)}</div>
      <div class="state">{on ? (dimmable ? pct + '%' : 'On') : e?.state === 'off' ? 'Off' : e?.state || '—'}</div>
    </div>
  </div>
  {#if dimmable}
    <Slider value={pct} min={1} max={100} {color} onchange={(v) => callService('light', 'turn_on', { brightness_pct: v }, { entity_id: e.entity_id })} />
  {/if}
</div>

<style>
  .light { height: 100%; display: flex; flex-direction: column; justify-content: space-between; gap: 10px; }
  .top { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .ic { width: 2.6em; height: 2.6em; border-radius: 50%; display: grid; place-items: center; background: rgba(255,255,255,.08); color: var(--muted); border: 0; flex: none; transition: all .25s; }
  .ic.on { background: color-mix(in srgb, var(--ac) 25%, transparent); color: var(--ac); }
  .txt { min-width: 0; }
  .name { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .state { color: var(--muted); font-size: .88em; }
</style>
