<script module>
  import { find } from '../lib/octopus.js';
  export const meta = {
    type: 'energy-usage', name: 'Energy usage', icon: 'mdi:chart-bar-stacked', category: 'Energy',
    size: { w: 640, h: 340 }, tap: 'none',
    defaults: { day: 'today', grid_invert: false, battery_invert: true },
    // Sources come from Home Assistant's Energy settings; these power sensors only
    // add the live "now" figures and top up the current hour between statistics.
    autofill: () => ({
      grid_power: find(/^sensor\.myenergi_hub_.+_power_grid/),
      solar_power: find(/^sensor\.myenergi_hub_.+_power_generation/) || find(/^sensor\..*solar.*(production|generation|pv).*_w$/),
      battery_power: find(/^sensor\.solaredge_b1_dc_power$/),
      import_price: find(/^sensor\.octopus_energy_electricity_(?!.*export).+_current_rate$/),
      export_price: find(/^sensor\.octopus_energy_electricity_.+_export_current_rate$/),
    }),
    sections: [{ key: 'live', label: 'Live now' }, { key: 'totals', label: 'Totals' }, { key: 'prices', label: 'Prices & cost' }, { key: 'chart', label: 'Chart' }, { key: 'legend', label: 'Legend' }],
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'day', label: 'Day', type: 'select', options: [{ value: 'today', label: 'Today' }, { value: 'yesterday', label: 'Yesterday' }] },
      { key: 'grid_power', label: 'Grid power (+import / −export), for live figures', type: 'entity', domain: 'sensor', section: 'live' },
      { key: 'grid_invert', label: 'Invert grid sign', type: 'bool' },
      { key: 'solar_power', label: 'Solar power', type: 'entity', domain: 'sensor', section: 'live' },
      { key: 'battery_power', label: 'Battery power (+discharge / −charge)', type: 'entity', domain: 'sensor', section: 'live' },
      { key: 'battery_invert', label: 'Invert battery sign', type: 'bool' },
      { key: 'import_price', label: 'Import price now (blank = from Energy settings)', type: 'entity', domain: 'sensor', section: 'prices' },
      { key: 'export_price', label: 'Export price now (blank = from Energy settings)', type: 'entity', domain: 'sensor', section: 'prices' },
    ],
  };
</script>

