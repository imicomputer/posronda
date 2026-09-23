// Pure UI helpers for the Svelte client.
// Unit tested via `npm test` (test/ui.test.js).

/** Stable avatar color per username. */
export function colorOf(name) {
  let h = 0;
  for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 65% 55%)`;
}

/** "14:05" style timestamp for chat bubbles. */
export function fmtTime(t) {
  return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
