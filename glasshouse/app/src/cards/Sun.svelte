<script module>
  export const meta = {
    type: 'sun', name: 'Sunrise & sunset', icon: 'mdi:weather-sunset', category: 'Info',
    size: { w: 400, h: 240 }, tap: 'none',
    defaults: { name: 'Sun', show_twilight: true, show_length: true, show_moon: true },
    fields: [
      { key: 'name', label: 'Title', type: 'text' },
      { key: 'show_twilight', label: 'Show dawn and dusk (when there is room)', type: 'bool' },
      { key: 'show_length', label: 'Show day length (when there is room)', type: 'bool' },
      { key: 'show_moon', label: 'Show the moon: its path and phase, and moonrise / moonset when there is room', type: 'bool' },
      { key: 'hour12', label: '12-hour', type: 'bool' },
    ],
  };

  // Home Assistant's location, fetched once for every Sun card.
  import { send, conn } from '../lib/ha.svelte.js';
  const home = $state({ lat: null, lon: null, height: 0 });
  let asked = false;
  function where() {
    if (asked || !conn.connected) return;
    asked = true;
    send({ type: 'get_config' }).then((c) => Object.assign(home, { lat: c.latitude, lon: c.longitude, height: c.elevation || 0 })).catch(() => (asked = false));
  }
</script>

