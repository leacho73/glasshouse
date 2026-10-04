// Shared ticking "now" for countdowns and time markers (one timer for all cards).
export const clock = $state({ now: Date.now() });
setInterval(() => (clock.now = Date.now()), 15000);
