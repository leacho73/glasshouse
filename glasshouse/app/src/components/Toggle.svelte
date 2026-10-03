<script>
  let { on = false, onclick, color = 'var(--on)' } = $props();
</script>

<button class="tg" class:on style="--c:{color}" data-stop {onclick} aria-pressed={on} aria-label="Toggle"><span></span></button>

<style>
  .tg { width: 46px; height: 28px; border-radius: 14px; border: 0; background: rgba(255,255,255,.14); position: relative; flex: none; transition: background .2s; padding: 0; }
  .tg span { position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; transition: transform .2s; box-shadow: 0 1px 4px rgba(0,0,0,.3); }
  .on { background: var(--c); }
  .on span { transform: translateX(18px); }
</style>
