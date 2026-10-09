<script module>
  export const meta = {
    type: 'camera', name: 'Camera', icon: 'mdi:cctv', category: 'Media',
    size: { w: 400, h: 240 }, tap: 'fullscreen',
    defaults: { entity: '', mode: 'snapshot', refresh: 5, fit: 'auto', show_name: true },
    fields: [
      { key: 'entity', label: 'Camera', type: 'entity', domain: ['camera', 'image'] },
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'show_name', label: 'Show name', type: 'bool' },
      { key: 'mode', label: 'Mode', type: 'select', options: [{ value: 'snapshot', label: 'Snapshot' }, { value: 'live', label: 'Live' }, { value: 'video', label: 'Video stream (for cameras whose pictures fail)' }] },
      { key: 'refresh', label: 'Snapshot refresh (s)', type: 'number' },
      { key: 'fit', label: 'Fit', type: 'select', options: [{ value: 'auto', label: 'Auto' }, { value: 'crop', label: 'Fill the card (crops edges)' }, { value: 'contain', label: 'Whole picture' }] },
    ],
  };
</script>

<script>
  import { t, ent } from '../lib/tpl.js';
  import { name } from '../lib/entity.js';
  import { haImage, send } from '../lib/ha.svelte.js';
  let { props, w = 0, h = 0 } = $props();
  const e = $derived(ent(props.entity));
  // Just the id, so attribute updates (e.g. the rotating access token) don't restart streams.
  const camId = $derived(e?.entity_id.startsWith('camera.') ? e.entity_id : null);
  // Some cameras (e.g. Tapo) can't give Home Assistant a still picture in time,
  // so snapshots and live pictures fail. Those that can stream are switched to
  // HA's video stream (HLS, as HA's own dashboard plays it) after two failures.
  const canStream = $derived(((e?.attributes.supported_features ?? 0) & 2) === 2);
  let failed = $state(0);
  const video = $derived(!!camId && (props.mode === 'video' || (canStream && failed >= 2)));
  const live = $derived(props.mode === 'live' && !!camId && !video);
  let broken = $state(false);
  let vid = $state();
  let tick = $state(0);
  let shown = $state('');
  let ratio = $state(0);
  // Auto (also older cards saved as 'cover'): fill the card unless the picture's
  // shape is very different (e.g. a 32:9 dual-lens camera in a 2:1 card), then show it whole.
  const fit = $derived.by(() => {
    if (props.fit === 'crop') return 'cover';
    if (props.fit === 'contain') return 'contain';
    if (!ratio || !w || !h) return 'cover';
    const r = ratio / (w / h);
    return Math.max(r, 1 / r) > 1.25 ? 'contain' : 'cover';
  });
  // Snapshots: poll, double-buffered so the picture never flashes blank.
  $effect(() => {
    if (live || video) return;
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
    if (!s || live || video) return;
    const img = new Image();
    img.onload = () => { shown = s; failed = 0; };
    img.onerror = () => failed++;
    img.src = s;
    return () => (img.onload = img.onerror = null);
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
        failed = 0;
        clearTimeout(none);
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
    // No picture at all after 12 s: treat as failed (switches to video if it can).
    const none = setTimeout(() => (failed = 2), 12000);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(none);
      document.removeEventListener('visibilitychange', vis);
      if (ws) { ws.onclose = null; ws.close(); }
      if (url0) setTimeout(() => URL.revokeObjectURL(url0), 1000);
    };
  });
  // Video: ask HA for an HLS stream and play it.
  let vidErr = $state(''), playing = $state(false);
  $effect(() => {
    if (!video || !vid) return;
    const id = camId, el = vid;
    let hls, stopped = false;
    vidErr = '';
    playing = false;
    const slow = setTimeout(() => { if (!playing) vidErr = "The camera's video didn't start"; }, 45000);
    send({ type: 'camera/stream', entity_id: id }).then(async (r) => {
      if (stopped) return;
      const src = 'ha' + r.url;
      const { default: Hls } = await import('hls.js');
      if (stopped) return;
      // hls.js wherever it works; older iPhones / iPads only play HLS natively.
      if (!Hls.isSupported()) el.src = src;
      else {
        hls = new Hls({ liveSyncDurationCount: 2 });
        hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) vidErr = 'Video stream failed'; });
        hls.loadSource(src);
        hls.attachMedia(el);
      }
      el.play?.().catch(() => {});
    }).catch((err) => { if (!stopped) vidErr = err?.message || 'This camera has no video stream'; });
    return () => { stopped = true; clearTimeout(slow); hls?.destroy(); el.removeAttribute('src'); el.load?.(); };
  });
</script>

<div class="cam">
  {#if video}
    <video bind:this={vid} muted autoplay playsinline style="object-fit:{fit}" onplaying={() => (playing = true)} onloadedmetadata={(ev) => (ratio = ev.currentTarget.videoWidth / ev.currentTarget.videoHeight || 0)}></video>
    {#if vidErr}<div class="msg">{vidErr}</div>{:else if !playing}<div class="msg">Starting video…</div>{/if}
  {:else if shown}<img src={shown} alt="" style="object-fit:{fit}" class:broken onerror={() => { broken = true; failed++; }} onload={(ev) => { broken = false; ratio = ev.currentTarget.naturalWidth / ev.currentTarget.naturalHeight || 0; }} />{/if}
  {#if !video && (broken || (!shown && failed >= 2))}<div class="msg">No picture from this camera</div>{/if}
  {#if props.show_name}<div class="lbl">{t(props.name) || name(e)}</div>{/if}
</div>

<style>
  .cam { position: absolute; inset: 0; background: #000; overflow: hidden; border-radius: inherit; }
  img, video { width: 100%; height: 100%; display: block; }
  img.broken { visibility: hidden; }
  .msg { position: absolute; inset: 0; display: grid; place-items: center; color: var(--muted); font-size: .85em; padding: 12px; text-align: center; }
  .lbl { position: absolute; left: 0; right: 0; bottom: 0; padding: 18px 14px 10px; background: linear-gradient(transparent, rgba(0,0,0,.6)); font-weight: 600; font-size: .9em; }
</style>
