<script module>
  import { states } from '../lib/ha.svelte.js';
  // Bambu Lab (ha-bambulab) printers fill in automatically: the printer that's
  // online is preferred. OctoPrint gets the basics.
  function autofill() {
    const ids = [...states.keys()];
    const prefixes = ids.map((id) => /^sensor\.(.+)_print_status$/.exec(id)?.[1]).filter(Boolean);
    const p = prefixes.find((x) => !['unavailable', 'offline'].includes(states.get(`sensor.${x}_print_status`)?.state)) || prefixes[0];
    const has = (id) => (states.has(id) ? id : '');
    if (p) return {
      status: `sensor.${p}_print_status`, stage: has(`sensor.${p}_current_stage`), progress: has(`sensor.${p}_print_progress`),
      remaining: has(`sensor.${p}_remaining_time`), end_time: has(`sensor.${p}_end_time`), task: has(`sensor.${p}_task_name`),
      layer: has(`sensor.${p}_current_layer`), layers: has(`sensor.${p}_total_layer_count`),
      nozzle: has(`sensor.${p}_nozzle_temperature`), nozzle_target: has(`sensor.${p}_nozzle_target_temperature`),
      bed: has(`sensor.${p}_bed_temperature`), bed_target: has(`sensor.${p}_bed_target_temperature`), chamber: has(`sensor.${p}_chamber_temperature`),
      image: has(`image.${p}_cover_image`), filament: has(`sensor.${p}_active_tray`),
      pause: has(`button.${p}_pause_printing`), resume: has(`button.${p}_resume_printing`), stop: has(`button.${p}_stop_printing`),
      light: has(`light.${p}_chamber_light`), speed: has(`select.${p}_printing_speed`),
    };
    if (states.has('sensor.octoprint_current_state')) return {
      name: 'OctoPrint', status: 'sensor.octoprint_current_state', progress: has('sensor.octoprint_job_percentage'),
      end_time: has('sensor.octoprint_estimated_finish_time'), nozzle: has('sensor.octoprint_actual_tool0_temp'), nozzle_target: has('sensor.octoprint_target_tool0_temp'),
      bed: has('sensor.octoprint_actual_bed_temp'), bed_target: has('sensor.octoprint_target_bed_temp'),
      pause: has('button.octoprint_pause_job'), resume: has('button.octoprint_resume_job'), stop: has('button.octoprint_stop_job'),
    };
    return {};
  }
  export const meta = {
    type: 'printer', name: '3D printer', icon: 'mdi:printer-3d', category: 'Controls',
    size: { w: 460, h: 260 }, tap: 'none',
    defaults: {},
    autofill,
    sections: [
      { key: 'picture', label: 'Model picture', section: 'picture' }, { key: 'layers', label: 'Layers', section: 'layers' }, { key: 'temps', label: 'Temperatures', section: 'temps' },
      { key: 'filament', label: 'Filament', section: 'filament' }, { key: 'controls', label: 'Pause / stop', section: 'controls' }, { key: 'light', label: 'Light', section: 'light' }, { key: 'speed', label: 'Speed', section: 'speed' },
    ],
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'status', label: 'Print status', type: 'entity', domain: 'sensor' },
      { key: 'stage', label: 'Current stage (optional, e.g. "heating bed")', type: 'entity', domain: 'sensor' },
      { key: 'progress', label: 'Progress %', type: 'entity', domain: 'sensor' },
      { key: 'remaining', label: 'Time left', type: 'entity', domain: 'sensor' },
      { key: 'end_time', label: 'Finish time (optional)', type: 'entity', domain: 'sensor' },
      { key: 'task', label: 'Print name', type: 'entity', domain: 'sensor' },
      { key: 'image', label: 'Model picture', type: 'entity', domain: ['image', 'camera'], section: 'picture' },
      { key: 'layer', label: 'Current layer', type: 'entity', domain: 'sensor', section: 'layers' },
      { key: 'layers', label: 'Total layers', type: 'entity', domain: 'sensor', section: 'layers' },
      { key: 'nozzle', label: 'Nozzle temperature', type: 'entity', domain: 'sensor', section: 'temps' },
      { key: 'nozzle_target', label: 'Nozzle target', type: 'entity', domain: ['sensor', 'number'], section: 'temps' },
      { key: 'bed', label: 'Bed temperature', type: 'entity', domain: 'sensor', section: 'temps' },
      { key: 'bed_target', label: 'Bed target', type: 'entity', domain: ['sensor', 'number'], section: 'temps' },
      { key: 'chamber', label: 'Chamber temperature', type: 'entity', domain: 'sensor', section: 'temps' },
      { key: 'filament', label: 'Filament in use (with a colour)', type: 'entity', domain: 'sensor', section: 'filament' },
      { key: 'pause', label: 'Pause button', type: 'entity', domain: 'button', section: 'controls' },
      { key: 'resume', label: 'Resume button', type: 'entity', domain: 'button', section: 'controls' },
      { key: 'stop', label: 'Stop button', type: 'entity', domain: 'button', section: 'controls' },
      { key: 'light', label: 'Light', type: 'entity', domain: ['light', 'switch'], section: 'light' },
      { key: 'speed', label: 'Speed', type: 'entity', domain: 'select', section: 'speed' },
    ],
  };
