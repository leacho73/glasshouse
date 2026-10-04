<script module>
  import { find } from '../lib/octopus.js';
  const first = (...res) => { for (const re of res) { const id = find(re); if (id) return id; } return ''; };
  export const meta = {
    type: 'solar', name: 'Solar', icon: 'mdi:solar-power-variant', category: 'Energy',
    size: { w: 440, h: 300 }, tap: 'none', hold: 'more-info',
    defaults: { name: 'Solar', capacity: '' },
    sections: [
      { key: 'now', label: 'Generating now' }, { key: 'vs', label: 'Above / below forecast' }, { key: 'today', label: 'Today vs forecast' },
      { key: 'chart', label: "Today's curve" }, { key: 'split', label: 'Where it’s going' }, { key: 'tomorrow', label: 'Tomorrow' }, { key: 'week', label: 'Next days' },
    ],
    // SolarEdge / generic names for the readings; Solcast or Forecast.Solar for the forecast.
    autofill: () => ({
      power: first(/^sensor\.solar_panel_production_w$/, /^sensor\.solaredge_(i\d_)?ac_power$/, /^sensor\.solar_production_w$/, /^sensor\.[a-z0-9_]*(pv|solar)_power$/),
      today: first(/^sensor\.solar_panel_production_daily$/, /^sensor\.[a-z0-9_]*(pv|solar)_(energy|production|generation)_(today|daily)$/),
      forecast: first(/^sensor\.solcast_pv_forecast_forecast_today$/, /^sensor\.energy_production_today(_\d+)?$/),
      remaining: first(/^sensor\.solcast_pv_forecast_forecast_remaining_today$/, /^sensor\.energy_production_today_remaining(_\d+)?$/),
      tomorrow: first(/^sensor\.solcast_pv_forecast_forecast_tomorrow$/, /^sensor\.energy_production_tomorrow(_\d+)?$/),
      to_house: first(/^sensor\.solar_panel_to_house_w$/),
      to_battery: first(/^sensor\.solar_panel_to_battery_w$/),
      to_grid: first(/^sensor\.solar_panel_to_grid_w$/),
    }),
    // Solcast's next-days sensors sit beside "forecast today".
    watch: (p) => { const b = String(p.forecast || '').match(/^(sensor\.solcast_.*_forecast)_today$/)?.[1]; return b ? [3, 4, 5, 6, 7].map((d) => `${b}_day_${d}`) : []; },
    fields: [
      { key: 'name', label: 'Title', type: 'text' },
      { key: 'power', label: 'Solar power now (W / kW)', type: 'entity', domain: 'sensor', section: 'now' },
      { key: 'capacity', label: 'System size in kWp (optional, for the "% of capacity" figure)', type: 'number', section: 'now' },
      { key: 'today', label: 'Generated today (kWh)', type: 'entity', domain: 'sensor', section: 'today' },
      { key: 'forecast', label: "Today's forecast (kWh) — Solcast also gives the curve", type: 'entity', domain: 'sensor', section: 'today' },
      { key: 'remaining', label: 'Forecast remaining today (kWh)', type: 'entity', domain: 'sensor', section: 'today' },
      { key: 'tomorrow', label: "Tomorrow's forecast (kWh)", type: 'entity', domain: 'sensor', section: 'tomorrow' },
      { key: 'to_house', label: 'Solar to house (W)', type: 'entity', domain: 'sensor', section: 'split' },
      { key: 'to_battery', label: 'Solar to battery (W)', type: 'entity', domain: 'sensor', section: 'split' },
      { key: 'to_grid', label: 'Solar to grid / export (W)', type: 'entity', domain: 'sensor', section: 'split' },
    ],
  };
</script>

