<script module>
  import { applianceMeta } from '../lib/appliance.js';
  export const meta = applianceMeta('washer');
</script>

<script>
  import Appliance from '../components/Appliance.svelte';
  let { props, w, h } = $props();
</script>

<Appliance kind="washer" {props} {w} {h} />
