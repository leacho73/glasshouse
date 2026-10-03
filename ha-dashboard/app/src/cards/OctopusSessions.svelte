<script module>
  import { find } from '../lib/octopus.js';
  export const meta = {
    type: 'octopus-sessions', name: 'Octoplus sessions', icon: 'mdi:piggy-bank', category: 'Energy',
    size: { w: 400, h: 380 }, tap: 'none',
    defaults: { show_history: true, upcoming: 5 },
    autofill: () => ({
      saving: find(/^event\.octopus_energy_.+_octoplus_saving_session_events$/),
      powerdown: find(/^event\.octopus_energy_.+_octoplus_power_down_events$/),
      powerup: find(/^event\.octopus_energy_.+_octoplus_power_up_events$/),
      free: find(/^event\.octopus_energy_.+_octoplus_free_electricity_session_events$/),
      points: find(/^sensor\.octopus_energy_.+_octoplus_points$/),
      saving_baseline: find(/^sensor\.octopus_energy_electricity_.+_octoplus_saving_session_baseline$/),
      free_baseline: find(/^sensor\.octopus_energy_electricity_.+_octoplus_free_electricity_session_baseline$/),
      interval: find(/^sensor\.octopus_energy_electricity_.+_current_interval_accumulative_consumption$/),
      demand: find(/^sensor\.octopus_energy_electricity_.+_current_demand$/),
    }),
    sections: [{ key: 'points', label: 'Points', section: 'points' }, { key: 'live', label: 'Live session' }, { key: 'upcoming', label: 'Upcoming', section: 'upcoming' }, { key: 'history', label: '12-month stats' }],
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'saving', label: 'Saving session events', type: 'entity', domain: 'event' },
      { key: 'powerdown', label: 'Power-down events', type: 'entity', domain: 'event' },
      { key: 'powerup', label: 'Power-up events', type: 'entity', domain: 'event' },
      { key: 'free', label: 'Free electricity events', type: 'entity', domain: 'event' },
      { key: 'points', label: 'Octopoints', type: 'entity', domain: 'sensor' },
      { key: 'saving_baseline', label: 'Saving session baseline', type: 'entity', domain: 'sensor' },
      { key: 'free_baseline', label: 'Free electricity baseline', type: 'entity', domain: 'sensor' },
      { key: 'interval', label: 'Current interval consumption', type: 'entity', domain: 'sensor' },
      { key: 'demand', label: 'Current demand (W)', type: 'entity', domain: 'sensor' },
      { key: 'upcoming', label: 'Upcoming items', type: 'number' },
    ],
  };
</script>

<script>
  import Icon from '../components/Icon.svelte';
  import { t, ent } from '../lib/tpl.js';
  import { clock } from '../lib/clock.svelte.js';
  import { callService } from '../lib/ha.svelte.js';
  import { formatNumber } from '../lib/entity.js';
  import { sessions, KIND, hm, day, until } from '../lib/octopus.js';
  let { props } = $props();
  const show = (k) => !props.hide?.[k];
  const now = $derived(clock.now);
  const all = $derived(sessions(props));
  const live = $derived(all.filter((s) => s.start <= now && now < s.end));
  const next = $derived(all.filter((s) => s.start > now).slice(0, Number(props.upcoming) || 5));
  const past = $derived(all.filter((s) => s.end <= now));
  const pts = $derived(ent(props.points));
  const yearAgo = $derived(now - 365 * 864e5);
  const stats = $derived.by(() => {
    const out = {};
    for (const s of past) {
      if (s.start < yearAgo) continue;
      const o = (out[s.kind] ??= { n: 0, points: 0 });
      o.n++;
      o.points += s.points || 0;
    }
    return out;
  });
  const lastSaving = $derived([...past].reverse().find((s) => s.kind === 'saving'));
  const num = (id) => { const v = Number(ent(id)?.state); return isNaN(v) ? null : v; };
  let joining = $state(null);
  async function join(s) {
    joining = s.kind + s.id;
    await callService('octopus_energy', KIND[s.kind].service, { event_code: s.code ?? String(s.id) }, { entity_id: props[s.kind] });
    joining = null;
  }
</script>

