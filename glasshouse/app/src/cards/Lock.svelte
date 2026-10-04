<script module>
  import { states } from '../lib/ha.svelte.js';
  export const meta = {
    type: 'lock', name: 'Door lock', icon: 'mdi:lock', category: 'Controls',
    size: { w: 240, h: 240 }, tap: 'none', hold: 'more-info',
    defaults: { entity: '', confirm: 'unlock' },
    autofill: () => {
      const ids = [...states.keys()].filter((id) => id.startsWith('lock.')).sort();
      return { entity: ids.find((id) => states.get(id)?.state !== 'unavailable') || ids[0] || '' };
    },
    sections: [{ key: 'state', label: 'State' }, { key: 'door', label: 'Door open / closed', section: 'door' }, { key: 'battery', label: 'Battery', section: 'battery' }, { key: 'open', label: 'Open button (locks that can open the latch)' }],
    fields: [
      { key: 'entity', label: 'Lock', type: 'entity', domain: 'lock' },
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'door', label: 'Door sensor (optional)', type: 'entity', domain: 'binary_sensor', section: 'door' },
      { key: 'battery', label: 'Battery (optional)', type: 'entity', domain: 'sensor', section: 'battery' },
      { key: 'confirm', label: 'Tap twice to', type: 'select', options: [{ value: 'unlock', label: 'Unlock' }, { value: 'both', label: 'Lock and unlock' }, { value: 'none', label: 'Never (one tap)' }] },
    ],
  };
</script>

<script>
  // A door lock: a big padlock whose shackle lifts when it's unlocked. Tap it to
  // lock or unlock (unlocking asks for a second tap by default). Small cards
  // become a row with a Lock / Unlock button.
  import Icon from '../components/Icon.svelte';
  import { t, ent } from '../lib/tpl.js';
  import { name, formatNumber } from '../lib/entity.js';
  import { callService } from '../lib/ha.svelte.js';
  let { props, w = 240, h = 240 } = $props();
  const show = (k) => !props.hide?.[k];

  const e = $derived(ent(props.entity));
  const st = $derived(e?.state || 'unavailable');
  const door = $derived(show('door') && props.door ? ent(props.door) : null);
  const batt = $derived(show('battery') && props.battery ? Number(ent(props.battery)?.state) : NaN);
  const canOpen = $derived(show('open') && !!e && ((e.attributes.supported_features || 0) & 1) === 1);

  const LOOK = {
    locked: ['Locked', '#5bd88f'], unlocked: ['Unlocked', '#ffb547'], open: ['Open', '#ff8a4c'], opening: ['Opening…', '#7aa2ff'],
    locking: ['Locking…', '#7aa2ff'], unlocking: ['Unlocking…', '#7aa2ff'], jammed: ['Jammed', '#ff6b6b'], unavailable: ['Unavailable', '#8a94a8'], unknown: ['Unknown', '#8a94a8'],
  };
  const [label, color] = $derived(LOOK[st] || [st, '#8a94a8']);
  const shut = $derived(st === 'locked' || st === 'locking');
  const busy = $derived(st === 'locking' || st === 'unlocking' || st === 'opening');
  const dead = $derived(st === 'unavailable' || st === 'unknown' || !e);

  // Unlocking (and, if chosen, locking) asks for a second tap within 3 s.
  let armed = $state(null), timer;
  function act(what) {
    if (dead || busy) return;
    const ask = props.confirm === 'both' || ((props.confirm ?? 'unlock') === 'unlock' && what !== 'lock');
    if (ask && armed !== what) {
      armed = what;
      clearTimeout(timer);
      timer = setTimeout(() => (armed = null), 3000);
      return;
    }
    armed = null;
    callService('lock', what, {}, { entity_id: e.entity_id });
  }
  const tapLock = () => act(shut ? 'unlock' : 'lock');
  const prompt = $derived(armed === 'unlock' ? 'Tap again to unlock' : armed === 'lock' ? 'Tap again to lock' : armed === 'open' ? 'Tap again to open' : null);

  // What fits under the padlock: the door line and Open button go first, then
  // it becomes a row.
  const room = (door, open) => h - 32 - 28 - 30 - (door ? 20 : 0) - (open ? 46 : 0);
  const fitDoor = $derived(!!door && room(true, canOpen) >= 64);
  const fitOpen = $derived(canOpen && room(fitDoor, true) >= 64);
  const row = $derived(h < 150 || w < 130 || room(false, false) < 56);
  const dial = $derived(Math.max(48, Math.min(w - 40, room(fitDoor, fitOpen))));
</script>

