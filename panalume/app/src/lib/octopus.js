// Helpers for the Octopus Energy (BottlecapDave) integration's entities.
import { states } from './ha.svelte.js';

/** First entity id matching the regex (used to auto-fill new cards). */
export function find(re) {
  for (const id of states.keys()) if (re.test(id)) return id;
  return '';
}

export const ts = (v) => (v ? Date.parse(v) : NaN);

export const pence = (gbp, d = 1) => (gbp == null || isNaN(gbp) ? '—' : (gbp * 100).toFixed(d) + 'p');

export function money(v) {
  const n = Number(v);
  return isNaN(n) ? '—' : '£' + n.toFixed(2);
}

/** Half-hourly rates [{start,end,value}] from one or more *_day_rates event entities. */
export function rates(...ids) {
  const out = [];
  const seen = new Set();
  for (const id of ids) {
    for (const r of states.get(id)?.attributes.rates || []) {
      const s = ts(r.start);
      if (seen.has(s)) continue;
      seen.add(s);
      out.push({ start: s, end: ts(r.end), value: r.value_inc_vat, ...(r.is_intelligent_adjusted ? { adjusted: true } : {}) });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Merge contiguous slots into periods. */
export function merge(list) {
  const out = [];
  for (const d of [...list].sort((a, b) => a.start - b.start)) {
    const last = out[out.length - 1];
    if (last && d.start <= last.end) { last.end = Math.max(last.end, d.end); last.kwh = (last.kwh || 0) + (d.kwh || 0); }
    else out.push({ ...d });
  }
  return out;
}

export function dispatches(id) {
  const a = states.get(id)?.attributes || {};
  const map = (l) => (l || []).map((d) => ({ start: ts(d.start), end: ts(d.end), kwh: Math.abs(d.charge_in_kwh || 0), source: d.source }));
  return { planned: map(a.planned_dispatches), completed: map(a.completed_dispatches), a };
}

/** All Octoplus sessions across the event entities, normalised and sorted. */
export function sessions({ saving, powerdown, powerup, free }) {
  const out = [];
  const add = (kind, ev, extra) => out.push({ kind, id: ev.id, code: ev.code, start: ts(ev.start), end: ts(ev.end), ...extra, points: ev.rewarded_octopoints, perKwh: ev.octopoints_per_kwh });
  for (const [kind, id] of [['saving', saving], ['powerdown', powerdown]]) {
    const a = states.get(id)?.attributes;
    if (!a) continue;
    for (const ev of a.joined_events || []) add(kind, ev, { joined: true });
    for (const ev of a.available_events || []) add(kind, ev, { joined: false, joinable: true });
  }
  for (const ev of states.get(free)?.attributes.events || []) add('free', ev, { joined: true });
  const pu = states.get(powerup)?.attributes;
  if (pu) {
    for (const ev of pu.available_events || []) add('powerup', ev, { joined: ev.availability !== 'AVAILABLE', available: ev.availability });
    for (const ev of pu.events || []) add('powerup', ev, { joined: true });
  }
  // Dedupe (power-down events sometimes mirror saving sessions).
  const seen = new Set();
  return out
    .filter((s) => { const k = (s.kind === 'saving' || s.kind === 'powerdown' ? 'sp' : 'fp') + s.start; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a.start - b.start);
}

export const KIND = {
  saving: { label: 'Saving Session', plural: 'saving sessions', icon: 'mdi:piggy-bank', color: '#ff7a90', service: 'join_octoplus_saving_session_event' },
  powerdown: { label: 'Power Down', plural: 'power-downs', icon: 'mdi:arrow-down-bold-circle', color: '#ff9f43', service: 'join_octoplus_power_down_session_event' },
  powerup: { label: 'Power Up', plural: 'power-ups', icon: 'mdi:arrow-up-bold-circle', color: '#5bd88f' },
  free: { label: 'Free Electricity', plural: 'free sessions', icon: 'mdi:gift', color: '#4fd1d9' },
  dispatch: { label: 'Intelligent dispatch', icon: 'mdi:ev-station', color: '#b48cff' },
};

export function until(t, now) {
  const m = Math.round((t - now) / 60000);
  if (Math.abs(m) < 60) return `${m}m`;
  const h = Math.floor(Math.abs(m) / 60), r = Math.abs(m) % 60;
  if (h < 24) return `${h}h${r ? ' ' + r + 'm' : ''}`;
  return `${Math.round(h / 24)}d`;
}

export const hm = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
export const day = (t, now = Date.now()) => {
  const d = new Date(t), n = new Date(now);
  const diff = Math.round((new Date(d.toDateString()) - new Date(n.toDateString())) / 864e5);
  return diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
};

/** Colour for a unit rate (GBP/kWh). */
export function rateColor(v, { cheap = 0.1, peak = 0.25 } = {}) {
  if (v <= 0) return '#4fd1d9';
  if (v <= cheap) return '#5bd88f';
  if (v >= peak) return '#ff7a90';
  return '#ffc861';
}

// myenergi: the hub's "power charging" adds up every Zappi and Eddi (e.g. a 7 kW
// car charge plus a 3 kW immersion reads 10 kW). Prefer the device's own reading.
export const HUB_CHARGING = /^sensor\.myenergi_hub_.+_power_charging/;
/** Template listing every Zappi / Eddi's own power sensor (so the dashboard can watch them). */
export const MYENERGI_OWN = "{{ states.sensor | map(attribute='entity_id') | select('match', 'sensor[.]myenergi_(zappi|eddi)_[0-9]+_power_ct_internal_load$') | join(',') }}";
export function myenergiPower(id, device = 'zappi', hint = '') {
  if (!id || !HUB_CHARGING.test(id)) return id;
  const serial = String(hint).match(new RegExp(`myenergi_${device}_(\\d+)`))?.[1];
  const own = [...states.keys()].find((k) => new RegExp(`^sensor\\.myenergi_${device}_${serial || '\\d+'}_power_ct_internal_load$`).test(k));
  return own || id;
}
