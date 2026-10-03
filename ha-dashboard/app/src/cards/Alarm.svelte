<script module>
  export const meta = {
    type: 'alarm', name: 'Alarm panel', icon: 'mdi:shield-home', category: 'Controls',
    size: { w: 300, h: 380 }, tap: 'none',
    defaults: { entity: '', keypad: true },
    fields: [
      { key: 'entity', label: 'Alarm', type: 'entity', domain: 'alarm_control_panel' },
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'keypad', label: 'Keypad', type: 'bool' },
    ],
  };
</script>

<script>
  import Icon from '../components/Icon.svelte';
  import { t, ent } from '../lib/tpl.js';
  import { name, stateText } from '../lib/entity.js';
  import { callService } from '../lib/ha.svelte.js';
  let { props } = $props();
  const e = $derived(ent(props.entity));
  let code = $state('');
  const armed = $derived(e?.state?.startsWith('armed') || e?.state === 'triggered');
  const go = (s) => { callService('alarm_control_panel', s, code ? { code } : {}, { entity_id: e.entity_id }); code = ''; };
  const color = $derived(e?.state === 'triggered' ? '#ff5b5b' : armed ? '#ff9f43' : '#5bd88f');
</script>

<div class="al" style="--ac:{color}">
  <div class="head"><Icon icon={armed ? 'mdi:shield-lock' : 'mdi:shield-off-outline'} size="1.8em" style="color:var(--ac)" />
    <div><div class="name">{t(props.name) || name(e)}</div><div class="state">{stateText(e)}</div></div></div>
  <div class="acts" data-stop>
    {#if armed}<button onclick={() => go('alarm_disarm')}>Disarm</button>
    {:else}<button onclick={() => go('alarm_arm_home')}>Home</button><button onclick={() => go('alarm_arm_away')}>Away</button><button onclick={() => go('alarm_arm_night')}>Night</button>{/if}
  </div>
  {#if props.keypad}
    <div class="code">{'•'.repeat(code.length) || ' '}</div>
    <div class="pad" data-stop>
      {#each ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'] as k}
        <button onclick={() => (k === 'C' ? (code = '') : k === '⌫' ? (code = code.slice(0, -1)) : (code += k))}>{k}</button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .al { height: 100%; display: flex; flex-direction: column; gap: 10px; }
  .head { display: flex; align-items: center; gap: 12px; }
  .name { font-weight: 600; }
  .state { color: var(--ac); font-size: .9em; }
  .acts { display: flex; gap: 6px; }
  .acts button { flex: 1; padding: 10px; border-radius: 12px; border: 0; background: color-mix(in srgb, var(--ac) 25%, transparent); color: inherit; font: inherit; font-weight: 600; }
  .code { text-align: center; letter-spacing: .4em; font-size: 1.4em; min-height: 1.4em; }
  .pad { flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .pad button { border-radius: 14px; border: 0; background: rgba(255,255,255,.07); color: inherit; font: inherit; font-size: 1.2em; }
  .pad button:active { background: rgba(255,255,255,.2); }
</style>
