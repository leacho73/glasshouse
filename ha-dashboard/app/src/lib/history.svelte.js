// History series for graphs, refreshed periodically and extended with live state.
import { history, states, conn } from './ha.svelte.js';

export function useHistory(getIds, getHours) {
  const data = $state({ series: {} });
  $effect(() => {
    const ids = getIds().filter(Boolean);
    const hours = getHours();
    if (!conn.connected || !ids.length) return;
    let alive = true;
    const load = () =>
      history(ids, hours)
        .then((res) => {
          if (!alive) return;
          const out = {};
          for (const id of ids) {
            out[id] = (res[id] || []).map((p) => [(p.lu ?? p.lc) * 1000, Number(p.s)]).filter((p) => !Number.isNaN(p[1]));
          }
          data.series = out;
        })
        .catch(() => {});
    load();
    const timer = setInterval(load, 5 * 60e3);
    return () => { alive = false; clearInterval(timer); };
  });
  // Append the live value so graphs move between refreshes.
  return {
    get series() {
      const out = {};
      for (const [id, pts] of Object.entries(data.series)) {
        const e = states.get(id);
        const v = Number(e?.state);
        out[id] = Number.isNaN(v) ? pts : [...pts, [Date.now(), v]];
      }
      return out;
    },
  };
}