<div class="ses">
  <div class="head">
    <div class="title">{t(props.title) || 'Octoplus'}</div>
    {#if pts && show('points')}
      <div class="pts"><Icon icon="mdi:star-four-points" size="1em" /> {formatNumber(pts.state, 0)} pts
        {#if pts.attributes.redeemable_points != null}<span class="dim">· £{(pts.attributes.redeemable_points / 800).toFixed(2)}</span>{/if}</div>
    {/if}
  </div>

  {#each show('live') ? live : [] as s}
    {@const k = KIND[s.kind]}
    {@const f = (now - s.start) / (s.end - s.start)}
    {@const base = num(s.kind === 'free' || s.kind === 'powerup' ? props.free_baseline : props.saving_baseline)}
    {@const used = num(props.interval)}
    <div class="live" style="--c:{k.color}">
      <div class="lr"><span class="dot"></span><Icon icon={k.icon} size="1.2em" /><b>{k.label} live</b><span class="dim">ends {hm(s.end)}{' · '}{until(s.end, now)}</span></div>
      <div class="bar"><div style="width:{f * 100}%"></div></div>
      <div class="lr small">
        {#if base != null && used != null}
          <span>This half-hour: <b>{used.toFixed(2)}</b> / baseline {base.toFixed(2)} kWh</span>
          <span class:good={s.kind === 'saving' || s.kind === 'powerdown' ? used < base : used > base}>
            {s.kind === 'saving' || s.kind === 'powerdown' ? (used < base ? 'On track' : 'Over baseline') : used > base ? 'Using free power' : 'Use more!'}
          </span>
        {/if}
        {#if num(props.demand) != null}<span class="dim">Now {formatNumber(num(props.demand), 0)} W</span>{/if}
      </div>
    </div>
  {/each}

  {#if show('upcoming')}<div class="list">
    {#if !next.length}<div class="empty dim">No upcoming sessions</div>{/if}
    {#each next as s (s.kind + s.id + s.start)}
      {@const k = KIND[s.kind]}
      <div class="row" style="--c:{k.color}">
        <span class="ic"><Icon icon={k.icon} size="1.3em" /></span>
        <div class="info">
          <div class="nm">{k.label}{#if s.perKwh}<span class="dim">{' · '}{s.perKwh} pts/kWh</span>{/if}</div>
          <div class="when">{day(s.start, now)} {hm(s.start)}–{hm(s.end)} <span class="dim">in {until(s.start, now)}</span></div>
        </div>
        {#if s.joinable && k.service}
          <button data-stop disabled={joining === s.kind + s.id} onclick={() => join(s)}>{joining === s.kind + s.id ? '…' : 'Join'}</button>
        {:else}
          <span class="chip">{s.available === 'AVAILABLE' ? 'Available' : s.kind === 'free' ? 'Scheduled' : 'Joined'}</span>
        {/if}
      </div>
    {/each}
  </div>{/if}

  {#if props.show_history !== false && show('history')}
    <div class="hist"><span class="dim">Last 12 months:</span>
      {#each Object.entries(stats) as [kind, o]}
        <div style="--c:{KIND[kind].color}"><Icon icon={KIND[kind].icon} size="1em" /> {o.n} {KIND[kind].plural}{#if o.points}{' · '}{formatNumber(o.points, 0)} pts{/if}</div>
      {/each}
      {#if lastSaving}<div class="dim">Last saving: {day(lastSaving.start, now)}{lastSaving.points ? ` · ${lastSaving.points} pts` : ''}</div>{/if}
    </div>
  {/if}
</div>

<style>
  .ses { height: 100%; display: flex; flex-direction: column; gap: 10px; }
  .head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .title { font-weight: 600; font-size: 1.1em; }
  .pts { display: flex; align-items: center; gap: 5px; color: #ffc861; font-weight: 600; font-size: .95em; }
  .dim { color: var(--muted); font-weight: 400; }
  .live { border-radius: 14px; padding: 10px 12px; background: color-mix(in srgb, var(--c) 18%, transparent); border: 1px solid color-mix(in srgb, var(--c) 50%, transparent); display: flex; flex-direction: column; gap: 6px; }
  .lr { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .lr :global(svg) { color: var(--c); }
  .small { font-size: .82em; justify-content: space-between; }
  .good { color: #5bd88f; font-weight: 600; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--c); animation: pulse 1.4s infinite; }
  @keyframes pulse { 50% { opacity: .3; transform: scale(1.5); } }
  .bar { height: 6px; border-radius: 3px; background: rgba(255,255,255,.1); overflow: hidden; }
  .bar div { height: 100%; background: var(--c); }
  .list { flex: 1; overflow: auto; display: flex; flex-direction: column; gap: 4px; min-height: 0; }
  .empty { font-size: .9em; padding: 6px 0; }
  .row { display: flex; align-items: center; gap: 12px; padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,.05); }
  .ic { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: color-mix(in srgb, var(--c) 18%, transparent); color: var(--c); flex: none; }
  .info { flex: 1; min-width: 0; }
  .nm { font-weight: 600; font-size: .95em; }
  .when { font-size: .85em; }
  button { border: 0; border-radius: 10px; padding: 8px 16px; background: var(--c); color: #000; font-weight: 700; }
  .chip { font-size: .75em; padding: 3px 8px; border-radius: 8px; background: color-mix(in srgb, var(--c) 20%, transparent); color: var(--c); font-weight: 600; }
  .hist { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: .8em; }
  .hist > div { display: flex; align-items: center; gap: 4px; }
  .hist :global(svg) { color: var(--c); }
</style>
