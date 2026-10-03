<script module>
  export const meta = {
    type: 'clock', name: 'Clock & date', icon: 'mdi:clock-outline', category: 'Info',
    size: { w: 260, h: 120 }, tap: 'none',
    defaults: { seconds: false, date: true, hour12: false },
    fields: [
      { key: 'seconds', label: 'Show seconds', type: 'bool' },
      { key: 'hour12', label: '12-hour', type: 'bool' },
      { key: 'date', label: 'Show date', type: 'bool' },
      { key: 'subtitle', label: 'Subtitle (template)', type: 'text' },
    ],
  };
</script>

<script>
  import { t } from '../lib/tpl.js';
  let { props } = $props();
  let now = $state(new Date());
  $effect(() => {
    const ms = props.seconds ? 1000 : 60000;
    let timer;
    const tickTo = () => { now = new Date(); timer = setTimeout(tickTo, ms - (Date.now() % ms) + 5); };
    tickTo();
    return () => clearTimeout(timer);
  });
  const time = $derived(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: props.seconds ? '2-digit' : undefined, hour12: !!props.hour12 }));
  const date = $derived(now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }));
</script>

<div class="clock">
  <div class="time">{time}</div>
  {#if props.date}<div class="date">{date}</div>{/if}
  {#if props.subtitle}<div class="date">{t(props.subtitle)}</div>{/if}
</div>

<style>
  .clock { height: 100%; display: flex; flex-direction: column; justify-content: center; }
  .time { font-size: 3.4em; font-weight: 300; letter-spacing: -.03em; line-height: 1; font-variant-numeric: tabular-nums; }
  .date { color: var(--muted); margin-top: 6px; font-size: 1em; }
</style>
