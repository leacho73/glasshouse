<script module>
  export const meta = {
    type: 'sensor', name: 'Sensor', icon: 'mdi:thermometer', category: 'Info',
    size: { w: 220, h: 140 }, tap: 'more-info',
    defaults: { entity: '', graph: true, hours: 24 },
    fields: [
      { key: 'entity', label: 'Entity', type: 'entity' },
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'icon', label: 'Icon', type: 'icon' },
      { key: 'value', label: 'Value (override/template)', type: 'text' },
      { key: 'unit', label: 'Unit (override)', type: 'text' },
      { key: 'digits', label: 'Decimals', type: 'number' },
      { key: 'graph', label: 'Show graph', type: 'bool' },
      { key: 'hours', label: 'Graph hours', type: 'number' },
      { key: 'graph_color', label: 'Graph colour', type: 'color' },
    ],
  };
</script>

<script>
  import Icon from '../components/Icon.svelte';
  import Chart from '../components/Chart.svelte';
  import { t, ent } from '../lib/tpl.js';
  import { name, entityIcon, formatNumber, stateText } from '../lib/entity.js';
  import { useHistory } from '../lib/history.svelte.js';
  let { props } = $props();
  const e = $derived(ent(props.entity));
  const raw = $derived(props.value ? t(props.value) : e?.state);
  const numeric = $derived(raw !== '' && raw != null && !Number.isNaN(Number(raw)));
  const unit = $derived(props.unit != null && props.unit !== '' ? t(props.unit) : e?.attributes.unit_of_measurement || '');
  const display = $derived(numeric ? formatNumber(raw, props.digits === '' || props.digits == null ? undefined : Number(props.digits)) : props.value ? raw : stateText(e));
  const hist = useHistory(() => (props.graph && e ? [e.entity_id] : []), () => Number(props.hours) || 24);
  const pts = $derived(e ? hist.series[e.entity_id] || [] : []);
</script>

<div class="sensor">
  <div class="head">
    <Icon icon={t(props.icon) || entityIcon(e)} size="1.2em" />
    <span class="name">{t(props.name) || name(e)}</span>
  </div>
  <div class="val"><span class="num">{display}</span>{#if numeric && unit}<span class="unit">{unit}</span>{/if}</div>
  {#if props.graph && pts.length > 1}
    <div class="graph"><Chart series={[{ points: pts, color: t(props.graph_color) || 'var(--accent)' }]} hours={Number(props.hours) || 24} /></div>
  {/if}
</div>

<style>
  .sensor { height: 100%; display: flex; flex-direction: column; position: relative; }
  .head { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: .9em; z-index: 1; }
  .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .val { margin-top: 6px; z-index: 1; display: flex; align-items: baseline; gap: 4px; }
  .num { font-size: 2.2em; font-weight: 600; letter-spacing: -.02em; line-height: 1.05; }
  .unit { color: var(--muted); font-size: 1em; }
  .graph { position: absolute; left: calc(var(--pad) * -1); right: calc(var(--pad) * -1); bottom: calc(var(--pad) * -1); height: 45%; pointer-events: none; opacity: .9; }
</style>
