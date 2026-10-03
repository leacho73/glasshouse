<script>
  // Touch-friendly slider: shows the live value while dragging, commits on release.
  let { value = 0, min = 0, max = 100, step = 1, onchange, vertical = false, color = 'var(--accent)', label = '', disabled = false, height = 44 } = $props();
  let el;
  let drag = $state(null);
  const shown = $derived(drag ?? value ?? min);
  const pct = $derived(((shown - min) / (max - min || 1)) * 100);

  function valueAt(e) {
    const r = el.getBoundingClientRect();
    const f = vertical ? 1 - (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
    const v = min + Math.min(1, Math.max(0, f)) * (max - min);
    return Math.round(v / step) * step;
  }
  function down(e) {
    if (disabled) return;
    e.stopPropagation();
    el.setPointerCapture(e.pointerId);
    drag = valueAt(e);
  }
  function move(e) { if (drag != null) drag = valueAt(e); }
  function up() {
    if (drag == null) return;
    const v = drag;
    onchange?.(Number(v.toFixed(5)));
    setTimeout(() => (drag = null), 600);
  }
</script>

<div bind:this={el} class="slider" class:vertical class:disabled data-stop role="slider" aria-valuenow={shown} aria-valuemin={min} aria-valuemax={max} tabindex="-1"
  style="--c:{color};--h:{height / 16}em" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}>
  <div class="fill" style={vertical ? `height:${pct}%` : `width:${pct}%`}></div>
  {#if label}<span class="lbl">{label}</span>{/if}
</div>

<style>
  .slider { position: relative; height: var(--h); border-radius: calc(var(--h) / 3); background: rgba(255,255,255,.08); overflow: hidden; touch-action: none; cursor: pointer; }
  .slider.vertical { height: 100%; width: var(--h); }
  .slider.disabled { opacity: .4; }
  .fill { position: absolute; left: 0; bottom: 0; top: 0; background: var(--c); opacity: .85; transition: width .15s, height .15s; }
  .vertical .fill { top: auto; right: 0; }
  .lbl { position: absolute; inset: 0; display: flex; align-items: center; padding: 0 14px; font-size: .85em; font-weight: 600; pointer-events: none; mix-blend-mode: normal; text-shadow: 0 1px 3px rgba(0,0,0,.4); }
</style>