<div class="lk" class:row style="--c:{color}">
  <div class="glow"></div>
  {#if row}
    <button class="pad small" class:shut class:busy class:armed={!!armed} onclick={tapLock} data-stop disabled={dead} aria-label={shut ? 'Unlock' : 'Lock'}>{@render padlock(26)}</button>
    <div class="txt">
      <div class="name">{t(props.name) || name(e)}</div>
      <div class="st">{prompt || [show('state') ? label : '', door ? (door.state === 'on' ? 'Door open' : 'Door shut') : '', Number.isFinite(batt) ? `${formatNumber(batt, 0)}%` : ''].filter(Boolean).join(' · ')}</div>
    </div>
    {#if w >= 260}
      <button class="act" class:armed={!!armed} onclick={tapLock} data-stop disabled={dead || busy}>{armed ? 'Confirm' : shut ? 'Unlock' : 'Lock'}</button>
    {/if}
  {:else}
    <div class="head">
      <span class="name">{t(props.name) || name(e)}</span>
      {#if Number.isFinite(batt)}<span class="chip" class:low={batt <= 20}><Icon icon={batt <= 20 ? 'mdi:battery-alert-variant-outline' : 'mdi:battery-medium'} size="1em" />{formatNumber(batt, 0)}%</span>{/if}
    </div>
    <div class="mid">
      <button class="pad" class:shut class:busy class:armed={!!armed} style="width:{dial}px;height:{dial}px" onclick={tapLock} data-stop disabled={dead} aria-label={shut ? 'Unlock' : 'Lock'}>{@render padlock(dial * 0.46)}</button>
    </div>
    <div class="foot">
      <div class="big">{prompt || (show('state') ? label : '')}</div>
      {#if door && fitDoor}<div class="door" class:open={door.state === 'on'}><Icon icon={door.state === 'on' ? 'mdi:door-open' : 'mdi:door-closed'} size="1em" /> {door.state === 'on' ? 'Door open' : 'Door shut'}</div>{/if}
      {#if fitOpen}<button class="open" class:armed={armed === 'open'} onclick={() => act('open')} data-stop disabled={dead || busy}><Icon icon="mdi:door-open" size="1.1em" /> {armed === 'open' ? 'Tap again' : 'Open door'}</button>{/if}
    </div>
  {/if}
</div>

{#snippet padlock(size)}
  <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
    <path class="shackle" d="M12 18 V12 a8 8 0 0 1 16 0 V18" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" />
    <rect x="7" y="17" width="26" height="20" rx="5" fill="currentColor" />
    <circle cx="20" cy="25.5" r="2.6" fill="var(--hole)" />
    <rect x="18.8" y="26.5" width="2.4" height="5" rx="1.2" fill="var(--hole)" />
  </svg>
{/snippet}

<style>
  .lk { --hole: #1a1e2a; position: relative; height: 100%; display: flex; flex-direction: column; gap: 6px; isolation: isolate; }
  .glow { position: absolute; inset: calc(var(--pad) * -1); z-index: -1; background: radial-gradient(90% 70% at 50% 45%, color-mix(in srgb, var(--c) 18%, transparent), transparent 70%); transition: background .5s; pointer-events: none; }
  .head { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .name { font-weight: 600; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .chip { display: inline-flex; align-items: center; gap: 3px; font-size: .78em; color: var(--muted); }
  .chip.low { color: #ff8a8a; }
  .mid { flex: 1; min-height: 0; display: grid; place-items: center; }
  .pad { border-radius: 50%; border: 2px solid color-mix(in srgb, var(--c) 45%, transparent); background: color-mix(in srgb, var(--c) 14%, rgba(255,255,255,.03)); color: var(--c); display: grid; place-items: center; padding: 0; transition: border-color .4s, background .4s, color .4s, transform .15s; box-shadow: 0 0 0 0 transparent; }
  .pad:active:not(:disabled) { transform: scale(.95); }
  .pad:disabled { opacity: .55; }
  .pad.armed { animation: ask 0.9s ease-in-out infinite; }
  @keyframes ask { 50% { box-shadow: 0 0 0 8px color-mix(in srgb, var(--c) 25%, transparent); } }
  .pad.busy { animation: busy 1.2s ease-in-out infinite; }
  @keyframes busy { 50% { opacity: .55; } }
  /* The shackle lifts and swings open when unlocked. */
  .shackle { transform-origin: 28px 18px; transform: translateY(-5px) rotate(28deg); transition: transform .45s cubic-bezier(.3,1.4,.5,1); }
  .shut .shackle { transform: none; }
  .foot { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .big { font-weight: 600; font-size: 1.1em; color: var(--c); min-height: 1.3em; }
  .door { font-size: .8em; color: var(--muted); display: flex; align-items: center; gap: 4px; }
  .door.open { color: #ff8a4c; }
  .open { margin-top: 4px; display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 12px; border: 0; background: rgba(255,255,255,.07); color: inherit; font: inherit; font-size: .85em; }
  .open.armed { background: color-mix(in srgb, #ff8a4c 35%, transparent); }
  .row { flex-direction: row; align-items: center; gap: 10px; }
  .pad.small { width: 46px; height: 46px; flex: none; }
  .txt { flex: 1; min-width: 0; }
  .st { font-size: .85em; color: var(--c); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .act { flex: none; padding: 9px 14px; border-radius: 12px; border: 0; background: color-mix(in srgb, var(--c) 22%, rgba(255,255,255,.04)); color: var(--text); font: inherit; font-weight: 600; font-size: .9em; }
  .act.armed { background: color-mix(in srgb, var(--c) 50%, transparent); }
  .act:disabled { opacity: .5; }
</style>
