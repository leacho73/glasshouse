<script module>
  import { find } from '../lib/octopus.js';
  export const meta = {
    type: 'octopus-rates', name: 'Octopus rates', icon: 'mdi:chart-bar', category: 'Energy',
    size: { w: 620, h: 280 }, tap: 'none',
    defaults: { window: 'next24', cheap: 10, peak: 25, show_export: false, show_sessions: true },
    autofill: () => ({
      rates: find(/^event\.octopus_energy_electricity_.+_\d+_current_day_rates$/),
      next_rates: find(/^event\.octopus_energy_electricity_.+_\d+_next_day_rates$/),
      prev_rates: find(/^event\.octopus_energy_electricity_.+_\d+_previous_day_rates$/),
      export_rates: find(/^event\.octopus_energy_electricity_.+_export_current_day_rates$/),
      export_next: find(/^event\.octopus_energy_electricity_.+_export_next_day_rates$/),
      dispatching: find(/^binary_sensor\.octopus_energy_.+_intelligent_dispatching$/),
      saving: find(/^event\.octopus_energy_.+_octoplus_saving_session_events$/),
      powerup: find(/^event\.octopus_energy_.+_octoplus_power_up_events$/),
      free: find(/^event\.octopus_energy_.+_octoplus_free_electricity_session_events$/),
    }),
    sections: [{ key: 'now', label: 'Current rate' }, { key: 'stats', label: 'Min / avg / max' }, { key: 'cheapest', label: 'Cheapest 2h' }, { key: 'chart', label: 'Chart' }, { key: 'legend', label: 'Legend' }],
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'window', label: 'Window', type: 'select', options: [{ value: 'next24', label: 'Now → +24h' }, { value: 'today', label: 'Today' }, { value: 'both', label: 'Today + tomorrow' }] },
      { key: 'rates', label: 'Current day rates (event)', type: 'entity', domain: 'event' },
      { key: 'next_rates', label: 'Next day rates (event)', type: 'entity', domain: 'event' },
      { key: 'prev_rates', label: 'Previous day rates (event)', type: 'entity', domain: 'event' },
      { key: 'show_export', label: 'Show export rate line', type: 'bool' },
      { key: 'export_rates', label: 'Export current day rates', type: 'entity', domain: 'event' },
      { key: 'export_next', label: 'Export next day rates', type: 'entity', domain: 'event' },
      { key: 'dispatching', label: 'Intelligent dispatching', type: 'entity', domain: 'binary_sensor' },
      { key: 'show_sessions', label: 'Mark Octoplus sessions', type: 'bool' },
      { key: 'saving', label: 'Saving session events', type: 'entity', domain: 'event' },
      { key: 'powerup', label: 'Power-up events', type: 'entity', domain: 'event' },
      { key: 'free', label: 'Free electricity events', type: 'entity', domain: 'event' },
      { key: 'cap_hours', label: 'Cheap dispatch hours a day (Intelligent Octopus Go: 6)', type: 'number' },
      { key: 'cheap', label: 'Cheap below (p)', type: 'number' },
      { key: 'peak', label: 'Peak from (p)', type: 'number' },
    ],
  };
</script>