<script>
  // Solar: what the panels are making now, today's curve against the forecast,
  // where the power is going, and what's forecast for tomorrow and the week.
  import Icon from '../components/Icon.svelte';
  import { t, ent } from '../lib/tpl.js';
  import { states } from '../lib/ha.svelte.js';
  import { clock } from '../lib/clock.svelte.js';
  import { useHistory } from '../lib/history.svelte.js';
  let { props, w = 440, h = 300 } = $props();
  const show = (k) => !props.hide?.[k];

  // Readings in kW / kWh whatever the sensor's unit.
  const unit = (e) => (e?.attributes.unit_of_measurement || '').toLowerCase();
  const kw = (id) => { const e = ent(id); const v = Number(e?.state); if (!Number.isFinite(v)) return null; return unit(e) === 'w' || unit(e) === '' ? v / 1000 : unit(e) === 'mw' ? v * 1000 : v; };
  const kwh = (id) => { const e = ent(id); const v = Number(e?.state); if (!Number.isFinite(v)) return null; return unit(e) === 'wh' ? v / 1000 : unit(e) === 'mwh' ? v * 1000 : v; };

  const now = $derived(kw(props.power));
  const today = $derived(kwh(props.today));
  const fcEnt = $derived(ent(props.forecast));
  const forecast = $derived(kwh(props.forecast));
  const remaining = $derived(kwh(props.remaining));
  const tomorrow = $derived(kwh(props.tomorrow));
  const cap = $derived(Number(props.capacity) || null);

  // Solcast's half-hourly forecast for today (kW), if the forecast sensor has it.
  const curve = $derived((fcEnt?.attributes.detailedForecast || []).map((p) => ({ t: Date.parse(p.period_start), kw: p.pv_estimate, lo: p.pv_estimate10 ?? p.pv_estimate, hi: p.pv_estimate90 ?? p.pv_estimate })).filter((p) => Number.isFinite(p.t)));
  const peak = $derived(curve.reduce((b, p) => (!b || p.kw > b.kw ? p : b), null));
  // Forecast energy up to now, to say whether today is beating it.
  const soFar = $derived.by(() => {
    if (!curve.length) return null;
    const n = clock.now;
    return curve.reduce((s, p) => s + p.kw * Math.max(0, Math.min(1800e3, n - p.t)) / 3600e3, 0);
  });
  const vs = $derived(soFar != null && today != null && soFar > 0.2 ? today / soFar - 1 : null);

  // Today's actual output since midnight, averaged into 10-minute steps.
  const dayStart = $derived(new Date(clock.now).setHours(0, 0, 0, 0));
  const hours = $derived(Math.max(1, Math.ceil((clock.now - dayStart) / 3600e3)));
  const hist = useHistory(() => (show('chart') && props.power ? [props.power] : []), () => hours);
  const actual = $derived.by(() => {
    const pts = hist.series[props.power] || [];
    const div = unit(ent(props.power)) === 'kw' ? 1 : 1000;
    const step = 600e3, out = new Map();
    for (const [x, v] of pts) {
      if (x < dayStart) continue;
      const k = Math.floor(x / step) * step;
      const b = out.get(k) || [0, 0];
      out.set(k, [b[0] + v / div, b[1] + 1]);
    }
    return [...out].sort((a, b) => a[0] - b[0]).map(([x, [s, c]]) => [x + step / 2, Math.max(0, s / c)]);
  });

  // Where the solar is going right now.
  const split = $derived.by(() => {
    const parts = [['House', kw(props.to_house), '#7aa2ff'], ['Battery', kw(props.to_battery), '#5bd88f'], ['Export', kw(props.to_grid), '#c792ff']].filter((p) => p[1] != null && p[1] > 0.005);
    const sum = parts.reduce((s, p) => s + p[1], 0);
    return sum > 0.01 ? parts.map(([n, v, c]) => ({ n, v, c, f: v / sum })) : [];
  });

  // The next few days from Solcast (forecast_day_3 … _7).
  const week = $derived.by(() => {
    const base = props.forecast?.match(/^(sensor\.solcast_.*_forecast)_today$/)?.[1];
    if (!base) return [];
    const out = [];
    for (let d = 3; d <= 7; d++) {
      const e = states.get(`${base}_day_${d}`);
      const v = Number(e?.state);
      if (Number.isFinite(v)) out.push({ day: e.attributes.dayname?.slice(0, 3) || new Date(dayStart + (d - 1) * 864e5).toLocaleDateString([], { weekday: 'short' }), v });
    }
    return out;
  });

  const fmtP = (v) => (v == null ? '—' : v < 1 ? `${Math.round(v * 1000)}` : v.toFixed(v < 10 ? 2 : 1));
  const pUnit = (v) => (v != null && v < 1 ? 'W' : 'kW');
  const f1 = (v) => (v == null ? '—' : v.toFixed(1));
  const tm = (x) => new Date(x).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // How much room there is decides what to show.
  const strip = $derived(h < 130);
  const tall = $derived(h >= 330);
  const wide = $derived(w >= 560 && !strip);
  const narrow = $derived(w < 360);
  const compact = $derived(w < 480);

  // Chart over the daylight part of the day.
  let cw = $state(300), ch = $state(100);
  const chart = $derived.by(() => {
    if (cw < 40 || ch < 30) return null;
    const lit = curve.filter((p) => p.kw > 0.01);
    const t0 = lit.length ? lit[0].t - 1800e3 : dayStart + 5 * 3600e3;
    const t1 = lit.length ? lit[lit.length - 1].t + 3600e3 : dayStart + 21 * 3600e3;
    const top = Math.max(0.5, ...curve.map((p) => p.hi), ...actual.map((p) => p[1]), cap || 0) * 1.08;
    const X = (x) => ((x - t0) / (t1 - t0)) * cw;
    const base = ch - 14; // room for the hour labels underneath
    const Y = (v) => base - (v / top) * (base - 6);
    const seen = curve.filter((p) => p.t + 900e3 >= t0 && p.t + 900e3 <= t1);
    const line = (pts) => pts.map(([x, v], i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(v).toFixed(1)}`).join('');
    const mid = seen.map((p) => [p.t + 900e3, p.kw]);
    const band = seen.length ? line(seen.map((p) => [p.t + 900e3, p.hi])) + seen.slice().reverse().map((p) => `L${X(p.t + 900e3).toFixed(1)},${Y(p.lo).toFixed(1)}`).join('') + 'Z' : '';
    const act = actual.filter(([x]) => x >= t0 && x <= t1);
    const area = act.length > 1 ? `${line(act)}L${X(act[act.length - 1][0]).toFixed(1)},${base}L${X(act[0][0]).toFixed(1)},${base}Z` : '';
    const ticks = [];
    for (let hr = Math.ceil((t0 - dayStart) / 3600e3 / 3) * 3; dayStart + hr * 3600e3 < t1; hr += 3) ticks.push({ x: X(dayStart + hr * 3600e3), l: String(hr).padStart(2, '0') });
    return { base, fc: line(mid), band, area, act: act.length > 1 ? line(act) : '', nx: clock.now > t0 && clock.now < t1 ? X(clock.now) : null, ticks };
  });
</script>

<div class="sol" class:strip class:tall class:wide class:narrow>
  <div class="head">
    <span class="title"><Icon icon="mdi:solar-power-variant" size="1.1em" />{t(props.name) || 'Solar'}</span>
    {#if show('vs') && vs != null && !strip}
      <span class="chip" class:up={vs >= 0}>{vs >= 0 ? '▲' : '▼'} {Math.abs(Math.round(vs * 100))}%{narrow ? '' : vs >= 0 ? ' above forecast' : ' below forecast'}</span>
    {/if}
  </div>

  <div class="top">
    {#if show('now')}
      <div class="now">
        <div class="big" class:off={!now}>{fmtP(now)}<small>{pUnit(now)}</small></div>
        {#if !strip}
          <div class="dim">
            {#if cap && now != null}{Math.round((now / cap) * 100)}% of {cap} kWp{:else}generating now{/if}{#if peak && peak.kw > 0.05 && !compact}{' · '}peak {peak.kw.toFixed(1)} kW at {tm(peak.t + 900e3)}{/if}
          </div>
        {/if}
      </div>
    {/if}
    {#if show('today')}
      <div class="today">
        <div class="tv"><b>{f1(today)}</b>{#if forecast != null}<span>&nbsp;/ {f1(forecast)} kWh</span>{:else}<span>&nbsp;kWh today</span>{/if}</div>
        {#if forecast}<div class="bar"><i style="width:{Math.min(100, ((today || 0) / forecast) * 100)}%"></i></div>{/if}
        {#if !strip}<div class="dim">{#if remaining != null && compact}{f1(remaining)} to come{:else}{forecast != null ? 'today vs forecast' : 'generated today'}{#if remaining != null}{' · '}{f1(remaining)} to come{/if}{/if}</div>{/if}
      </div>
    {/if}
  </div>

  {#if show('chart') && !strip}
    <div class="chart" bind:clientWidth={cw} bind:clientHeight={ch}>
      {#if chart}
        <svg width={cw} height={ch} aria-hidden="true">
          {#if chart.band}<path d={chart.band} fill="var(--fc)" fill-opacity=".1" />{/if}
          {#if chart.area}<path d={chart.area} fill="var(--solar)" fill-opacity=".28" />{/if}
          {#if chart.act}<path d={chart.act} fill="none" stroke="var(--solar)" stroke-width="2" stroke-linejoin="round" />{/if}
          {#if chart.fc}<path d={chart.fc} fill="none" stroke="var(--fc)" stroke-opacity=".75" stroke-width="1.5" stroke-dasharray="4 4" />{/if}
          {#if chart.nx != null}<line x1={chart.nx} x2={chart.nx} y1="0" y2={chart.base} stroke="var(--muted)" stroke-opacity=".5" stroke-dasharray="2 3" />{/if}
          <line x1="0" x2={cw} y1={chart.base} y2={chart.base} stroke="var(--muted)" stroke-opacity=".25" />
          {#each chart.ticks as tk}<text x={tk.x} y={ch - 2} text-anchor="middle">{tk.l}</text>{/each}
        </svg>
        {#if curve.length && ch >= 70}<div class="key"><span><i class="a"></i>actual</span><span><i class="f"></i>forecast</span></div>{/if}
      {/if}
    </div>
  {/if}

  {#if !strip && ((show('split') && split.length && h >= 260) || (show('tomorrow') && tomorrow != null))}
    <div class="foot">
      {#if show('split') && split.length && h >= 260}
        <div class="split">
          <div class="sbar">{#each split as p}<i style="flex:{p.f};background:{p.c}"></i>{/each}</div>
          <div class="slab">{#each split as p}<span><i style="background:{p.c}"></i>{p.n} {fmtP(p.v)}{pUnit(p.v)}</span>{/each}</div>
        </div>
      {/if}
      {#if show('tomorrow') && tomorrow != null}
        <div class="tom"><small>Tomorrow</small><b>{f1(tomorrow)} <span>kWh</span></b></div>
      {/if}
    </div>
  {/if}

  {#if tall && show('week') && week.length}
    {@const max = Math.max(...week.map((d) => d.v), tomorrow || 0, 0.1)}
    <div class="week">
      {#each week as d}<div class="day"><div class="col"><i style="height:{(d.v / max) * 100}%"></i></div><b>{f1(d.v)}</b><small>{d.day}</small></div>{/each}
    </div>
  {/if}
</div>

<style>
  .sol { --solar: #ffc247; --fc: #e9edf5; height: 100%; display: flex; flex-direction: column; gap: 10px; min-height: 0; }
  .head { display: flex; justify-content: space-between; align-items: center; gap: 8px; white-space: nowrap; }
  .title { display: flex; align-items: center; gap: 7px; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .title :global(svg) { color: var(--solar); flex: none; }
  .chip { font-size: .72em; font-weight: 600; padding: 3px 9px; border-radius: 10px; background: rgba(255,122,144,.14); color: #ff7a90; }
  .chip.up { background: rgba(91,216,143,.14); color: #5bd88f; }
  .top { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
  .now { min-width: 0; }
  .big { font-size: 2.3em; font-weight: 600; letter-spacing: -.02em; line-height: 1; color: var(--solar); font-variant-numeric: tabular-nums; }
  .big.off { color: var(--muted); }
  .big small { font-size: .42em; margin-left: .15em; color: var(--muted); font-weight: 500; }
  .dim { color: var(--muted); font-size: .78em; margin-top: 4px; }
  .today { text-align: right; min-width: 0; font-variant-numeric: tabular-nums; }
  .tv b { font-size: 1.3em; font-weight: 600; }
  .tv span { color: var(--muted); font-size: .85em; }
  .bar { height: 5px; border-radius: 3px; background: rgba(255,255,255,.08); margin-top: 6px; min-width: 110px; overflow: hidden; }
  .bar i { display: block; height: 100%; background: var(--solar); border-radius: 3px; }
  .chart { flex: 1; min-height: 40px; position: relative; }
  .chart svg { position: absolute; inset: 0; display: block; overflow: visible; }
  .chart text { font-size: 9px; fill: var(--muted); }
  .key { position: absolute; top: 0; right: 0; display: flex; gap: 10px; font-size: .68em; color: var(--muted); }
  .key span { display: inline-flex; align-items: center; gap: 4px; }
  .key i { width: 12px; height: 0; border-top: 2px solid var(--solar); }
  .key i.f { border-top: 2px dashed var(--fc); opacity: .75; }
  .foot { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
  .split { flex: 1; min-width: 0; }
  .sbar { display: flex; height: 6px; border-radius: 3px; overflow: hidden; gap: 2px; }
  .sbar i { min-width: 3px; }
  .slab { display: flex; flex-wrap: wrap; gap: 2px 10px; margin-top: 5px; font-size: .72em; color: var(--muted); }
  .slab span { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
  .slab i { width: 7px; height: 7px; border-radius: 50%; }
  .tom { text-align: right; white-space: nowrap; margin-left: auto; }
  .tom small { display: block; color: var(--muted); font-size: .72em; }
  .tom b { font-weight: 600; font-size: 1.1em; }
  .tom span { color: var(--muted); font-size: .75em; font-weight: 500; }
  .week { display: flex; gap: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,.07); }
  .day { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; font-variant-numeric: tabular-nums; }
  .col { height: 34px; width: 100%; max-width: 26px; display: flex; align-items: flex-end; }
  .col i { width: 100%; border-radius: 4px 4px 2px 2px; background: color-mix(in srgb, var(--solar) 55%, transparent); min-height: 2px; }
  .day b { font-size: .78em; font-weight: 600; }
  .day small { font-size: .68em; color: var(--muted); }

  /* Thin strip: the live figure and today's total side by side. */
  .strip { gap: 4px; justify-content: center; }
  .strip .big { font-size: 1.8em; }
  .strip .top { align-items: center; }
  .narrow .big { font-size: 1.9em; }
  .narrow .bar { min-width: 70px; }
  .narrow .top { gap: 10px; }
</style>
