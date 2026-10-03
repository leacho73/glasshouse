<script module>
  export const meta = {
    type: 'nav', name: 'Navigation', icon: 'mdi:menu', category: 'Layout',
    size: { w: 260, h: 220 }, tap: 'none',
    defaults: { direction: 'vertical', show_icons: true, show_names: true },
    fields: [
      { key: 'direction', label: 'Direction', type: 'select', options: ['vertical', 'horizontal'] },
      { key: 'show_icons', label: 'Icons', type: 'bool' },
      { key: 'show_names', label: 'Names', type: 'bool' },
    ],
  };
</script>

<script>
  import Icon from '../components/Icon.svelte';
  import { app, setView } from '../lib/config.svelte.js';
  let { props } = $props();
</script>

<nav class="nav {props.direction}" data-stop>
  {#each app.config.views as v}
    <button class:sel={app.view === v.id} onclick={() => setView(v.id)}>
      {#if props.show_icons !== false}<Icon icon={v.icon} size="1.3em" />{/if}
      {#if props.show_names !== false}<span>{v.name}</span>{/if}
    </button>
  {/each}
</nav>

<style>
  .nav { height: 100%; display: flex; flex-direction: column; gap: 4px; overflow: auto; }
  .horizontal { flex-direction: row; align-items: center; }
  button { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 14px; border: 0; background: none; color: var(--muted); font: inherit; font-weight: 500; text-align: left; white-space: nowrap; transition: all .2s; }
  .horizontal button { flex: 1; justify-content: center; }
  button.sel { background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--text); }
  button.sel :global(svg) { color: var(--accent); }
</style>
