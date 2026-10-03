<script module>
  export const meta = {
    type: 'image', name: 'Image', icon: 'mdi:image', category: 'Media',
    size: { w: 300, h: 200 }, tap: 'none',
    defaults: { url: '', fit: 'cover' },
    fields: [
      { key: 'url', label: 'Image URL (template ok)', type: 'text' },
      { key: 'fit', label: 'Fit', type: 'select', options: ['cover', 'contain', 'fill'] },
    ],
  };
</script>

<script>
  import { t } from '../lib/tpl.js';
  import { haImage } from '../lib/ha.svelte.js';
  let { props } = $props();
  const src = $derived(haImage(t(props.url)));
</script>

{#if src}<img {src} alt="" style="object-fit:{props.fit}" />{/if}

<style>
  img { position: absolute; inset: 0; width: 100%; height: 100%; border-radius: inherit; }
</style>
