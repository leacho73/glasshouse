<script module>
  export const meta = {
    type: 'person', name: 'People', icon: 'mdi:account-group', category: 'Info',
    size: { w: 320, h: 110 }, tap: 'none',
    defaults: { entities: [] },
    fields: [{ key: 'entities', label: 'People', type: 'entities', domain: ['person', 'device_tracker'] }],
  };
</script>

<script>
  import { states, haImage } from '../lib/ha.svelte.js';
  import { app } from '../lib/config.svelte.js';
  import { stateText } from '../lib/entity.js';
  let { props } = $props();
</script>

<div class="ppl">
  {#each props.entities || [] as id}
    {@const e = states.get(id)}
    {@const home = e?.state === 'home'}
    <button class="p" data-stop onclick={() => (app.popup = { entity: id })}>
      <div class="av" class:home>
        {#if e?.attributes.entity_picture}<img src={haImage(e.attributes.entity_picture)} alt="" />{:else}{(e?.attributes.friendly_name || '?')[0]}{/if}
      </div>
      <span class="n">{e?.attributes.friendly_name || id}</span>
      <span class="s">{stateText(e)}</span>
    </button>
  {/each}
</div>

<style>
  .ppl { height: 100%; display: flex; justify-content: space-around; align-items: center; gap: 6px; }
  .p { display: flex; flex-direction: column; align-items: center; gap: 3px; background: none; border: 0; color: inherit; font: inherit; min-width: 0; flex: 1; }
  .av { width: 48px; height: 48px; border-radius: 50%; overflow: hidden; display: grid; place-items: center; background: rgba(255,255,255,.1); font-weight: 600; font-size: 1.2em; filter: grayscale(1); opacity: .6; box-shadow: 0 0 0 2px rgba(255,255,255,.1); transition: all .3s; }
  .av.home { filter: none; opacity: 1; box-shadow: 0 0 0 2px #5bd88f; }
  .av img { width: 100%; height: 100%; object-fit: cover; }
  .n { font-size: .85em; font-weight: 600; white-space: nowrap; }
  .s { font-size: .75em; color: var(--muted); white-space: nowrap; }
</style>
