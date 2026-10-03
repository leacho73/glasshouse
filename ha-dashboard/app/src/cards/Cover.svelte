<script module>
  export const meta = {
    type: 'cover', name: 'Cover / blind', icon: 'mdi:blinds', category: 'Controls',
    size: { w: 280, h: 140 }, tap: 'none', hold: 'more-info',
    defaults: { entity: '' },
    fields: [
      { key: 'entity', label: 'Cover', type: 'entity', domain: 'cover' },
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'icon', label: 'Icon', type: 'icon' },
    ],
  };
</script>

<script>
  import Icon from '../components/Icon.svelte';
  import Slider from '../components/Slider.svelte';
  import { t, ent } from '../lib/tpl.js';
  import { name, entityIcon, stateText } from '../lib/entity.js';
  import { callService } from '../lib/ha.svelte.js';
  let { props } = $props();
  const e = $derived(ent(props.entity));
  const svc = (s, d = {}) => callService('cover', s, d, { entity_id: e.entity_id });
  const hasPos = $derived(e?.attributes.current_position != null);
</script>

<div class="cv">
  <div class="top">
    <Icon icon={t(props.icon) || entityIcon(e)} size="1.4em" />
    <div class="txt"><div class="name">{t(props.name) || name(e)}</div><div class="state">{stateText(e)}</div></div>
    <div class="btns" data-stop>
      <button onclick={() => svc('open_cover')} aria-label="Open"><Icon icon="mdi:arrow-up" size="1.3em" /></button>
      <button onclick={() => svc('stop_cover')} aria-label="Stop"><Icon icon="mdi:stop" size="1.3em" /></button>
      <button onclick={() => svc('close_cover')} aria-label="Close"><Icon icon="mdi:arrow-down" size="1.3em" /></button>
    </div>
  </div>
  {#if hasPos}<Slider value={e.attributes.current_position} onchange={(v) => svc('set_cover_position', { position: v })} />{/if}
</div>

<style>
  .cv { height: 100%; display: flex; flex-direction: column; justify-content: space-between; gap: 10px; }
  .top { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .txt { flex: 1; min-width: 0; }
  .name { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .state { color: var(--muted); font-size: .88em; }
  .btns { display: flex; gap: 4px; }
  .btns button { width: 40px; height: 40px; border-radius: 12px; border: 0; background: rgba(255,255,255,.08); color: inherit; display: grid; place-items: center; }
  .btns button:active { background: var(--accent); }
</style>