<script>
  import Icon from '../components/Icon.svelte';
  import { t } from '../lib/tpl.js';
  import { clock } from '../lib/clock.svelte.js';
  import { rates, dispatches, sessions, merge, pence, rateColor, hm, day, until, KIND } from '../lib/octopus.js';
  let { props } = $props();
  const show = (k) => !props.hide?.[k];
  let w = $state(500), h = $state(150);

  const th = $derived({ cheap: (Number(props.cheap) || 10) / 100, peak: (Number(props.peak) || 25) / 100 });
  // Intelligent Octopus prices a dispatch's half-hours at the off-peak rate, but
  // the integration only marks them a while after they're planned, often not
  // before they start. Apply planned and running dispatches here straight away.
  const raw = $derived.by(() => {
    const list = rates(props.prev_rates, props.rates, props.next_rates);
    if (!props.dispatching || !list.length) return list;
    const d = dispatches(props.dispatching);
    const periods = merge([...d.planned, ...d.completed]);
    if (!periods.length) return list;
    // The rate Octopus gives slots it has already adjusted, else the cheapest.
    const off = list.find((r) => r.adjusted)?.value ?? Math.min(...list.map((r) => r.value).filter((v) => v > 0));
    // Only the first 6 hours of dispatches between middays are cheap (as on the
    // Zappi card); after that a dispatch outside the off-peak window costs the
    // normal rate, so that's what's shown.
    const capMs = (Number(props.cap_hours) || 6) * 36e5;
    const used = new Map();
    const midday = (t) => { const d = new Date(t); if (d.getHours() < 12) d.setDate(d.getDate() - 1); d.setHours(12, 0, 0, 0); return +d; };
    return list.map((r) => {
      const ms = periods.reduce((a, q) => a + Math.max(0, Math.min(q.end, r.end) - Math.max(q.start, r.start)), 0);
      if (!ms) return r;
      const k = midday(r.start), u = used.get(k) || 0;
      used.set(k, u + ms);
      return r.value > off && u + ms <= capMs ? { ...r, value: off } : r;
    });
  });
  // Octoplus sessions change what electricity really costs: Free Electricity and
  // joined Power Ups make it free; in a joined Saving Session every kWh you use
  // also costs the reward you'd have earned (800 Octopoints = £1).
  // Back-to-back events of the same kind (e.g. two 1-hour free sessions) as one.
  // Power Ups Octopus only lists as available (often not for your region) are left out.
  const octo = $derived(sessions(props).filter((x) => x.joined || x.kind !== 'powerup').reduce((out, x) => {
    const last = out[out.length - 1];
    if (last && last.kind === x.kind && last.joined === x.joined && last.end === x.start) out[out.length - 1] = { ...last, end: x.end };
    else out.push({ ...x });
    return out;
  }, []));
  const live = $derived(octo.filter((x) => x.joined && x.kind !== 'powerdown'));
  const all = $derived(raw.map((r) => {
    const x = live.find((q) => q.start < r.end && q.end > r.start);
    if (!x) return { ...r, cost: r.value };
    if (x.kind === 'free' || x.kind === 'powerup') return { ...r, base: r.value, value: 0, cost: 0, tag: x.kind };
    return { ...r, tag: 'saving', cost: r.value + (x.perKwh || 0) / 800 };
  }));
  const exp = $derived(props.show_export ? rates(props.export_rates, props.export_next) : []);
  const now = $derived(clock.now);
  const range = $derived.by(() => {
    const d = new Date(now); d.setHours(0, 0, 0, 0);
    const mid = d.getTime();
    if (props.window === 'today') return [mid, mid + 864e5];
    if (props.window === 'both') return [mid, mid + 2 * 864e5];
    const s = Math.floor(now / 18e5) * 18e5 - 2 * 36e5;
    return [s, s + 24 * 36e5];
  });
  const slots = $derived(all.filter((r) => r.end > range[0] && r.start < range[1]));
  const cur = $derived(all.find((r) => r.start <= now && now < r.end));
  // Only a change in price counts: a Saving Session keeps the rate and has its own line.
  const nextChange = $derived(cur ? all.find((r) => r.start >= cur.end && Math.abs(r.value - cur.value) > 1e-6) : null);
  const nowSess = $derived(live.find((x) => x.start <= now && now < x.end));
  const nextSess = $derived(octo.find((x) => x.start > now && x.start - now < 2 * 864e5 && x.kind !== 'powerdown' && (x.joined || x.joinable)));
  const vals = $derived(slots.map((s) => s.value));
  const max = $derived(Math.max(0.3, ...vals, ...exp.map((e) => e.value)));
  const min = $derived(Math.min(0, ...vals));
  const avg = $derived(vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null);
  const disp = $derived(props.dispatching ? dispatches(props.dispatching) : null);
  const dispPeriods = $derived(disp ? merge([...disp.planned, ...disp.completed]).filter((d) => d.end > range[0] && d.start < range[1]) : []);
  const sess = $derived(props.show_sessions ? octo.filter((s) => s.end > range[0] && s.start < range[1]) : []);
  // Cheapest upcoming 2h window, handy for planning loads.
  const cheapest = $derived.by(() => {
    const fut = all.filter((r) => r.end > now);
    let best = null;
    for (let i = 0; i + 3 < fut.length; i++) {
      if (fut[i + 3].start - fut[i].start !== 3 * 18e5) continue;
      const v = (fut[i].cost + fut[i + 1].cost + fut[i + 2].cost + fut[i + 3].cost) / 4;
      if (!best || v < best.v) best = { v, start: fut[i].start };
    }
    return best;
  });

  const PAD = 18;
  const X = (tm) => ((tm - range[0]) / (range[1] - range[0])) * w;
  const Y = (v) => PAD + (1 - (v - min) / (max - min || 1)) * (h - PAD - 16);
  const ticks = $derived.by(() => {
    const out = [];
    const step = range[1] - range[0] > 864e5 ? 6 * 36e5 : 3 * 36e5;
    for (let tm = Math.ceil(range[0] / step) * step; tm < range[1]; tm += step) out.push(tm);
    return out;
  });
  const expPath = $derived(exp.filter((r) => r.end > range[0] && r.start < range[1]).map((r) => `M${X(r.start).toFixed(1)},${Y(r.value).toFixed(1)}H${X(r.end).toFixed(1)}`).join(''));
