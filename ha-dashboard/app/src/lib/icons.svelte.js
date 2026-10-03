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

// Other icon sets (tabler:, mingcute:, solar:… as used by ha-fusion) come from the
// Iconify API, batched per prefix and cached like MDI.
const iconify = new SvelteMap();
const IFY = 'hd-iconify';
let ifyStored = {};
try { ifyStored = JSON.parse(localStorage.getItem(IFY) || '{}'); } catch {}
for (const [k, v] of Object.entries(ifyStored)) iconify.set(k, v);
const ifyReq = new Set(Object.keys(ifyStored));
let ifyQueue = new Map();
let ifyTimer;

function ifyFlush() {
  const q = ifyQueue;
  ifyQueue = new Map();
  for (const [prefix, names] of q) {
    fetch(`https://api.iconify.design/${prefix}.json?icons=${[...names].join(',')}`)
      .then((r) => r.json())
      .then((res) => {
        for (const n of names) {
          const ic = res.icons?.[n] || (res.aliases?.[n] && res.icons?.[res.aliases[n].parent]);
          const v = ic ? { b: ic.body, w: ic.width || res.width || 24, h: ic.height || res.height || 24 } : null;
          iconify.set(`${prefix}:${n}`, v);
          ifyStored[`${prefix}:${n}`] = v;
        }
        try { localStorage.setItem(IFY, JSON.stringify(ifyStored)); } catch {}
      })
      .catch(() => names.forEach((n) => ifyReq.delete(`${prefix}:${n}`)));
  }
}

export function iconSvg(name) {
  if (!ifyReq.has(name)) {
    ifyReq.add(name);
    const [prefix, n] = name.split(':');
    if (!ifyQueue.has(prefix)) ifyQueue.set(prefix, new Set());
    ifyQueue.get(prefix).add(n);
    clearTimeout(ifyTimer);
    ifyTimer = setTimeout(ifyFlush, 10);
  }
  return iconify.get(name);
}
