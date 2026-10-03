// Address options (?device=, ?fit=, ?kiosk, ?view=, ?noedit). Inside Home Assistant
// we run in an iframe on HA's own origin, so options added to HA's address bar
// (…/glasshouse?view=upstairs) are read from the parent page as well as our own.
function searches() {
  const out = [location.search];
  try {
    if (window.parent !== window) out.push(window.parent.location.search);
  } catch {
    // Not same-origin: only our own address.
  }
  return out;
}

/** The option's value ('' for a bare flag like ?kiosk), or null if absent. */
export function param(name) {
  for (const s of searches()) {
    const v = new URLSearchParams(s).get(name);
    if (v != null) return v;
  }
  return null;
}
