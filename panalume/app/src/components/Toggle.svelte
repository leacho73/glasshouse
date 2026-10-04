<script>
  let { on = false, onclick, color = 'var(--on)' } = $props();
</script>

<button class="tg" class:on style="--c:{color}" data-stop {onclick} aria-pressed={on} aria-label="Toggle"><span></span></button>

<style>
  .tg { width: 2.9em; height: 1.75em; border-radius: .875em; font-size: inherit; border: 0; background: rgba(255,255,255,.14); position: relative; flex: none; transition: background .2s; padding: 0; }
  .tg span { position: absolute; top: .19em; left: .19em; width: 1.37em; height: 1.37em; border-radius: 50%; background: #fff; transition: transform .2s; box-shadow: 0 1px 4px rgba(0,0,0,.3); }
  .on { background: var(--c); }
  .on span { transform: translateX(1.15em); }
</style>
