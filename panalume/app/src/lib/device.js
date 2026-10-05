// "Device" switcher for cards with many entities: the entities' shared object-id
// prefix (sensor.x1c_print_status, sensor.x1c_bed_temperature → "x1c_") is swapped
// for another device's that has the same entities (p1s_…).
import { states } from './ha.svelte.js';

const split = (id) => { const i = id.indexOf('.'); return [id.slice(0, i), id.slice(i + 1)]; };
const isId = (v) => typeof v === 'string' && /^[a-z_]+\.[a-z0-9_]+$/.test(v);

/** Every entity id the card's entity fields hold, as [key, index | null, id]. */
function refs(props, fields) {
  const out = [];
  for (const f of fields) {
    const v = props[f.key];
    if (f.type === 'entity' && isId(v)) out.push([f.key, null, v]);
    if (f.type === 'entities' && Array.isArray(v)) v.forEach((x, i) => isId(x) && out.push([f.key, i, x]));
  }
  return out;
}

function commonPrefix(objs) {
  let p = objs[0];
  for (const o of objs) while (!o.startsWith(p)) p = p.slice(0, p.lastIndexOf('_', p.length - 2) + 1);
  return p;
}

// Longest shared start of the friendly names, cut at a word: "Workshop P1S".
export function nameOf(ids) {
  const ns = ids.map((id) => states.get(id)?.attributes.friendly_name).filter(Boolean);
  if (!ns.length) return '';
  let p = ns[0];
  for (const n of ns) while (p && !(n === p || n.startsWith(p + ' '))) p = p.includes(' ') ? p.slice(0, p.lastIndexOf(' ')) : '';
  return p;
}

/** The card's current device and the others it could switch to, or null. */
export function devices(props, fields) {
  const rs = refs(props, fields);
  if (rs.length < 3) return null;
  const parts = rs.map(([, , id]) => split(id));
  const prefix = commonPrefix(parts.map(([, o]) => o));
  if (!prefix || !prefix.endsWith('_')) return null;
  const tails = parts.map(([d, o]) => [d, o.slice(prefix.length)]);
  const hits = new Map();
  for (const id of states.keys()) {
    const [d, o] = split(id);
    for (const [td, tail] of tails) {
      if (td !== d || !tail || !o.endsWith('_' + tail)) continue;
      const p = o.slice(0, o.length - tail.length);
      if (p !== prefix) hits.set(p, (hits.get(p) || 0) + 1);
    }
  }
  const need = Math.max(2, Math.ceil(tails.length / 2));
  const others = [...hits].filter(([, n]) => n >= need).sort((a, b) => b[1] - a[1]).slice(0, 12)
    .map(([p]) => ({ prefix: p, name: nameOf(tails.map(([d, t]) => `${d}.${p}${t}`).filter((id) => states.has(id))) || p.replace(/_$/, '') }));
  if (!others.length) return null;
  return { prefix, name: nameOf(rs.map(([, , id]) => id)) || prefix.replace(/_$/, ''), others };
}

/** Point every entity at the other device; ones it doesn't have are cleared. Returns how many were cleared. */
export function switchDevice(props, fields, from, to) {
  let missing = 0;
  for (const [key, i, id] of refs(props, fields)) {
    const [d, o] = split(id);
    if (!o.startsWith(from)) continue;
    const next = `${d}.${to}${o.slice(from.length)}`;
    const ok = states.has(next);
    if (!ok) missing++;
    if (i == null) props[key] = ok ? next : '';
    else props[key][i] = ok ? next : null;
  }
  for (const f of fields) if (f.type === 'entities' && Array.isArray(props[f.key])) props[f.key] = props[f.key].filter((x) => x != null);
  return missing;
}
