<script module>
  export const meta = {
    type: 'iframe', name: 'Web page', icon: 'mdi:web', category: 'Media',
    size: { w: 480, h: 320 }, tap: 'none',
    defaults: { url: '' },
    fields: [{ key: 'url', label: 'URL', type: 'text' }],
  };
</script>

<script>
  import { t } from '../lib/tpl.js';
  let { props, editing } = $props();
</script>

<iframe src={t(props.url)} title="" style:pointer-events={editing ? 'none' : 'auto'} loading="lazy"></iframe>

<style>
  iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; border-radius: inherit; background: transparent; }
</style>
