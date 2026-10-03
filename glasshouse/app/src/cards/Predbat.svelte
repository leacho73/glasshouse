<script module>
  import { find } from '../lib/octopus.js';
  export const meta = {
    type: 'predbat', name: 'Predbat', icon: 'mdi:battery-sync', category: 'Energy',
    size: { w: 440, h: 420 }, tap: 'none',
    defaults: { hide: { summary: true } },
    autofill: () => ({
      status: find(/^predbat\.status$/),
      plan: find(/^predbat\.plan_html$/),
      cost_today: find(/^predbat\.cost_today$/),
      savings: find(/^predbat\.savings_yesterday_pvbat$/),
      mode: find(/^select\.predbat_mode$/),
      manual_charge: find(/^select\.predbat_manual_charge$/),
      manual_export: find(/^select\.predbat_manual_export$/),
      manual_hold: find(/^select\.predbat_manual_freeze_charge$/),
    }),
    sections: [
      { key: 'status', label: 'Status' }, { key: 'kpis', label: 'Totals' }, { key: 'chart', label: 'Plan chart' }, { key: 'rates', label: 'Rate strip' },
      { key: 'car', label: 'Car charging' }, { key: 'slots', label: 'Upcoming slots' }, { key: 'summary', label: 'Plan summary' },
      { key: 'mode', label: 'Mode' }, { key: 'manual', label: 'Charge / export / hold now' },
    ],
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'status', label: 'Status (predbat.status)', type: 'entity', section: 'status' },
      { key: 'plan', label: 'Plan (predbat.plan_html)', type: 'entity', section: 'chart' },
      { key: 'cost_today', label: 'Cost today (predbat.cost_today)', type: 'entity', section: 'kpis' },
      { key: 'savings', label: 'Saved yesterday (predbat.savings_yesterday_pvbat)', type: 'entity', section: 'kpis' },
      { key: 'mode', label: 'Predbat mode', type: 'entity', domain: 'select', section: 'mode' },
      { key: 'manual_charge', label: 'Manual force charge', type: 'entity', domain: 'select', section: 'manual' },
      { key: 'manual_export', label: 'Manual force export', type: 'entity', domain: 'select', section: 'manual' },
      { key: 'manual_hold', label: 'Manual freeze charge (hold)', type: 'entity', domain: 'select', section: 'manual' },
    ],
  };
</script>