<script>
  // Energy usage like Home Assistant's energy dashboard: hourly bars of where the
  // house's energy came from (grid, solar, battery) above the line and where
  // spare energy went (export, battery charging) below it. Uses HA's 5-minute
  // statistics, refreshed every minute, plus a live top-up from power sensors.
  import { t, ent } from '../lib/tpl.js';
  import { send, conn } from '../lib/ha.svelte.js';
  let { props, w: cw = 640, h: ch = 340 } = $props();
  const show = (k) => !props.hide?.[k];
  const C = { grid: '#488fc2', solar: '#ff9800', battery: '#4db6ac', export: '#8353d1', charge: '#f06292' };

  let prefs = $state(null);
  let stats = $state({});
  let error = $state('');
  let now = $state(Date.now());
  const dayStart = $derived.by(() => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime() - (props.day === 'yesterday' ? 864e5 : 0); });

  const ids = $derived.by(() => {
    const out = { from: [], to: [], solar: [], bout: [], bin: [], cost: [], comp: [] };
    for (const s of prefs?.energy_sources || []) {
      if (s.type === 'grid') {
        if (s.stat_energy_from) out.from.push(s.stat_energy_from);
        if (s.stat_energy_to) out.to.push(s.stat_energy_to);
        // HA keeps cost / earnings statistics next to the energy ones when prices are set.
        if (s.stat_energy_from && (s.stat_cost || s.entity_energy_price || s.number_energy_price != null)) out.cost.push(s.stat_cost || `${s.stat_energy_from}_cost`);
        if (s.stat_energy_to && (s.stat_compensation || s.entity_energy_price_export || s.number_energy_price_export != null)) out.comp.push(s.stat_compensation || `${s.stat_energy_to}_compensation`);
        for (const f of s.flow_from || []) out.from.push(f.stat_energy_from);
        for (const f of s.flow_to || []) out.to.push(f.stat_energy_to);
      } else if (s.type === 'solar') out.solar.push(s.stat_energy_from);
      else if (s.type === 'battery') { out.bout.push(s.stat_energy_from); out.bin.push(s.stat_energy_to); }
    }
    return out;
  });

  async function load() {
    if (!conn.connected) return;
    try {
      prefs ??= await send({ type: 'energy/get_prefs' });
      const all = Object.values(ids).flat().filter(Boolean);
      if (!all.length) return void (error = 'No energy sources set up in Home Assistant (Settings → Dashboards → Energy).');
      stats = await send({
        type: 'recorder/statistics_during_period', start_time: new Date(dayStart).toISOString(), end_time: new Date(dayStart + 864e5).toISOString(),
        period: props.day === 'yesterday' ? 'hour' : '5minute', statistic_ids: all, types: ['change'], units: { energy: 'kWh' },
      });
      error = '';
    } catch (e) {
      error = e?.message || 'Could not read energy statistics';
    }
  }
  $effect(() => {
    props.day; conn.connected;
    load();
    const a = setInterval(load, 60e3);
    const b = setInterval(() => (now = Date.now()), 2000);
    return () => { clearInterval(a); clearInterval(b); };
  });

  // Live prices (GBP/kWh) from the price sensors in HA's Energy settings.
  const gridSrc = $derived((prefs?.energy_sources || []).find((x) => x.type === 'grid'));
  const price = (id, fixed) => { if (fixed != null) return Number(fixed); const e = ent(id); const v = Number(e?.state); if (!Number.isFinite(v)) return null; return /^(p|pence)\/kwh$/i.test(e.attributes.unit_of_measurement || '') ? v / 100 : v; };
  const priceIn = $derived(props.import_price ? price(props.import_price) : price(gridSrc?.entity_energy_price, gridSrc?.number_energy_price));
  const priceOut = $derived(props.export_price ? price(props.export_price) : price(gridSrc?.entity_energy_price_export, gridSrc?.number_energy_price_export));
  const pence = (v) => (v * 100).toFixed(1) + 'p';

  // Live power in kW (sensors in W or kW).
  const kw = (id, inv) => { const e = ent(id); const v = Number(e?.state); if (!Number.isFinite(v)) return null; const k = /^kw$/i.test(e.attributes.unit_of_measurement || '') ? v : v / 1000; return inv ? -k : k; };
  const gridKw = $derived(kw(props.grid_power, props.grid_invert));
  const solarKw = $derived(Math.max(0, kw(props.solar_power) ?? 0));
  const battKw = $derived(kw(props.battery_power, props.battery_invert));
  const homeKw = $derived(gridKw == null && !props.solar_power ? null : Math.max(0, (gridKw ?? 0) + solarKw + (battKw ?? 0)));

  // Per-hour kWh for each flow, plus a live top-up after the last statistic.
  const hours = $derived.by(() => {
    const H = Array.from({ length: 24 }, () => ({ from: 0, to: 0, solar: 0, bout: 0, bin: 0, cost: 0, comp: 0 }));
    let last = 0;
    for (const [k, list] of Object.entries(ids)) for (const id of list) for (const r of stats[id] || []) {
      const h = Math.floor((r.start - dayStart) / 36e5);
      if (h >= 0 && h < 24 && r.change > 0) H[h][k] += r.change;
      if (k !== 'cost' && k !== 'comp') last = Math.max(last, r.end);
    }
    if (props.day !== 'yesterday' && last && now > last) {
      const hrs = (now - last) / 36e5, h = Math.floor((now - dayStart) / 36e5);
      if (h >= 0 && h < 24 && hrs < 0.5) {
        if (gridKw != null) {
          if (gridKw > 0) { H[h].from += gridKw * hrs; H[h].cost += gridKw * hrs * (priceIn ?? 0); }
          else { H[h].to -= gridKw * hrs; H[h].comp -= gridKw * hrs * (priceOut ?? 0); }
        }
        H[h].solar += solarKw * hrs;
        if (battKw != null) battKw > 0 ? (H[h].bout += battKw * hrs) : (H[h].bin -= battKw * hrs);
      }
    }
    // Split like HA: solar first covers export and battery charging; any charging beyond that came from the grid.
    return H.map((x) => {
      const solarUsed = Math.max(0, x.solar - x.to - x.bin);
      const gridToBatt = Math.max(0, x.bin - Math.max(0, x.solar - x.to));
      return { grid: Math.max(0, x.from - gridToBatt), solar: solarUsed, battery: x.bout, export: x.to, charge: x.bin, cost: x.cost, comp: x.comp, rate: x.from > 0.05 && x.cost > 0 ? x.cost / x.from : null, raw: x };
    });
  });
  const sum = (k) => hours.reduce((a, x) => a + x[k], 0);
  const tot = $derived({ grid: sum('grid'), solar: sum('solar'), battery: sum('battery'), export: sum('export'), charge: sum('charge'), produced: hours.reduce((a, x) => a + x.raw.solar, 0), imported: hours.reduce((a, x) => a + x.raw.from, 0) });
  const money = $derived({ cost: hours.reduce((a, x) => a + x.cost, 0), comp: hours.reduce((a, x) => a + x.comp, 0) });
  const hasMoney = $derived(ids.cost.length > 0 || ids.comp.length > 0);
  const gbp = (v) => (v < 0 ? '−' : '') + '£' + Math.abs(v).toFixed(2);
  const used = $derived(tot.grid + tot.solar + tot.battery);
  const selfSuff = $derived(used > 0 ? Math.round((1 - tot.grid / used) * 100) : null);

  let pick = $state(null);
  const curHour = $derived(props.day === 'yesterday' ? -1 : Math.floor((now - dayStart) / 36e5));
  const shown = $derived(pick ?? curHour);

  // Chart geometry
  let w = $state(500), h = $state(160);
  const top = $derived(Math.max(0.5, ...hours.map((x) => x.grid + x.solar + x.battery)));
  const bot = $derived(Math.max(0, ...hours.map((x) => x.export + x.charge)));
  const PADL = 30, PADB = 16;
  const Y = (v) => { const span = top + bot || 1; return 6 + ((top - v) / span) * (h - PADB - 6); };
  const bw = $derived((w - PADL) / 24);
  const step = $derived(top > 4 ? 2 : top > 2 ? 1 : 0.5);
  const grid = $derived.by(() => { const out = []; for (let v = step; v <= top; v += step) out.push(v); for (let v = -step; v >= -bot; v -= step) out.push(v); return out; });
  // Price line: each hour's average import price (cost ÷ kWh), on its own scale in the top half.
  const rateMax = $derived(Math.max(0.05, ...hours.map((x) => x.rate ?? 0)));
  const RY = (v) => 8 + (1 - v / rateMax) * (Y(0) - 8) * 0.9;
  const ratePts = $derived(hours.map((x, i) => (x.rate == null ? null : [PADL + i * bw + bw / 2, RY(x.rate), x.rate, i])).filter(Boolean));
  // Only join neighbouring hours; a gap means nothing was bought from the grid.
  const ratePath = $derived(ratePts.map(([x, y, , i], k) => `${k && ratePts[k - 1][3] === i - 1 ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(''));
  const f = (v) => (v >= 10 ? v.toFixed(0) : v.toFixed(1));
</script>

<div class="eu">
  <div class="head">
    <div class="title">{t(props.title) || (props.day === 'yesterday' ? 'Energy usage yesterday' : 'Energy usage today')}</div>
    {#if show('live') && homeKw != null && props.day !== 'yesterday'}
      <div class="live">
        <span class="dot"></span>Using <b>{homeKw.toFixed(1)} kW</b>
        {#if solarKw > 0.05}<span style="color:{C.solar}">☀ {solarKw.toFixed(1)}</span>{/if}
        {#if gridKw != null && Math.abs(gridKw) > 0.05}<span style="color:{gridKw > 0 ? C.grid : C.export}">{gridKw > 0 ? '↓ grid' : '↑ export'} {Math.abs(gridKw).toFixed(1)}</span>{/if}
        {#if battKw != null && Math.abs(battKw) > 0.05}<span style="color:{battKw > 0 ? C.battery : C.charge}">{battKw > 0 ? 'battery' : 'charging'} {Math.abs(battKw).toFixed(1)}</span>{/if}
        {#if show('prices') && priceIn != null}<span class="price">{pence(priceIn)}/kWh{#if priceOut != null}{' · export '}{pence(priceOut)}{/if}</span>{/if}
      </div>
    {/if}
  </div>

  {#if error}<div class="err">{error}</div>{/if}

  {#if show('totals')}
    <div class="tots">
      <div><b>{f(used)}</b><span>kWh used</span></div>
      <div><b style="color:{C.grid}">{f(tot.imported)}</b><span>from grid</span></div>
      <div><b style="color:{C.solar}">{f(tot.produced)}</b><span>solar</span></div>
      {#if tot.export > 0.05}<div><b style="color:{C.export}">{f(tot.export)}</b><span>exported</span></div>{/if}
      {#if selfSuff != null}<div><b>{selfSuff}%</b><span>self-sufficient</span></div>{/if}
      {#if show('prices') && hasMoney}<div><b>{gbp(money.cost - money.comp)}</b><span>{gbp(money.cost)} cost{#if money.comp > 0.005}{' · '}{gbp(money.comp)} earned{/if}</span></div>{/if}
    </div>
  {/if}

  {#if show('chart')}
    <div class="chart" bind:clientWidth={w} bind:clientHeight={h} data-stop>
      <svg width={w} height={h}>
        {#each grid as v}
          <line x1={PADL} x2={w} y1={Y(v)} y2={Y(v)} class="gl" />
          <text x={PADL - 5} y={Y(v) + 3} class="ax" text-anchor="end">{v}</text>
        {/each}
        {#each hours as x, i}
          {@const x0 = PADL + i * bw + 1.5}
          {@const bwi = Math.max(1, bw - 3)}
          {@const dim = curHour >= 0 && i > curHour}
          <g class="bar" class:sel={i === shown} style="opacity:{dim ? 0.15 : i === shown || pick == null ? 1 : 0.55}" onclick={() => (pick = pick === i ? null : i)} role="button" tabindex="-1" onkeydown={() => {}}>
            <rect x={x0} y="0" width={bwi} height={h - PADB} class="hit" />
            {#each [['grid', x.grid], ['solar', x.solar], ['battery', x.battery]].reduce((acc, [k, v]) => { const b = acc.length ? acc[acc.length - 1][3] : 0; acc.push([k, v, b, b + v]); return acc; }, []) as [k, v, b0, b1]}
              {#if v > 0.001}<rect x={x0} y={Y(b1)} width={bwi} height={Math.max(0.5, Y(b0) - Y(b1))} style="fill:{C[k]}" rx="1.5" />{/if}
            {/each}
            {#each [['export', x.export], ['charge', x.charge]].reduce((acc, [k, v]) => { const b = acc.length ? acc[acc.length - 1][3] : 0; acc.push([k, v, b, b + v]); return acc; }, []) as [k, v, b0, b1]}
              {#if v > 0.001}<rect x={x0} y={Y(-b0)} width={bwi} height={Math.max(0.5, Y(-b1) - Y(-b0))} style="fill:{C[k]}" rx="1.5" />{/if}
            {/each}
          </g>
        {/each}
        <line x1={PADL} x2={w} y1={Y(0)} y2={Y(0)} class="zero" />
        {#if show('prices') && ratePts.length > 1}
          <path d={ratePath} class="rate" />
          {#each ratePts as [px, py, v]}<circle cx={px} cy={py} r="2.6" class="rdot" />{/each}
          <text x={w} y={RY(rateMax) - 4} class="ax rl" text-anchor="end">{pence(rateMax)}/kWh</text>
        {/if}
        {#each [0, 3, 6, 9, 12, 15, 18, 21] as hh}<text x={PADL + hh * bw + bw / 2} y={h - 3} class="ax" text-anchor="middle">{String(hh).padStart(2, '0')}</text>{/each}
        <text x="2" y="10" class="ax">kWh</text>
      </svg>
    </div>
    {#if shown >= 0 && hours[shown]}
      {@const x = hours[shown]}
      <div class="hr">
        <b>{String(shown).padStart(2, '0')}:00{shown === curHour ? ' (now)' : ''}</b>
        <span><i style="background:{C.grid}"></i>grid {x.grid.toFixed(2)}</span>
        <span><i style="background:{C.solar}"></i>solar {x.solar.toFixed(2)}</span>
        {#if x.battery > 0.005}<span><i style="background:{C.battery}"></i>battery {x.battery.toFixed(2)}</span>{/if}
        {#if x.export > 0.005}<span><i style="background:{C.export}"></i>export {x.export.toFixed(2)}</span>{/if}
        {#if x.charge > 0.005}<span><i style="background:{C.charge}"></i>charging {x.charge.toFixed(2)}</span>{/if}
        <span class="dim">kWh</span>
        {#if show('prices') && hasMoney && (x.cost > 0.005 || x.comp > 0.005)}<span class="cost">{gbp(x.cost)}{#if x.rate != null}{' at '}{pence(x.rate)}{/if}{#if x.comp > 0.005}{' · earned '}{gbp(x.comp)}{/if}</span>{/if}
      </div>
    {/if}
    {#if show('legend')}
      <div class="hr lg">
        {#each [['grid', 'Grid'], ['solar', 'Solar'], ['battery', 'From battery'], ['export', 'Export'], ['charge', 'To battery']] as [k, l]}<span><i style="background:{C[k]}"></i>{l}</span>{/each}
        {#if show('prices') && ratePts.length > 1}<span><i style="background:#ffd24a;height:2px"></i>price paid</span>{/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .eu { height: 100%; display: flex; flex-direction: column; gap: 8px; }
  .head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  .title { font-weight: 600; }
  .live { display: flex; align-items: center; gap: 10px; font-size: .85em; color: var(--muted); flex-wrap: wrap; }
  .live b { color: var(--text); font-weight: 600; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: #5bd88f; box-shadow: 0 0 0 0 rgba(91,216,143,.6); animation: live 2s infinite; margin-right: -4px; }
  @keyframes live { 70% { box-shadow: 0 0 0 7px rgba(91,216,143,0); } }
  .err { font-size: .8em; color: #ff7a90; }
  .tots { display: flex; gap: 8px; flex-wrap: wrap; }
  .tots div { flex: 1; min-width: 70px; background: rgba(255,255,255,.05); border-radius: 12px; padding: 6px 10px; display: flex; flex-direction: column; }
  .tots b { font-size: 1.25em; font-weight: 600; font-variant-numeric: tabular-nums; }
  .tots span { font-size: .72em; color: var(--muted); }
  .chart { flex: 1; min-height: 80px; position: relative; }
  svg { position: absolute; inset: 0; overflow: visible; }
  .gl { stroke: rgba(255,255,255,.06); }
  .zero { stroke: rgba(255,255,255,.25); }
  .ax { font-size: 9.5px; fill: var(--muted); }
  .hit { fill: transparent; }
  .bar { cursor: pointer; transition: opacity .2s; outline: none; }
  .hr { display: flex; flex-wrap: wrap; gap: 3px 12px; font-size: .75em; color: var(--muted); align-items: center; font-variant-numeric: tabular-nums; }
  .hr b { color: var(--text); }
  .hr span { display: inline-flex; align-items: center; gap: 5px; }
  .hr i { width: 9px; height: 9px; border-radius: 3px; }
  .dim { opacity: .7; }
  .price { color: var(--text); font-variant-numeric: tabular-nums; }
  .cost { color: var(--text); font-weight: 600; }
  .rate { fill: none; stroke: #ffd24a; stroke-width: 1.6; stroke-dasharray: 3 3; pointer-events: none; }
  .rdot { fill: #ffd24a; pointer-events: none; }
  .ax.rl { fill: #ffd24a; }
  .lg { font-size: .7em; opacity: .85; }
</style>
