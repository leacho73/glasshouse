// MDI icons fetched by name from the server in small batches and cached locally,
// so the bundle doesn't carry the whole icon set.
import { SvelteMap } from 'svelte/reactivity';

const cache = new SvelteMap();
const LS = 'hd-icons';
let stored = {};
try { stored = JSON.parse(localStorage.getItem(LS) || '{}'); } catch {}
for (const [k, v] of Object.entries(stored)) cache.set(k, v);

let queue = new Set();
let timer;
const requested = new Set(Object.keys(stored));

function flush() {
  const names = [...queue];
  queue = new Set();
  fetch('api/icons?n=' + encodeURIComponent(names.join(',')))
    .then((r) => r.json())
    .then((res) => {
      for (const [k, v] of Object.entries(res)) {
        cache.set(k, v || '');
        stored[k] = v || '';
      }
      try { localStorage.setItem(LS, JSON.stringify(stored)); } catch {}
    })
    .catch(() => names.forEach((n) => requested.delete(n)));
}

export function iconPath(name) {
  if (!name) return '';
  if (!requested.has(name)) {
    requested.add(name);
    queue.add(name);
    clearTimeout(timer);
    timer = setTimeout(flush, 10);
  }
  return cache.get(name) || '';
}

let names;
export async function iconNames() {
  names ??= fetch('api/icon-names').then((r) => r.json());
  return names;
}
