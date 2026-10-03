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
  // Just the id, so attribute updates (e.g. the rotating access token) don't restart streams.
  const camId = $derived(e?.entity_id.startsWith('camera.') ? e.entity_id : null);
  const live = $derived(props.mode === 'live' && !!camId);
  let tick = $state(0);
  let shown = $state('');
  // Snapshots: poll, double-buffered so the picture never flashes blank.
  $effect(() => {
    if (live) return;
    const i = setInterval(() => document.visibilityState === 'visible' && tick++, Math.max(1, Number(props.refresh) || 5) * 1000);
    return () => clearInterval(i);
  });
  const src = $derived.by(() => {
    if (!e) return '';
    if (e.entity_id.startsWith('image.')) return haImage(e.attributes.entity_picture);
    return `ha/api/camera_proxy/${e.entity_id}?t=${tick}`;
  });
  $effect(() => {
    const s = src;
    if (!s || live) return;
    const img = new Image();
    img.onload = () => (shown = s);
    img.src = s;
    return () => (img.onload = null);
  });
  // Live: JPEG frames over a websocket (see server camStream), reconnecting if
  // the stream drops and pausing while the screen is hidden.
  $effect(() => {
    if (!live) return;
    const id = camId;
    const base = location.pathname.replace(/[^/]*$/, '');
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${base}api/camera?entity=${encodeURIComponent(id)}`;
    let ws, timer, url0 = '', stopped = false, backoff = 1000;
    shown = `ha/api/camera_proxy/${id}?t=${Date.now()}`;
    const open = () => {
      if (stopped || document.visibilityState !== 'visible') return;
      ws = new WebSocket(url);
      ws.binaryType = 'blob';
      ws.onmessage = (ev) => {
        backoff = 1000;
        const u = URL.createObjectURL(new Blob([ev.data], { type: 'image/jpeg' }));
        shown = u;
        if (url0) URL.revokeObjectURL(url0);
        url0 = u;
      };
      ws.onclose = () => {
        ws = null;
        if (stopped) return;
        timer = setTimeout(open, backoff);
        backoff = Math.min(backoff * 2, 15000);
      };
    };
    const vis = () => {
      if (document.visibilityState === 'visible') { if (!ws) { clearTimeout(timer); open(); } }
      else if (ws) { ws.onclose = null; ws.close(); ws = null; }
    };
    document.addEventListener('visibilitychange', vis);
    open();
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', vis);
      if (ws) { ws.onclose = null; ws.close(); }
      if (url0) setTimeout(() => URL.revokeObjectURL(url0), 1000);
    };
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
