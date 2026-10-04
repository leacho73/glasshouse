<script module>
  export const meta = {
    type: 'markdown', name: 'Text / Markdown', icon: 'mdi:text', category: 'Info',
    size: { w: 300, h: 140 }, tap: 'none',
    defaults: { content: '## Title\nSome **text**' },
    fields: [{ key: 'content', label: 'Content (markdown + templates)', type: 'textarea' }],
  };
</script>

<script>
  import { t } from '../lib/tpl.js';
  let { props } = $props();
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function inline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/\*([^*]+)\*/g, '<i>$1</i>')
      .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }
  function md(src) {
    const out = [];
    let list = false;
    for (const line of String(src ?? '').split('\n')) {
      const h = line.match(/^(#{1,4})\s+(.*)/);
      const li = line.match(/^\s*[-*]\s+(.*)/);
      if (!li && list) { out.push('</ul>'); list = false; }
      if (h) out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      else if (li) { if (!list) { out.push('<ul>'); list = true; } out.push(`<li>${inline(li[1])}</li>`); }
      else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
    }
    if (list) out.push('</ul>');
    return out.join('');
  }
  // Template output is escaped before markdown formatting, so it can't inject HTML.
  const html = $derived(md(t(props.content)));
  // Centred in the card; only text that's genuinely too long (not just a few
  // pixels of line height) scrolls, from the top and without a scrollbar.
  let el = $state(), long = $state(false);
  $effect(() => {
    if (!el) return;
    html;
    const check = () => (long = el.scrollHeight > el.clientHeight + 10);
    const ro = new ResizeObserver(check);
    ro.observe(el);
    check();
    return () => ro.disconnect();
  });
</script>

<div class="md" class:long bind:this={el}>{@html html}</div>

<style>
  .md { height: 100%; display: flex; flex-direction: column; justify-content: center; line-height: 1.45; }
  .md.long { justify-content: flex-start; overflow-y: auto; scrollbar-width: none; }
  .md::-webkit-scrollbar { display: none; }
  .md > :global(:last-child) { margin-bottom: 0; }
  .md :global(:is(h1, h2, h3, h4)) { line-height: 1.2; }
  .md :global(h1) { font-size: 1.6em; margin: 0 0 .3em; font-weight: 600; }
  .md :global(h2) { font-size: 1.3em; margin: 0 0 .3em; font-weight: 600; }
  .md :global(h3), .md :global(h4) { font-size: 1.05em; margin: 0 0 .3em; }
  .md :global(p) { margin: 0 0 .5em; }
  .md :global(ul) { margin: 0 0 .5em; padding-left: 1.2em; }
  .md :global(code) { background: rgba(255,255,255,.1); padding: 1px 5px; border-radius: 5px; font-size: .9em; }
  .md :global(a) { color: var(--accent); }
</style>
