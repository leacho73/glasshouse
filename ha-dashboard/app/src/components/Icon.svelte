<script>
  import { iconPath, iconSvg } from '../lib/icons.svelte.js';
  let { icon, size = '1.5em', class: cls = '', style = '' } = $props();
  const name = $derived(typeof icon === 'string' ? icon.trim() : '');
  const isMdi = $derived(name.startsWith('mdi:'));
  const isSet = $derived(!isMdi && /^[a-z0-9-]+:[a-z0-9-]+$/.test(name));
  const path = $derived(isMdi ? iconPath(name) : '');
  const svg = $derived(isSet ? iconSvg(name) : null);
</script>

{#if isMdi || (isSet && !svg)}
  <svg class="ico {cls}" viewBox="0 0 24 24" style="width:{size};height:{size};{style}" aria-hidden="true"><path d={path} fill="currentColor" /></svg>
{:else if svg}
  <svg class="ico {cls}" viewBox="0 0 {svg.w} {svg.h}" style="width:{size};height:{size};{style}" aria-hidden="true">{@html svg.b}</svg>
{:else if name}
  <span class="ico {cls}" style="font-size:{size};{style}">{name}</span>
{/if}

<style>
  .ico { flex: none; display: inline-block; line-height: 1; }
</style>
