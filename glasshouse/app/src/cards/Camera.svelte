<script module>
  export const meta = {
    type: 'camera', name: 'Camera', icon: 'mdi:cctv', category: 'Media',
    size: { w: 400, h: 240 }, tap: 'more-info',
    defaults: { entity: '', mode: 'snapshot', refresh: 5, fit: 'cover', show_name: true },
    fields: [
      { key: 'entity', label: 'Camera', type: 'entity', domain: ['camera', 'image'] },
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'show_name', label: 'Show name', type: 'bool' },
      { key: 'mode', label: 'Mode', type: 'select', options: ['snapshot', 'live'] },
      { key: 'refresh', label: 'Snapshot refresh (s)', type: 'number' },
      { key: 'fit', label: 'Fit', type: 'select', options: ['cover', 'contain'] },
    ],
  };
</script>

<script>
  import { t, ent } from '../lib/tpl.js';
  import { name } from '../lib/entity.js';
  import { haImage } from '../lib/ha.svelte.js';
  let { props } = $props();
  const e = $derived(ent(props.entity));
  let tick = $state(0);
  $effect(() => {
    if (props.mode === 'live') return;
    const i = setInterval(() => document.visibilityState === 'visible' && tick++, Math.max(1, Number(props.refresh) || 5) * 1000);
    return () => clearInterval(i);
  });
  const token = $derived(e?.attributes.access_token);
  const src = $derived.by(() => {
    if (!e) return '';
    if (e.entity_id.startsWith('image.')) return haImage(e.attributes.entity_picture);
    if (props.mode === 'live') return `ha/api/camera_proxy_stream/${e.entity_id}?token=${token}`;
    return `ha/api/camera_proxy/${e.entity_id}?token=${token}&t=${tick}`;
  });
  // Double-buffer snapshots so the image never flashes blank while loading.
  let shown = $state('');
  $effect(() => {
    const s = src;
    if (!s || props.mode === 'live') return void (shown = s);
    const img = new Image();
    img.onload = () => (shown = s);
    img.src = s;
  });
</script>

<div class="cam">
  {#if shown}<img src={shown} alt="" style="object-fit:{props.fit}" />{/if}
  {#if props.show_name}<div class="lbl">{t(props.name) || name(e)}</div>{/if}
</div>

<style>
  .cam { position: absolute; inset: 0; background: #000; overflow: hidden; border-radius: inherit; }
  img { width: 100%; height: 100%; display: block; }
  .lbl { position: absolute; left: 0; right: 0; bottom: 0; padding: 18px 14px 10px; background: linear-gradient(transparent, rgba(0,0,0,.6)); font-weight: 600; font-size: .9em; }
</style>
