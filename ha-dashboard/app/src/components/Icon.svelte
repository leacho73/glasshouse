<script>
  import { iconPath } from '../lib/icons.svelte.js';
  let { icon, size = '1.5em', class: cls = '', style = '' } = $props();
  const path = $derived(icon?.startsWith('mdi:') ? iconPath(icon) : '');
</script>

{#if icon && !icon.startsWith('mdi:')}
  <span class="ico {cls}" style="font-size:{size};{style}">{icon}</span>
{:else}
  <svg class="ico {cls}" viewBox="0 0 24 24" style="width:{size};height:{size};{style}" aria-hidden="true"><path d={path} fill="currentColor" /></svg>
{/if}

<style>
  .ico { flex: none; display: inline-block; line-height: 1; }
</style>
