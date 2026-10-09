<script module>
  export const meta = {
    type: 'cover', name: 'Cover / blind', icon: 'mdi:blinds', category: 'Controls',
    size: { w: 280, h: 140 }, tap: 'none', hold: 'more-info',
    defaults: { entity: '' },
    sections: [{ key: 'icon', label: 'Icon' }, { key: 'state', label: 'State' }, { key: 'buttons', label: 'Open / stop / close' }, { key: 'slider', label: 'Position slider' }],
    fields: [
      { key: 'entity', label: 'Cover', type: 'entity', domain: 'cover' },
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'icon', label: 'Icon', type: 'icon' },
    ],
  };
</script>

<script>
  // A blind or cover: open / stop / close and a position slider. The buttons
  // sit beside the name when there's room, and drop underneath when the slider
  // is hidden or the card is too narrow for both.
  import Icon from '../components/Icon.svelte';
  import Slider from '../components/Slider.svelte';
  import { t, ent } from '../lib/tpl.js';
  import { name, entityIcon, stateText } from '../lib/entity.js';
  import { callService } from '../lib/ha.svelte.js';
  let { props, w = 280, h = 140 } = $props();
  const show = (k) => !props.hide?.[k];
  const e = $derived(ent(props.entity));
  const svc = (s, d = {}) => callService('cover', s, d, { entity_id: e.entity_id });
  const hasPos = $derived(e?.attributes.current_position != null);
  const slider = $derived(show('slider') && hasPos && h >= 110);
  // Underneath: when there's no slider (and room for a second row), or the
  // name would be squeezed by the buttons.
  const below = $derived(show('buttons') && h >= 100 && (!slider || w < 330));
</script>

<div class="cv">
  <div class="top">
    {#if show('icon')}<Icon icon={t(props.icon) || entityIcon(e)} size="1.4em" />{/if}
    <div class="txt"><div class="name">{t(props.name) || name(e)}</div>{#if show('state')}<div class="state">{stateText(e)}</div>{/if}</div>
    {#if show('buttons') && !below}{@render btns()}{/if}
  </div>
  {#if below}{@render btns()}{/if}
  {#if slider}<Slider value={e.attributes.current_position} unit="%" onchange={(v) => svc('set_cover_position', { position: v })} />{/if}
</div>

{#snippet btns()}
  <div class="btns" class:below data-stop>
    <button onclick={() => svc('open_cover')} aria-label="Open"><Icon icon="mdi:arrow-up" size="1.3em" /></button>
    <button onclick={() => svc('stop_cover')} aria-label="Stop"><Icon icon="mdi:stop" size="1.3em" /></button>
    <button onclick={() => svc('close_cover')} aria-label="Close"><Icon icon="mdi:arrow-down" size="1.3em" /></button>
  </div>
{/snippet}

<style>
  .cv { height: 100%; display: flex; flex-direction: column; justify-content: space-between; gap: 10px; }
  .top { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .txt { flex: 1; min-width: 0; }
  .name { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .state { color: var(--muted); font-size: .88em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .btns { display: flex; gap: 4px; flex: none; }
  .btns button { width: 40px; height: 40px; border-radius: 12px; border: 0; background: rgba(255,255,255,.08); color: inherit; display: grid; place-items: center; }
  .btns.below { gap: 8px; }
  .btns.below button { flex: 1; width: auto; height: 44px; }
  .btns button:active { background: var(--accent); }
</style>