<script>
  // Predbat: what the battery is doing now, the plan for the next day (charge /
  // export / hold slots with predicted battery %, rates and car charging), costs
  // and quick manual overrides for the current half-hour.
  import Icon from '../components/Icon.svelte';
  import { t, ent } from '../lib/tpl.js';
  import { clock } from '../lib/clock.svelte.js';
  import { callService } from '../lib/ha.svelte.js';
  import { hm, day, until } from '../lib/octopus.js';
  let { props } = $props();
  const show = (k) => !props.hide?.[k];
  const now = $derived(clock.now);

  const KINDS = {
    charge: { label: 'Charge', icon: 'mdi:battery-charging', color: '#3aee85' },
    export: { label: 'Export', icon: 'mdi:transmission-tower-export', color: '#ffd24a' },
    hold: { label: 'Hold', icon: 'mdi:battery-lock', color: '#7aa2ff' },
    demand: { label: 'Demand', icon: 'mdi:home-lightning-bolt', color: '#8a94a8' },
  };
  const kindOf = (s = '') => (/exp/i.test(s) ? 'export' : /frz|freeze|hold/i.test(s) ? 'hold' : /chrg|charg/i.test(s) ? 'charge' : 'demand');

  const raw = $derived(ent(props.plan)?.attributes.raw);
  const rows = $derived.by(() => {
    const r = raw?.rows || [];
    return r.map((x, i) => {
      const start = Date.parse(x.time);
      const end = i + 1 < r.length ? Date.parse(r[i + 1].time) : start + 30 * 60e3;
      const soc2 = i + 1 < r.length ? r[i + 1].soc_percent : raw.totals?.soc_percent ?? x.soc_percent;
      return { start, end, kind: kindOf(x.state), soc: Number(x.soc_percent) || 0, soc2: Number(soc2) || 0, limit: x.show_limit, imp: x.import_rate, exp: x.export_rate, rateColor: x.rate_color_import, car: Number(x.car_charging) || 0 };
    }).filter((x) => Number.isFinite(x.start));
  });
  const t0 = $derived(rows[0]?.start ?? now);
  const t1 = $derived(rows.length ? rows[rows.length - 1].end : now + 864e5);
  const cur = $derived(rows.find((r) => r.start <= now && r.end > now) || rows[0]);

  // Consecutive slots of the same kind merged into windows.
  const windows = $derived.by(() => {
    const out = [];
    for (const r of rows) {
      const last = out[out.length - 1];
      if (last && last.kind === r.kind && last.end === r.start) { last.end = r.end; last.soc2 = r.soc2; last.rates.push(r.kind === 'export' ? r.exp : r.imp); last.car += r.car; }
      else out.push({ kind: r.kind, start: r.start, end: r.end, soc: r.soc, soc2: r.soc2, rates: [r.kind === 'export' ? r.exp : r.imp], car: r.car });
    }
    return out;
  });
  const upcoming = $derived(windows.filter((w) => w.kind !== 'demand' && w.end > now).slice(0, 4));
  const avg = (a) => a.reduce((x, y) => x + Number(y || 0), 0) / (a.length || 1);

  const st = $derived(ent(props.status));
  const error = $derived(st?.attributes.error === true || /error/i.test(st?.state || ''));
  const kind = $derived(cur?.kind || kindOf(st?.state));
  const K = $derived(KINDS[kind]);
  const socNow = $derived(raw?.soc_max ? Math.round((raw.soc / raw.soc_max) * 100) : cur?.soc);
  const pounds = (p) => (p == null || !Number.isFinite(Number(p)) ? '—' : `£${(Number(p) / 100).toFixed(2)}`);
  const cost = $derived(ent(props.cost_today)?.state);
  const saved = $derived(ent(props.savings)?.state);
  const summary = $derived.by(() => {
    const h = ent(props.plan)?.attributes.text || '';
    const d = document.createElement('div');
    return [...h.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => { d.innerHTML = m[1]; return d.textContent.trim(); }).filter(Boolean);
  });

  // Chart geometry (viewBox units; the SVG stretches to the card width).
  const W = 400, H = 90, RH = 6;
  const X = (t) => ((t - t0) / (t1 - t0 || 1)) * W;
  const Y = (v) => 4 + (1 - v / 100) * (H - 8);
  const socPath = $derived.by(() => {
    if (!rows.length) return '';
    let d = `M${X(rows[0].start).toFixed(1)},${Y(rows[0].soc).toFixed(1)}`;
    for (const r of rows) d += `L${X(r.end).toFixed(1)},${Y(r.soc2).toFixed(1)}`;
    return d;
  });
  const ticks = $derived.by(() => {
    const out = [];
    const step = 6 * 3600e3;
    for (let x = Math.ceil(t0 / step) * step; x < t1; x += step) out.push(x);
    return out;
  });
  const uid = Math.random().toString(36).slice(2, 8);

  // Manual overrides: Predbat's selects list half-hour slots; picking one adds it,
  // picking it again (shown as "[slot]") removes it.
  function manual(id) {
    const e = ent(id);
    if (!e) return null;
    const opts = e.attributes.options || [];
    const slot = (opts.find((o) => o !== 'off') || '').replace(/^\[|\]$/g, '');
    const on = !!slot && (opts.includes(`[${slot}]`) || String(e.state).includes(slot));
    return { e, slot, on, opts };
  }
  function flip(m) {
    if (!m?.slot) return;
    const option = m.on ? (m.opts.includes(`[${m.slot}]`) ? `[${m.slot}]` : 'off') : m.slot;
    callService('select', 'select_option', { option }, { entity_id: m.e.entity_id });
  }
  const manuals = $derived([
    ['charge', manual(props.manual_charge)],
    ['export', manual(props.manual_export)],
    ['hold', manual(props.manual_hold)],
  ].filter(([, m]) => m));
  const modeE = $derived(ent(props.mode));
</script>

