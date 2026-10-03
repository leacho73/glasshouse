<script module>
  export const meta = {
    type: 'divider', name: 'Divider / shape', icon: 'mdi:minus', category: 'Layout',
    size: { w: 260, h: 20 }, tap: 'none',
    defaults: { direction: 'horizontal', thickness: 1, color: 'rgba(255,255,255,.12)' },
    fields: [
      { key: 'direction', label: 'Direction', type: 'select', options: ['horizontal', 'vertical'] },
      { key: 'thickness', label: 'Thickness', type: 'number' },
      { key: 'color', label: 'Colour', type: 'color' },
    ],
  };
</script>

<script>
  import { t } from '../lib/tpl.js';
  let { props } = $props();
</script>

<div class="dv {props.direction}"><i style="background:{t(props.color)};{props.direction === 'vertical' ? 'width' : 'height'}:{props.thickness || 1}px"></i></div>

<style>
  .dv { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
  .horizontal i { width: 100%; }
  .vertical i { height: 100%; }
</style>
