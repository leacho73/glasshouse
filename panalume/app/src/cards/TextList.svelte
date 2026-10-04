<script module>
  export const meta = {
    type: 'textlist', name: 'Template lines', icon: 'mdi:format-list-text', category: 'Info',
    size: { w: 300, h: 160 }, tap: 'none',
    defaults: { items: "🌅 {{ as_timestamp(state_attr('sun.sun','next_rising')) | timestamp_custom('%H:%M') }}\n---\n☀️ {{ states('sun.sun') }}", dividers: false },
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'items', label: 'Lines (templates; separate items with a line containing ---; HTML allowed)', type: 'textarea' },
      { key: 'dividers', label: 'Divider between items', type: 'bool' },
    ],
  };
</script>

<script>
  import { t } from '../lib/tpl.js';
  let { props } = $props();
  const items = $derived(String(props.items || '').split(/^\s*---\s*$/m).map((s) => s.trim()).filter(Boolean));
  // Template output with HTML is used as-is (it's your own template); plain text keeps its line breaks.
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const render = (out) => {
    const s = String(out ?? '').trim();
    if (/<[a-z][\s\S]*>/i.test(s)) return s;
    return s.split('\n').map((l) => l.trim()).filter(Boolean).map(esc).join('<br>');
  };
</script>

<div class="tl" class:dividers={props.dividers}>
  {#if props.title}<div class="title">{t(props.title)}</div>{/if}
  {#each items as it}
    {@const html = render(t(it))}
    {#if html}<div class="it">{@html html}</div>{/if}
  {/each}
</div>

<style>
  .tl { height: 100%; overflow: auto; display: flex; flex-direction: column; gap: 6px; line-height: 1.35; scrollbar-width: none; }
  .title { font-weight: 600; }
  .dividers .it + .it { border-top: 1px solid rgba(255,255,255,.08); padding-top: 6px; }
</style>