</script>

<script>
  // A 3D printer: progress ring around the model's picture, time left and when
  // it'll finish, layers, temperatures, filament colour, and Pause / Resume /
  // Stop (Stop asks first). Small cards become a single row.
  import Icon from '../components/Icon.svelte';
  import { t, ent } from '../lib/tpl.js';
  import { formatNumber, toggle } from '../lib/entity.js';
  import { callService, haImage } from '../lib/ha.svelte.js';
  import { clock } from '../lib/clock.svelte.js';
  let { props, w = 460, h = 260 } = $props();
  const show = (k) => !props.hide?.[k];
  const num = (id) => { const v = Number(ent(id)?.state); return id && Number.isFinite(v) ? v : null; };

  const raw = $derived(String(ent(props.status)?.state ?? 'unavailable').toLowerCase());
  const status = $derived(
    /^(running|printing)/.test(raw) ? 'printing' : /^paus/.test(raw) ? 'paused' : /^(prepare|init|slicing|heating|starting)/.test(raw) ? 'preparing'
    : /^(finish|complete|done)/.test(raw) ? 'finished' : /^(fail|error|cancel)/.test(raw) ? 'failed' : /^(offline|unavailable|unknown|closed)/.test(raw) ? 'offline' : 'idle');
  const LOOK = { printing: ['Printing', '#4fb4ff'], paused: ['Paused', '#ffb547'], preparing: ['Getting ready', '#b48cff'], finished: ['Finished', '#5bd88f'], failed: ['Failed', '#ff6b6b'], offline: ['Offline', '#8a94a8'], idle: ['Idle', '#8a94a8'] };
  const [label, color] = $derived(LOOK[status]);
  const active = $derived(status === 'printing' || status === 'paused' || status === 'preparing');
  // Bambu's stage says what it's doing while getting ready ("heatbed preheating").
  const stage = $derived.by(() => {
    const s = ent(props.stage)?.state;
    if (!s || !active || /^(printing|unknown|unavailable|idle|offline)$/i.test(s)) return '';
    return s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  });

  const pct = $derived(Math.max(0, Math.min(100, num(props.progress) ?? (status === 'finished' ? 100 : 0))));
  // Time left in minutes, from a duration sensor (h / min / s) or the finish time.
  const endAt = $derived.by(() => { const v = ent(props.end_time)?.state; const d = v && Date.parse(v); return Number.isFinite(d) ? d : null; });
  const left = $derived.by(() => {
    const e = ent(props.remaining);
    const v = Number(e?.state);
    if (e && Number.isFinite(v)) {
      const u = String(e.attributes.unit_of_measurement || 'min').toLowerCase();
      return u.startsWith('h') ? v * 60 : u === 's' ? v / 60 : u.startsWith('d') ? v * 1440 : v;
    }
    return endAt ? Math.max(0, (endAt - clock.now) / 60e3) : null;
  });
  const finish = $derived(left != null ? clock.now + left * 60e3 : endAt);
  const dur = (m) => { m = Math.round(m); return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m} min`; };
  const tm = (x) => new Date(x).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  const task = $derived(ent(props.task)?.state);
  const img = $derived.by(() => { const e = show('picture') && ent(props.image); return e && e.state !== 'unavailable' ? haImage(e.attributes.entity_picture) : ''; });
  const layer = $derived(show('layers') ? num(props.layer) : null);
  const layers = $derived(show('layers') ? num(props.layers) : null);
  const temps = $derived(show('temps') ? [['Nozzle', 'mdi:printer-3d-nozzle-heat-outline', num(props.nozzle), num(props.nozzle_target)], ['Bed', 'mdi:radiator', num(props.bed), num(props.bed_target)], ['Chamber', 'mdi:thermometer', num(props.chamber), null]].filter((x) => x[2] != null) : []);
  const fil = $derived.by(() => {
    const e = show('filament') && ent(props.filament);
    if (!e) return null;
    const c = e.attributes.color;
    const name = e.attributes.name || e.attributes.type || (e.state !== '?' && e.state !== 'unknown' ? e.state : '');
    return c || name ? { color: c ? (c.length === 9 ? c.slice(0, 7) : c) : null, name } : null;
  });

  // Stop asks for a second tap.
  let armed = $state(false), timer;
  function stop() {
    if (!armed) { armed = true; clearTimeout(timer); timer = setTimeout(() => (armed = false), 3000); return; }
    armed = false;
    callService('button', 'press', {}, { entity_id: props.stop });
  }
  const press = (id) => id && callService('button', 'press', {}, { entity_id: id });
  const lightOn = $derived(ent(props.light)?.state === 'on');
  const controls = $derived(show('controls') && active && (props.pause || props.resume || props.stop));

  const small = $derived(h < 170 || (w < 300 && h < 280));
  // Tall and narrow: the ring on top, the details under it.
  const stacked = $derived(!small && w < 380 && h > w * 1.1);
  const ringSize = $derived(small ? Math.min(h - 16, 64) : stacked ? Math.min(w - 60, h * 0.34, 200) : Math.min(h - 60, w * 0.42, 200));
  const speed = $derived(show('speed') && active && !(stacked && h < 500) ? ent(props.speed) : null);
  const R = 44, C = 2 * Math.PI * R;
</script>

<div class="pr" class:small class:stacked class:printing={status === 'printing'} style="--c:{color}">
  <div class="glow"></div>
  {#if !small}
    <div class="head">
      <span class="ic"><Icon icon="mdi:printer-3d" size="1.15em" /></span>
      <span class="name">{t(props.name) || 'Printer'}</span>
      <span class="chip">{label}</span>
    </div>
  {/if}
  <div class="body">
    <div class="ring" style="width:{ringSize}px;height:{ringSize}px">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={R} class="track" />
        <circle cx="50" cy="50" r={R} class="fill" stroke-dasharray={C} stroke-dashoffset={C * (1 - pct / 100)} />
      </svg>
      <div class="inner">
        {#if img && !small}<img src={img} alt="" />{:else}<span class="pct">{Math.round(pct)}<small>%</small></span>{/if}
      </div>
    </div>
    <div class="info">
      {#if small}<div class="name">{t(props.name) || 'Printer'} <span class="st">· {stage || label}</span></div>{/if}
      {#if task && (active || status === 'finished' || status === 'failed') && !small}<div class="task" title={task}>{task}</div>{/if}
      {#if active && left != null}
        <div class="left"><b>{dur(left)}</b> <span>left{finish ? ` · done ${tm(finish)}` : ''}</span></div>
      {:else if !small}
        <div class="left"><b>{stage || label}</b></div>
      {/if}
      {#if !small}
        {#if active && stage}<div class="stage">{stage}</div>{/if}
        {#if img}<div class="sub">{[`${Math.round(pct)}%`, layer != null && layers ? `layer ${layer} / ${layers}` : ''].filter(Boolean).join(' · ')}</div>
        {:else if layer != null && layers}<div class="sub">Layer {layer} / {layers}</div>{/if}
        {#if temps.length || fil}
          <div class="chips">
            {#each temps as [n, ic, v, tg]}<span class="tc" title={n}><Icon icon={ic} size="1em" />{formatNumber(v, 0)}°{#if tg}<em>/{formatNumber(tg, 0)}°</em>{/if}</span>{/each}
            {#if fil}<span class="tc" title="Filament">{#if fil.color}<i style="background:{fil.color}"></i>{/if}{fil.name}</span>{/if}
          </div>
        {/if}
        {#if controls || (show('light') && props.light) || speed}
          <div class="btns" data-stop>
            {#if controls && status === 'paused' && props.resume}<button onclick={() => press(props.resume)}><Icon icon="mdi:play" size="1.1em" /> Resume</button>
            {:else if controls && props.pause}<button onclick={() => press(props.pause)}><Icon icon="mdi:pause" size="1.1em" /> Pause</button>{/if}
            {#if controls && props.stop}<button class="stop" class:armed onclick={stop}><Icon icon="mdi:stop" size="1.1em" /> {armed ? 'Tap again' : 'Stop'}</button>{/if}
            {#if show('light') && props.light}<button class="sq" class:on={lightOn} onclick={() => toggle(ent(props.light))} title="Light"><Icon icon={lightOn ? 'mdi:lightbulb-on' : 'mdi:lightbulb-outline'} size="1.1em" /></button>{/if}
            {#if speed}
              <select value={speed.state} onchange={(ev) => callService('select', 'select_option', { option: ev.currentTarget.value }, { entity_id: speed.entity_id })} title="Speed">
                {#each speed.attributes.options || [] as o}<option value={o}>{o.replace(/^./, (c) => c.toUpperCase())}</option>{/each}
              </select>
            {/if}
          </div>
        {/if}
      {/if}
    </div>
    {#if small && controls && w >= 340}
      <div class="btns" data-stop>
        {#if status === 'paused' && props.resume}<button class="sq" onclick={() => press(props.resume)} title="Resume"><Icon icon="mdi:play" size="1.1em" /></button>
        {:else if props.pause}<button class="sq" onclick={() => press(props.pause)} title="Pause"><Icon icon="mdi:pause" size="1.1em" /></button>{/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .pr { position: relative; height: 100%; display: flex; flex-direction: column; gap: 8px; isolation: isolate; }
  .glow { position: absolute; inset: calc(var(--pad) * -1); z-index: -1; background: radial-gradient(80% 90% at 15% 50%, color-mix(in srgb, var(--c) 16%, transparent), transparent 70%); pointer-events: none; transition: background .6s; }
  .head { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .ic { width: 2em; height: 2em; border-radius: 50%; display: grid; place-items: center; background: color-mix(in srgb, var(--c) 22%, transparent); color: var(--c); flex: none; }
  .name { font-weight: 600; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .chip { font-size: .75em; font-weight: 600; padding: 3px 9px; border-radius: 99px; background: color-mix(in srgb, var(--c) 22%, transparent); color: var(--c); white-space: nowrap; }
  .body { flex: 1; min-height: 0; display: flex; align-items: center; gap: 16px; }
  .small .body { gap: 12px; }
  .stacked .body { flex-direction: column; justify-content: center; gap: 12px; }
  .stacked .info { align-items: center; text-align: center; flex: none; max-width: 100%; }
  .stacked .chips, .stacked .btns { justify-content: center; }
  .ring { position: relative; flex: none; }
  .ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
  .track { fill: none; stroke: rgba(255,255,255,.07); stroke-width: 7; }
  .fill { fill: none; stroke: var(--c); stroke-width: 7; stroke-linecap: round; transition: stroke-dashoffset 1s, stroke .5s; }
  /* The glow goes on the whole drawing: on the arc itself it's clipped to a square. */
  .ring svg { filter: drop-shadow(0 0 5px color-mix(in srgb, var(--c) 55%, transparent)); }
  .printing .ring svg { animation: breathe 2.4s ease-in-out infinite; }
  @keyframes breathe { 50% { filter: drop-shadow(0 0 10px color-mix(in srgb, var(--c) 80%, transparent)); } }
  .inner { position: absolute; inset: 14%; border-radius: 50%; overflow: hidden; display: grid; place-items: center; background: rgba(255,255,255,.03); }
  .small .inner { inset: 12%; }
  .inner img { width: 100%; height: 100%; object-fit: contain; }
  .pct { font-size: 1.6em; font-weight: 600; letter-spacing: -.02em; }
  .small .pct { font-size: .95em; }
  .pct small { font-size: .55em; color: var(--muted); }
  .info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
  .small .info { gap: 2px; }
  .task { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .left b { font-size: 1.5em; font-weight: 600; letter-spacing: -.02em; }
  .small .left b { font-size: 1.05em; }
  .left span { color: var(--muted); font-size: .85em; }
  .st { color: var(--c); font-weight: 500; font-size: .9em; }
  .stage { font-size: .8em; color: var(--c); }
  .sub { font-size: .82em; color: var(--muted); }
  .chips { display: flex; flex-wrap: wrap; gap: 5px; }
  .tc { display: inline-flex; align-items: center; gap: 4px; font-size: .78em; padding: 3px 8px; border-radius: 99px; background: rgba(255,255,255,.06); white-space: nowrap; font-variant-numeric: tabular-nums; }
  .tc em { font-style: normal; color: var(--muted); }
  .tc i { width: .8em; height: .8em; border-radius: 50%; box-shadow: 0 0 0 1px rgba(255,255,255,.25); }
  .btns { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
  .btns button { display: inline-flex; align-items: center; gap: 5px; padding: 7px 12px; border-radius: 11px; border: 0; background: rgba(255,255,255,.07); color: inherit; font: inherit; font-size: .85em; }
  .btns .sq { padding: 7px 9px; }
  .btns .sq.on { background: color-mix(in srgb, #ffc861 30%, transparent); color: #ffd98a; }
  .btns .stop { color: #ff8a8a; }
  .btns .stop.armed { background: rgba(255,107,107,.3); color: #fff; }
  .btns select { font-size: .8em; padding: 6px 8px; border-radius: 10px; background: rgba(255,255,255,.06); max-width: 120px; }
</style>
