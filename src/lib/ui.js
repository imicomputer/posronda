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

/** How long a remote typist stays visible without a refresh (ms). */
export const TYPING_TTL = 5000;

/** Human line for who is typing (others only, already filtered). */
export function typingText(names) {
  const list = [...names];
  if (list.length === 0) return '';
  if (list.length === 1) return `${list[0]} is typing…`;
  if (list.length === 2) return `${list[0]} and ${list[1]} are typing…`;
  return 'Several people are typing…';
}

/** Drop stale entries from a { username: timestamp } typing map. Pure. */
export function pruneTyping(map, now = Date.now(), ttl = TYPING_TTL) {
  const out = {};
  for (const [name, ts] of Object.entries(map || {})) {
    if (now - ts <= ttl) out[name] = ts;
  }
  return out;
}
