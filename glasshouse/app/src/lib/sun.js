// Sun position and times for a place, worked out locally (accurate to about a
// minute) so the card can draw the whole day's path, not just HA's "next" times.
const R = Math.PI / 180;

/** Sun elevation in degrees at time t (ms) for lat / lon in degrees. */
export function elevation(t, lat, lon) {
  const d = t / 864e5 - 10957.5; // days since J2000
  const g = (357.529 + 0.98560028 * d) * R;
  const L = (280.459 + 0.98564736 * d + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * R;
  const e = (23.439 - 0.00000036 * d) * R;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const h = (gmst * 15 + lon) * R - ra;
  const la = lat * R;
  return Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(h)) / R;
}

const STEP = 5 * 60e3;

/** The day containing `t` (local midnight to midnight): elevation samples and its events. */
export function sunDay(t, lat, lon, height = 0) {
  const start = new Date(t); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const pts = [];
  for (let x = +start; x <= +end; x += STEP) pts.push([x, elevation(x, lat, lon)]);
  // Times the sun crosses `deg` going up / down, interpolated between samples.
  const cross = (deg, up) => {
    for (let i = 1; i < pts.length; i++) {
      const [t0, a] = pts[i - 1], [t1, b] = pts[i];
      if (up ? a < deg && b >= deg : a >= deg && b < deg) return t0 + ((deg - a) / (b - a)) * (t1 - t0);
    }
    return null;
  };
  let noon = pts[0];
  for (const p of pts) if (p[1] > noon[1]) noon = p;
  for (let x = noon[0] - STEP; x <= noon[0] + STEP; x += 30e3) { const v = elevation(x, lat, lon); if (v > noon[1]) noon = [x, v]; }
  // Refraction and the sun's size, plus the lower horizon seen from higher ground (as HA does).
  const dip = 0.0347 * Math.sqrt(Math.max(0, height || 0));
  const h0 = -0.833 - dip;
  const rise = cross(h0, true), set = cross(h0, false);
  return {
    start: +start, end: +end, pts,
    rise, set, dawn: cross(-6 - dip, true), dusk: cross(-6 - dip, false),
    noon: noon[0], maxElev: noon[1], minElev: Math.min(...pts.map((p) => p[1])),
    length: rise && set ? set - rise : noon[1] > 0 ? 864e5 : 0,
  };
}

// ---- Moon (after suncalc, accurate to a few minutes for rise and set) ----
const E = 23.4397 * R;
function moonCoords(d) {
  const L = R * (218.316 + 13.176396 * d), M = R * (134.963 + 13.064993 * d), F = R * (93.272 + 13.22935 * d);
  const l = L + R * 6.289 * Math.sin(M), b = R * 5.128 * Math.sin(F);
  return {
    ra: Math.atan2(Math.sin(l) * Math.cos(E) - Math.tan(b) * Math.sin(E), Math.cos(l)),
    dec: Math.asin(Math.sin(b) * Math.cos(E) + Math.cos(b) * Math.sin(E) * Math.sin(l)),
    dist: 385001 - 20905 * Math.cos(M),
  };
}
function sunCoords(d) {
  const M = R * (357.5291 + 0.98560028 * d);
  const C = R * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const l = M + C + R * 102.9372 + Math.PI;
  return { ra: Math.atan2(Math.sin(l) * Math.cos(E), Math.cos(l)), dec: Math.asin(Math.sin(E) * Math.sin(l)) };
}
const refraction = (h) => { h = Math.max(0, h); return 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179)); };

/** Moon altitude in degrees (with refraction) at time t. */
export function moonElevation(t, lat, lon) {
  const d = t / 864e5 - 10957.5;
  const c = moonCoords(d);
  const H = R * (280.16 + 360.9856235 * d) + lon * R - c.ra;
  const la = lat * R;
  const h = Math.asin(Math.sin(la) * Math.sin(c.dec) + Math.cos(la) * Math.cos(c.dec) * Math.cos(H));
  return (h + refraction(h)) / R;
}

/** How much of the moon is lit (0–1) and where it is in its cycle (0 new, .5 full). */
export function moonPhase(t) {
  const d = t / 864e5 - 10957.5;
  const s = sunCoords(d), m = moonCoords(d), sdist = 149598000;
  const phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
  const inc = Math.atan2(sdist * Math.sin(phi), m.dist - sdist * Math.cos(phi));
  const angle = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra), Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
  const phase = 0.5 + (0.5 * inc * (angle < 0 ? -1 : 1)) / Math.PI;
  return { fraction: (1 + Math.cos(inc)) / 2, phase };
}
/** The phase's everyday name, from how much is lit and whether it's growing. */
export function moonName(p, f) {
  const waxing = p < 0.5;
  return f < 0.03 ? 'New moon' : f > 0.97 ? 'Full moon' : f >= 0.44 && f <= 0.56 ? (waxing ? 'First quarter' : 'Last quarter')
    : f < 0.5 ? (waxing ? 'Waxing crescent' : 'Waning crescent') : waxing ? 'Waxing gibbous' : 'Waning gibbous';
}

/** The moon over the day containing `t`: altitude samples, rise and set (either can be missing). */
export function moonDay(t, lat, lon) {
  const start = new Date(t); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const pts = [];
  for (let x = +start; x <= +end; x += STEP) pts.push([x, moonElevation(x, lat, lon)]);
  const h0 = 0.133;
  let rise = null, set = null;
  for (let i = 1; i < pts.length; i++) {
    const [t0, a] = pts[i - 1], [t1, b] = pts[i];
    const at = t0 + ((h0 - a) / (b - a)) * (t1 - t0);
    if (rise == null && a < h0 && b >= h0) rise = at;
    if (set == null && a >= h0 && b < h0) set = at;
  }
  return { pts, rise, set, maxElev: Math.max(...pts.map((p) => p[1])), minElev: Math.min(...pts.map((p) => p[1])) };
}
