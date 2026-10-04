<script>
  import Icon from './Icon.svelte';
  import { iconNames } from '../lib/icons.svelte.js';
  let { value = $bindable(''), onchange } = $props();
  let open = $state(false);
  let all = $state([]);
  const results = $derived(open && value && !value.includes('{') ? all.filter((n) => n.includes(value.toLowerCase().replace(/^mdi:/, ''))).slice(0, 48) : []);
  async function focus() { open = true; if (!all.length) all = await iconNames(); }
  function pick(n) { value = n; open = false; onchange?.(); }
</script>

<div class="ip">
  <div class="row">
    <span class="pv"><Icon icon={value && !value.includes('{') ? value : 'mdi:help-circle-outline'} size="1.3em" /></span>
    <input type="text" bind:value placeholder="mdi:lightbulb (or template)" onfocus={focus} oninput={() => onchange?.()} onblur={() => setTimeout(() => (open = false), 150)} />
  </div>
  {#if results.length}
    <div class="grid">
      {#each results as n}<button type="button" title={n} onmousedown={(e) => e.preventDefault()} onclick={() => pick(n)}><Icon icon={n} size="1.4em" /></button>{/each}
    </div>
  {/if}
</div>

<style>
  .ip { position: relative; }
  .row { display: flex; gap: 6px; align-items: center; }
  .pv { width: 34px; height: 34px; display: grid; place-items: center; background: rgba(255,255,255,.06); border-radius: 8px; flex: none; }
  .grid { position: absolute; z-index: 50; top: calc(100% + 4px); left: 0; right: 0; display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px; padding: 6px; background: #1b2030; border: 1px solid rgba(255,255,255,.1); border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.5); }
  .grid button { aspect-ratio: 1; background: none; border: 0; color: inherit; border-radius: 6px; display: grid; place-items: center; }
  .grid button:hover { background: rgba(255,255,255,.1); }
</style>
