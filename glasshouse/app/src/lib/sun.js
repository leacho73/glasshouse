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