<div class="pb" style="--c:{K.color}">
  <div class="head">
    <span class="ic" class:on={kind !== 'demand'} class:err={error}><Icon icon={error ? 'mdi:alert' : K.icon} size="1.5em" /></span>
    <div class="t">
      <div class="title">{t(props.title) || 'Predbat'}</div>
      {#if show('status')}
        <div class="st" class:err={error}>
          {st?.state || K.label}{#if st?.attributes.detail}{' · '}{st.attributes.detail}{/if}
          {#if cur && kind !== 'demand'}{' · until '}{hm(windows.find((w) => w.start <= now && w.end > now)?.end ?? cur.end)}{/if}
        </div>
      {/if}
    </div>
    {#if socNow != null}<div class="soc">{socNow}<small>%</small></div>{/if}
  </div>

  {#if show('kpis')}
    <div class="kpis">
      {#if props.cost_today}<div><b>{pounds(cost)}</b><span>cost today</span></div>{/if}
      {#if raw?.totals?.total_cost != null}<div><b>£{Number(raw.totals.total_cost).toFixed(2)}</b><span>rest of plan</span></div>{/if}
      {#if props.savings}<div><b class:neg={Number(saved) < 0}>{pounds(saved)}</b><span>saved yesterday</span></div>{/if}
    </div>
  {/if}

  {#if show('chart') && rows.length}
    <div class="chart">
      <svg viewBox="0 0 {W} {H + (show('rates') ? RH + 2 : 0)}" preserveAspectRatio="none">
        <defs><linearGradient id="soc{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22" /><stop offset="1" stop-color="#fff" stop-opacity="0" /></linearGradient></defs>
        {#each windows as w}
          {#if w.kind !== 'demand'}<rect x={X(w.start)} y="0" width={Math.max(0.5, X(w.end) - X(w.start))} height={H} style="fill:{KINDS[w.kind].color};opacity:.24" />{/if}
        {/each}
        {#each rows as r}
          {#if show('car') && r.car > 0}<rect x={X(r.start)} y="0" width={Math.max(0.5, X(r.end) - X(r.start))} height="3" style="fill:#4fb4ff" />{/if}
          {#if show('rates')}<rect x={X(r.start)} y={H + 2} width={Math.max(0.5, X(r.end) - X(r.start))} height={RH} style="fill:{r.rateColor || '#555'};opacity:.85" />{/if}
        {/each}
        <path d="{socPath}L{X(t1)},{H}L{X(t0)},{H}Z" fill="url(#soc{uid})" />
        <path d={socPath} fill="none" style="stroke:#fff;stroke-width:1.6;vector-effect:non-scaling-stroke" />
        {#if now >= t0 && now <= t1}<line x1={X(now)} x2={X(now)} y1="0" y2={H} style="stroke:var(--accent);stroke-width:1.5;vector-effect:non-scaling-stroke" />{/if}
      </svg>
      <div class="ticks">{#each ticks as x}<span style="left:{(X(x) / W) * 100}%">{hm(x)}</span>{/each}</div>
    </div>
  {/if}

  {#if show('slots')}
    <div class="slots">
      {#each upcoming as w}
        {@const k = KINDS[w.kind]}
        <div class="slot" class:now={w.start <= now} style="--k:{k.color}">
          <Icon icon={k.icon} size="1.1em" />
          <span class="what">{k.label}</span>
          <span class="when">{day(w.start, now) === 'Today' ? '' : day(w.start, now) + ' '}{hm(w.start)}–{hm(w.end)}</span>
          <span class="dim">{w.soc}→{w.soc2}%{' · '}{avg(w.rates).toFixed(1)}p{#if show('car') && w.car > 0.05}{' · '}<Icon icon="mdi:car-electric" size="1em" />{w.car.toFixed(1)}{/if}</span>
          {#if w.start > now}<span class="in">in {until(w.start, now)}</span>{/if}
        </div>
      {:else}
        {#if raw}<div class="dim">No charge or export planned.</div>{/if}
      {/each}
    </div>
  {/if}

  {#if show('summary') && summary.length}
    <ul class="sum">{#each summary as s}<li>{s}</li>{/each}</ul>
  {/if}

  {#if (show('mode') && modeE) || (show('manual') && manuals.length)}
    <div class="ctl" data-stop>
      {#if show('manual')}
        {#each manuals as [k, m]}
          <button class:on={m.on} style="--k:{KINDS[k].color}" title="{m.on ? 'Cancel' : 'Force'} {KINDS[k].label.toLowerCase()} for {m.slot}" onclick={() => flip(m)}>
            <Icon icon={KINDS[k].icon} size="1.1em" />{KINDS[k].label}
          </button>
        {/each}
      {/if}
      {#if show('mode') && modeE}
        <select value={modeE.state} onchange={(e) => callService('select', 'select_option', { option: e.currentTarget.value }, { entity_id: modeE.entity_id })}>
          {#each modeE.attributes.options || [] as o}<option value={o}>{o}</option>{/each}
        </select>
      {/if}
    </div>
  {/if}
</div>

<style>
  .pb { height: 100%; display: flex; flex-direction: column; gap: 10px; }
  .head { display: flex; align-items: center; gap: 12px; }
  .ic { width: 2.75em; height: 2.75em; border-radius: 50%; display: grid; place-items: center; background: rgba(255,255,255,.07); color: var(--muted); flex: none; }
  .ic.on { background: color-mix(in srgb, var(--c) 28%, transparent); color: var(--c); animation: glow 2s infinite; }
  .ic.err { background: rgba(255,90,110,.25); color: #ff7a90; animation: none; }
  @keyframes glow { 50% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--c) 18%, transparent); } }
  .t { flex: 1; min-width: 0; }
  .title { font-weight: 600; }
  .st { color: var(--muted); font-size: .85em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .st.err { color: #ff7a90; }
  .soc { font-size: 1.6em; font-weight: 600; letter-spacing: -.02em; }
  .soc small { font-size: .5em; color: var(--muted); }
  .kpis { display: flex; gap: 8px; }
  .kpis div { flex: 1; min-width: 0; background: rgba(255,255,255,.05); border-radius: 12px; padding: 7px 10px; display: flex; flex-direction: column; }
  .kpis b { font-size: 1.2em; }
  .kpis b.neg { color: #ff7a90; }
  .kpis span { font-size: .72em; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .chart { position: relative; flex: 1 1 70px; min-height: 60px; max-height: 140px; display: flex; flex-direction: column; }
  .chart svg { flex: 1; width: 100%; min-height: 0; display: block; border-radius: 8px; }
  .ticks { position: relative; height: 1.2em; font-size: .68em; color: var(--muted); }
  .ticks span { position: absolute; transform: translateX(-50%); top: 2px; }
  .slots { display: flex; flex-direction: column; gap: 3px; font-size: .86em; overflow: auto; min-height: 0; }
  .slot { display: flex; align-items: center; gap: 7px; white-space: nowrap; }
  .slot :global(svg) { color: var(--k); flex: none; }
  .slot .what { font-weight: 600; min-width: 4.2em; }
  .slot .when { font-variant-numeric: tabular-nums; }
  .slot.now .what, .slot.now .when { color: var(--k); }
  .slot .in { margin-left: auto; color: var(--muted); font-size: .9em; }
  .dim { color: var(--muted); overflow: hidden; text-overflow: ellipsis; }
  .dim :global(svg) { color: inherit; vertical-align: -2px; }
  .sum { margin: 0; padding-left: 1.1em; font-size: .8em; color: var(--muted); display: flex; flex-direction: column; gap: 3px; overflow: auto; min-height: 0; }
  .ctl { display: flex; gap: 6px; align-items: center; margin-top: auto; font-size: .88em; }
  .ctl button { flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px; padding: 8px 6px; border-radius: 10px; border: 0; background: rgba(255,255,255,.07); color: var(--text); font: inherit; font-weight: 500; white-space: nowrap; }
  .ctl button :global(svg) { color: var(--k); }
  .ctl button.on { background: color-mix(in srgb, var(--k) 30%, transparent); box-shadow: inset 0 0 0 1px var(--k); }
  .ctl select { flex: 1.4; min-width: 0; }
</style>