</script>

<div class="rates">
  <div class="head">
    {#if show('now')}<div class="now">
      <div class="lbl">{t(props.title) || 'Electricity now'}</div>
      {#if nowSess && (nowSess.kind === 'free' || nowSess.kind === 'powerup')}
        <div class="big" style="color:{KIND[nowSess.kind].color}">FREE{#if cur?.base != null}<small>normally {pence(cur.base)}</small>{/if}</div>
        <div class="sess" style="--k:{KIND[nowSess.kind].color}"><Icon icon={KIND[nowSess.kind].icon} size="1em" />{KIND[nowSess.kind].label} until {hm(nowSess.end)} <span class="dim">({until(nowSess.end, now)} left)</span></div>
      {:else}
        <div class="big" style="color:{cur ? rateColor(cur.value, th) : 'inherit'}">{cur ? pence(cur.value) : '—'}<small>/kWh</small></div>
        {#if nowSess?.kind === 'saving'}
          <div class="sess" style="--k:{KIND.saving.color}"><Icon icon={KIND.saving.icon} size="1em" /><span>Saving Session until {hm(nowSess.end)}{#if nowSess.perKwh}{' · '}earn £{(nowSess.perKwh / 800).toFixed(2)}/kWh saved{/if}</span></div>
        {:else if nextChange}<div class="sub">{nextChange.tag === 'free' || nextChange.tag === 'powerup' ? 'Free' : pence(nextChange.value)} from {hm(nextChange.start)} <span class="dim">({until(nextChange.start, now)})</span></div>{/if}
      {/if}
      {#if nextSess && !nowSess}
        <div class="next" style="--k:{KIND[nextSess.kind].color}"><Icon icon={KIND[nextSess.kind].icon} size="1em" />{KIND[nextSess.kind].label} {day(nextSess.start, now).toLowerCase()} {hm(nextSess.start)}–{hm(nextSess.end)}{#if !nextSess.joined}<span class="dim">{' · not joined'}</span>{/if}</div>
      {/if}
    </div>{:else}<div></div>{/if}
    <div class="stats">
      {#if show('stats')}
      <div><span class="dim">Min</span> {pence(Math.min(...vals))}</div>
      <div><span class="dim">Avg</span> {pence(avg)}</div>
      <div><span class="dim">Max</span> {pence(Math.max(...vals))}</div>
      {/if}
      {#if cheapest && show('cheapest')}<div class="cheap"><Icon icon="mdi:timer-sand" size="1em" /> Cheapest 2h: {day(cheapest.start, now) === 'Today' ? '' : day(cheapest.start, now) + ' '}{hm(cheapest.start)}{' · '}{cheapest.v <= 0 ? 'free' : pence(cheapest.v)}</div>{/if}
    </div>
  </div>
  {#if show('chart')}<div class="chart" bind:clientWidth={w} bind:clientHeight={h}>
    <svg width={w} height={h}>
      {#each sess as s}
        <rect x={X(s.start)} y="0" width={Math.max(2, X(s.end) - X(s.start))} height={h - 16} fill={KIND[s.kind].color} opacity=".14" />
        <rect x={X(s.start)} y="0" width={Math.max(2, X(s.end) - X(s.start))} height="4" rx="2" fill={KIND[s.kind].color} />
      {/each}
      {#each slots as s}
        {@const x = X(Math.max(s.start, range[0]))}
        {@const bw = Math.max(1, X(Math.min(s.end, range[1])) - x - 1.5)}
        {#if s.tag === 'free' || s.tag === 'powerup'}
          <!-- Free: the usual price as a ghost bar in the session colour, solid at 0p. -->
          <rect {x} y={Y(s.base)} width={bw} height={Math.max(1.5, Y(0) - Y(s.base))} rx="2" fill={KIND[s.tag].color} opacity={s.end <= now ? 0.15 : 0.3} />
          <rect {x} y={Y(0) - 4} width={bw} height="4" rx="2" fill={KIND[s.tag].color} opacity={s.end <= now ? 0.5 : 1} />
        {:else}
          <rect {x} y={Math.min(Y(s.value), Y(0))} width={bw} height={Math.max(1.5, Math.abs(Y(0) - Y(s.value)))} rx="2" fill={rateColor(s.value, th)} opacity={s.end <= now ? 0.35 : 0.9} />
        {/if}
      {/each}
      {#each dispPeriods as d}
        <rect x={X(d.start)} y={h - 22} width={Math.max(3, X(d.end) - X(d.start))} height="5" rx="2.5" fill={KIND.dispatch.color} opacity={d.end < now ? 0.5 : 1} />
      {/each}
      {#if expPath}<path d={expPath} stroke="#4fd1d9" stroke-width="2" stroke-dasharray="4 3" fill="none" />{/if}
      {#if now > range[0] && now < range[1]}<line x1={X(now)} x2={X(now)} y1="0" y2={h - 14} stroke="#fff" stroke-width="1.5" stroke-dasharray="3 3" />{/if}
      {#each ticks as tm}<text x={X(tm)} y={h - 2} font-size="10" fill="currentColor" opacity=".55" text-anchor="middle">{new Date(tm).getHours().toString().padStart(2, '0')}:00</text>{/each}
    </svg>
  </div>{/if}
  {#if show('legend')}<div class="legend">
    <span><i style="background:#5bd88f"></i>&lt;{props.cheap}p</span><span><i style="background:#ffc861"></i>mid</span><span><i style="background:#ff7a90"></i>≥{props.peak}p</span>
    {#if dispPeriods.length}<span><i style="background:{KIND.dispatch.color}"></i>dispatch</span>{/if}
    {#each [...new Set(sess.map((s) => s.kind))] as k}<span><i style="background:{KIND[k].color}"></i>{KIND[k].label}</span>{/each}
    {#if expPath}<span><i style="background:#4fd1d9"></i>export</span>{/if}
  </div>{/if}
</div>

<style>
  .rates { height: 100%; display: flex; flex-direction: column; gap: 8px; }
  .head { display: flex; justify-content: space-between; gap: 12px; }
  .lbl { color: var(--muted); font-size: .85em; }
  .big { font-size: 2.2em; font-weight: 600; line-height: 1.1; letter-spacing: -.02em; }
  .big small { font-size: .4em; color: var(--muted); font-weight: 400; margin-left: 3px; }
  .sub { font-size: .9em; }
  .sess, .next { display: flex; align-items: center; gap: 5px; font-size: .85em; font-weight: 600; color: var(--k); }
  .sess span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sess { max-width: 100%; padding: 3px 9px; border-radius: 9px; background: color-mix(in srgb, var(--k) 16%, transparent); width: fit-content; margin-top: 2px; }
  .next { font-weight: 500; margin-top: 2px; }
  .big small { white-space: nowrap; }
  .dim { color: var(--muted); }
  .stats { text-align: right; font-size: .85em; display: flex; flex-direction: column; gap: 2px; }
  .cheap { color: #5bd88f; display: flex; align-items: center; gap: 4px; justify-content: flex-end; margin-top: 4px; }
  .chart { flex: 1; min-height: 60px; position: relative; }
  svg { position: absolute; inset: 0; overflow: visible; }
  .legend { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: .75em; color: var(--muted); }
  .legend span { display: flex; align-items: center; gap: 5px; }
  .legend i { width: 9px; height: 9px; border-radius: 3px; }
</style>
