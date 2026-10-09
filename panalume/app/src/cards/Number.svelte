<script module>
  export const meta = {
    type: 'number', name: 'Slider', icon: 'mdi:tune-variant', category: 'Controls',
    size: { w: 300, h: 110 }, tap: 'none',
    defaults: { entity: '' },
    fields: [
      { key: 'entity', label: 'Number / light / fan / volume', type: 'entity', domain: ['number', 'input_number', 'light', 'fan', 'media_player', 'cover'] },
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'icon', label: 'Icon', type: 'icon' },
      { key: 'color', label: 'Colour', type: 'color' },
      { key: 'vertical', label: 'Vertical', type: 'bool' },
    ],
  };
</script>

<script>
  import Icon from '../components/Icon.svelte';
  import Slider from '../components/Slider.svelte';
  import { t, ent } from '../lib/tpl.js';
  import { name, entityIcon, domain, formatNumber } from '../lib/entity.js';
  import { callService } from '../lib/ha.svelte.js';
  let { props } = $props();
  const e = $derived(ent(props.entity));
  const d = $derived(domain(e?.entity_id));
  const a = $derived(e?.attributes || {});
  const cfg = $derived.by(() => {
    if (d === 'light') return { v: e.state === 'on' ? Math.round(((a.brightness ?? 255) / 255) * 100) : 0, min: 0, max: 100, step: 1, unit: '%' };
    if (d === 'fan') return { v: a.percentage ?? 0, min: 0, max: 100, step: a.percentage_step || 1, unit: '%' };
    if (d === 'media_player') return { v: Math.round((a.volume_level ?? 0) * 100), min: 0, max: 100, step: 1, unit: '%' };
    if (d === 'cover') return { v: a.current_position ?? 0, min: 0, max: 100, step: 1, unit: '%' };
    return { v: Number(e?.state), min: a.min ?? 0, max: a.max ?? 100, step: a.step ?? 1, unit: a.unit_of_measurement || '' };
  });
  function set(v) {
    const target = { entity_id: e.entity_id };
    if (d === 'light') callService('light', 'turn_on', { brightness_pct: v }, target);
    else if (d === 'fan') callService('fan', 'set_percentage', { percentage: v }, target);
    else if (d === 'media_player') callService('media_player', 'volume_set', { volume_level: v / 100 }, target);
    else if (d === 'cover') callService('cover', 'set_cover_position', { position: v }, target);
    else callService(d, 'set_value', { value: v }, target);
  }
  let live = $state(null);
</script>

<div class="num" class:vertical={props.vertical}>
  <div class="head"><Icon icon={t(props.icon) || entityIcon(e)} size="1.2em" /><span class="n">{t(props.name) || name(e)}</span><span class="v">{formatNumber(live ?? cfg.v)}{cfg.unit}</span></div>
  <div class="s"><Slider value={cfg.v} min={cfg.min} max={cfg.max} step={cfg.step} vertical={props.vertical} height={props.vertical ? 64 : 44} color={t(props.color) || 'var(--accent)'} unit={cfg.unit} oninput={(v) => (live = v)} onchange={set} /></div>
</div>

<style>
  .num { height: 100%; display: flex; flex-direction: column; justify-content: space-between; gap: 10px; }
  .head { display: flex; align-items: center; gap: 8px; }
  .n { flex: 1; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .v { color: var(--muted); }
  .vertical .s { flex: 1; display: flex; justify-content: center; min-height: 0; }
</style>