<script>
  import { t } from '../lib/tpl.js';
  import { clock } from '../lib/clock.svelte.js';
  import { sunDay, moonDay, moonPhase, moonName } from '../lib/sun.js';
  import Icon from '../components/Icon.svelte';
  let { props, w = 400, h = 240 } = $props();

  $effect(() => { if (conn.connected) where(); });

  const ready = $derived(home.lat != null);
  // Recompute the day only when the date changes.
  const dayStart = $derived(new Date(clock.now).setHours(0, 0, 0, 0));
  const today = $derived(ready ? sunDay(dayStart + 12 * 3600e3, home.lat, home.lon, home.height) : null);
  const yesterday = $derived(today ? sunDay(today.start - 12 * 3600e3, home.lat, home.lon, home.height) : null);
  const tomorrow = $derived(today ? sunDay(today.end + 12 * 3600e3, home.lat, home.lon, home.height) : null);

  const now = $derived(clock.now);
  // The moon: today's path, and its phase right now.
  const showMoon = $derived(props.show_moon !== false);
  const moon = $derived(ready && showMoon ? moonDay(dayStart + 12 * 3600e3, home.lat, home.lon) : null);
  const phase = $derived(ready && showMoon ? moonPhase(now) : null);
  const moonUp = $derived(moon ? (moon.pts.reduce((b, p) => (Math.abs(p[0] - now) < Math.abs(b[0] - now) ? p : b))[1] > 0) : false);
  const up = $derived(today && today.rise && today.set ? now >= today.rise && now < today.set : today?.maxElev > 0);
  // What happens next, and when.
  const next = $derived.by(() => {
    if (!today) return null;
    if (today.rise && now < today.rise) return { what: 'Sunrise', at: today.rise };
    if (today.set && now < today.set) return { what: 'Sunset', at: today.set };
    return tomorrow?.rise ? { what: 'Sunrise', at: tomorrow.rise } : null;
  });

  const tm = (x) => (x ? new Date(x).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: !!props.hour12 }) : '—');
  const dur = (ms) => {
    const m = Math.max(0, Math.round(ms / 60e3));
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  };
  const delta = $derived.by(() => {
    if (!today || !yesterday) return '';
    const s = Math.round((today.length - yesterday.length) / 1000);
    if (!s) return '';
    const a = Math.abs(s);
    return `${s > 0 ? '+' : '−'}${a >= 60 ? `${Math.floor(a / 60)}m ${a % 60}s` : `${a}s`}`;
  });

  // How much room there is decides what to show.
  const strip = $derived(h < 110);
  const tall = $derived(h >= 250 && w >= 300);
  const narrow = $derived(w < 280);
  const mini = $derived(w < 200 || (strip && w < 260));

  // The day's path: time across, elevation up, horizon about two thirds down.
  let cw = $state(300), ch = $state(120);
  const PAD = 10;
  const chart = $derived.by(() => {
    if (!today || cw < 20 || ch < 20) return null;
    const hy = Math.round(ch * (strip ? 0.82 : 0.7));
    const top = Math.max(1, today.maxElev, moon?.maxElev ?? 0), bot = Math.max(1, -today.minElev, -(moon?.minElev ?? 0));
    const X = (x) => PAD + ((x - today.start) / (today.end - today.start)) * (cw - PAD * 2);
    const Y = (e) => (e >= 0 ? hy - (e / top) * (hy - PAD) : hy + (-e / bot) * (ch - hy - 4));
    const path = today.pts.map(([x, e], i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(e).toFixed(1)}`).join('');
    const nowE = today.pts.reduce((b, p) => (Math.abs(p[0] - now) < Math.abs(b[0] - now) ? p : b))[1];
    const near = (pts) => pts.reduce((b, p) => (Math.abs(p[0] - now) < Math.abs(b[0] - now) ? p : b))[1];
    // The moon's path, split into night (sun down: easy to see) and day (a pale
    // daytime moon), so it doesn't look as if it was bright in the sky at lunchtime.
    const seg = (night) => {
      if (!moon) return '';
      let d = '', open = false;
      for (let i = 1; i < moon.pts.length; i++) {
        if (((today.pts[i]?.[1] ?? 0) < -0.833) !== night) { open = false; continue; }
        const [x0, e0] = moon.pts[i - 1], [x1, e1] = moon.pts[i];
        if (!open) d += `M${X(x0).toFixed(1)},${Y(e0).toFixed(1)}`;
        d += `L${X(x1).toFixed(1)},${Y(e1).toFixed(1)}`;
        open = true;
      }
      return d;
    };
    const mnight = seg(true), mday = seg(false);
    return { hy, path, area: `${path}L${X(today.end)},${hy}L${X(today.start)},${hy}Z`, sx: X(now), sy: Y(nowE), rx: today.rise && X(today.rise), setx: today.set && X(today.set),
      mnight, mday, my: moon ? Y(near(moon.pts)) : null };
  });
  const uid = Math.random().toString(36).slice(2, 8);
  // The lit part of the moon as a path: the bright limb, then the terminator
  // (an ellipse) back. Lit on the right while waxing (left south of the equator).
  function moonLit(cx, cy, r, f, p) {
    const right = (p < 0.5) !== (home.lat < 0);
    const rx = r * Math.abs(2 * f - 1), gib = f > 0.5;
    const s1 = right ? 1 : 0, s2 = right === gib ? 1 : 0;
    return `M${cx},${cy - r}A${r},${r} 0 0 ${s1} ${cx},${cy + r}A${rx.toFixed(2)},${r} 0 0 ${s2} ${cx},${cy - r}Z`;
  }
</script>

<div class="sun" class:strip class:tall class:narrow class:mini class:night={!up}>
  {#if !today}
    <div class="wait"><Icon icon="mdi:weather-sunset" size="1.4em" /> Waiting for Home Assistant…</div>
  {:else}
    <div class="head">
      <div class="title"><Icon icon={up ? 'mdi:white-balance-sunny' : 'mdi:weather-night'} size="1.15em" /><span>{t(props.name) || 'Sun'}</span></div>
      {#if next}<div class="next">{#if mini}<b>{next.what === 'Sunset' ? '↓' : '↑'}</b> {dur(next.at - now)}{:else}<b>{next.what}</b> in {dur(next.at - now)}{/if}</div>{/if}
    </div>

    <div class="sky" bind:clientWidth={cw} bind:clientHeight={ch}>
      {#if chart}
        <svg width={cw} height={ch} viewBox="0 0 {cw} {ch}" aria-hidden="true">
          <defs>
            <linearGradient id="day-{uid}" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stop-color="var(--sun)" stop-opacity=".45" />
              <stop offset="1" stop-color="var(--sun)" stop-opacity=".04" />
            </linearGradient>
            <clipPath id="above-{uid}"><rect x="0" y="0" width={cw} height={chart.hy} /></clipPath>
            <clipPath id="below-{uid}"><rect x="0" y={chart.hy} width={cw} height={ch - chart.hy} /></clipPath>
            <radialGradient id="glow-{uid}"><stop offset="0" stop-color="var(--sun)" stop-opacity=".55" /><stop offset="1" stop-color="var(--sun)" stop-opacity="0" /></radialGradient>
          </defs>
          <path d={chart.area} fill="url(#day-{uid})" clip-path="url(#above-{uid})" />
          <path d={chart.path} fill="none" stroke="var(--sun)" stroke-width="2" clip-path="url(#above-{uid})" />
          <path d={chart.path} fill="none" stroke="var(--muted)" stroke-opacity=".45" stroke-width="1.5" stroke-dasharray="3 4" clip-path="url(#below-{uid})" />
          <line x1="0" x2={cw} y1={chart.hy} y2={chart.hy} stroke="var(--muted)" stroke-opacity=".35" />
          {#if chart.rx}<circle cx={chart.rx} cy={chart.hy} r="2.5" fill="var(--sun)" />{/if}
          {#if chart.setx}<circle cx={chart.setx} cy={chart.hy} r="2.5" fill="var(--sun)" />{/if}
          {#if chart.mday}<path d={chart.mday} fill="none" stroke="var(--moon)" stroke-opacity=".18" stroke-width="1" stroke-dasharray="2 4" clip-path="url(#above-{uid})" />{/if}
          {#if chart.mnight}<path d={chart.mnight} fill="none" stroke="var(--moon)" stroke-opacity=".6" stroke-width="1.4" clip-path="url(#above-{uid})" />{/if}
          <!-- The moon's disc, unless it's below the horizon right where the sun is. -->
          {#if phase && chart.my != null && (moonUp || Math.abs(chart.my - chart.sy) > (strip ? 14 : 20))}
            {@const r = strip ? 5 : 7}
            <g class="moon" class:down={!moonUp}>
              {#if moonUp && !up}<circle cx={chart.sx} cy={chart.my} r={r * 2.4} fill="var(--moon)" opacity=".12" />{/if}
              <circle cx={chart.sx} cy={chart.my} r={r} fill="var(--night)" stroke="var(--moon)" stroke-opacity=".35" />
              <path d={moonLit(chart.sx, chart.my, r, phase.fraction, phase.phase)} fill="var(--moon)" />
            </g>
          {/if}
          {#if up}<circle cx={chart.sx} cy={chart.sy} r={strip ? 12 : 18} fill="url(#glow-{uid})" />{/if}
          <circle cx={chart.sx} cy={chart.sy} r={strip ? 5 : 7} fill={up ? 'var(--sun)' : 'var(--night)'} stroke={up ? 'none' : 'var(--muted)'} stroke-opacity=".6" />
        </svg>
      {/if}
    </div>

    <div class="times">
      <div class="t"><Icon icon="mdi:weather-sunset-up" size="1.1em" /><b>{tm(today.rise)}</b>{#if !strip}<small>Sunrise</small>{/if}</div>
      {#if !narrow && !strip}<div class="t mid"><b>{tm(today.noon)}</b><small>Solar noon</small></div>{/if}
      <div class="t end"><Icon icon="mdi:weather-sunset-down" size="1.1em" /><b>{tm(today.set)}</b>{#if !strip}<small>Sunset</small>{/if}</div>
    </div>

    {#if tall && moon && phase && h >= 300}
      <div class="mrow">
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="9" fill="var(--night)" stroke="var(--moon)" stroke-opacity=".35" /><path d={moonLit(11, 11, 9, phase.fraction, phase.phase)} fill="var(--moon)" /></svg>
        <div class="mn"><b>{moonName(phase.phase, phase.fraction)}</b><small>{Math.round(phase.fraction * 100)}% lit</small></div>
        <div class="mt"><small>Moonrise</small><b>{tm(moon.rise)}</b></div>
        <div class="mt"><small>Moonset</small><b>{tm(moon.set)}</b></div>
      </div>
    {/if}
    {#if tall && (props.show_twilight !== false || props.show_length !== false)}
      <div class="more">
        {#if props.show_twilight !== false}
          <div><small>Dawn</small><b>{tm(today.dawn)}</b></div>
          <div><small>Dusk</small><b>{tm(today.dusk)}</b></div>
        {/if}
        {#if props.show_length !== false}
          <div><small>Day length</small><b>{dur(today.length)}</b>{#if delta}<em class:gain={delta.startsWith('+')}>{delta}</em>{/if}</div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .sun { --sun: #ffb547; --night: #1d2333; --moon: #dfe6f5; height: 100%; display: flex; flex-direction: column; gap: 8px; min-height: 0; }
  .wait { margin: auto; color: var(--muted); display: flex; gap: 8px; align-items: center; font-size: .9em; }
  .head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; white-space: nowrap; }
  .title { display: flex; align-items: center; gap: 8px; font-weight: 600; min-width: 0; }
  .title :global(svg) { color: var(--sun); flex: none; }
  .night .title :global(svg) { color: var(--muted); }
  .title span { overflow: hidden; text-overflow: ellipsis; }
  .next { color: var(--muted); font-size: .85em; }
  .next b { color: var(--text); font-weight: 600; }
  .sky { flex: 1; min-height: 0; position: relative; margin: 0 -6px; }
  .sky svg { position: absolute; inset: 0; display: block; overflow: visible; }
  .times { display: flex; justify-content: space-between; align-items: flex-end; gap: 8px; }
  .t { display: grid; grid-template-columns: auto auto; column-gap: 6px; align-items: center; font-variant-numeric: tabular-nums; }
  .t :global(svg) { color: var(--sun); grid-row: span 2; }
  .t b { font-size: 1.15em; font-weight: 600; line-height: 1.1; }
  .t small { grid-column: 2; color: var(--muted); font-size: .72em; }
  .t.mid { grid-template-columns: auto; text-align: center; }
  .t.mid small { grid-column: 1; }
  .t.end { text-align: right; }
  .more { display: flex; justify-content: space-between; gap: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,.07); font-variant-numeric: tabular-nums; }
  .more div { display: flex; flex-direction: column; gap: 1px; }
  .more div:last-child { text-align: right; }
  .more small { color: var(--muted); font-size: .72em; }
  .more b { font-weight: 600; }
  .more em { font-style: normal; font-size: .72em; color: var(--muted); }
  .more em.gain { color: #5bd88f; }
  .moon.down { opacity: .4; }
  .mrow { display: flex; align-items: center; gap: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,.07); font-variant-numeric: tabular-nums; }
  .mrow svg { flex: none; }
  .mn { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .mn b, .mt b { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mn small, .mt small { color: var(--muted); font-size: .72em; }
  .mt { display: flex; flex-direction: column; text-align: right; }

  /* Thin strip: title and countdown on one line, a small path, times either side. */
  .strip { display: grid; grid-template-columns: auto 1fr auto; grid-template-rows: auto 1fr; column-gap: 12px; row-gap: 0; }
  .strip .head { grid-column: 2; grid-row: 1; justify-content: center; }
  .strip:not(.mini) .title { display: none; }
  .strip .times { display: contents; }
  .strip .t:first-child { grid-column: 1; grid-row: 1 / 3; align-self: center; }
  .strip .t.end { grid-column: 3; grid-row: 1 / 3; align-self: center; }
  .strip .sky { grid-column: 2; grid-row: 2; margin: 0; }
  .strip .t b { font-size: 1em; }
  /* Very small: just the icon and countdown on top, plain times below. */
  .mini .title span { display: none; }
  .mini.strip { grid-template-columns: auto auto; grid-template-rows: auto auto; justify-content: space-between; align-content: center; row-gap: 6px; }
  .mini.strip .head { grid-column: 1 / -1; justify-content: space-between; }
  .mini.strip .t:first-child { grid-row: 2; }
  .mini.strip .t.end { grid-row: 2; }
  .mini.strip .sky { display: none; }
  .mini.strip .t.end { grid-column: 2; }
  .mini.strip .t :global(svg) { display: none; }
</style>
