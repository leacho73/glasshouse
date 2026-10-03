// Any string setting may be an HA template ({{ }} / {% %}); it's rendered live by HA.
import { renderTemplate, states } from './ha.svelte.js';

export const isTpl = (v) => typeof v === 'string' && (v.includes('{{') || v.includes('{%'));

/** Resolve a possibly-templated value. */
export function t(v) {
  if (!isTpl(v)) return v;
  return renderTemplate(v) ?? '';
}

/** Entity state object for a (possibly templated) entity id. */
export function ent(id) {
  const v = t(id);
  return v ? states.get(String(v).trim()) : undefined;
}

export const truthy = (v) => !['false', '0', 'off', 'no', 'none', ''].includes(String(v ?? '').trim().toLowerCase());
