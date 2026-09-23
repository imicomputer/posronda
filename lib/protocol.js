// Shared chat protocol helpers — used by server.js AND the Svelte client.
// Pure functions only. Unit tested via `npm test` (test/protocol.test.js).
// Changing these changes the wire contract, so update tests + client together.

export const MAX_NAME = 20;
export const MAX_MSG = 500;
export const USERNAME_RE = /^[A-Za-z0-9_-]{2,20}$/;

/** Trim + cap a raw username input. */
export function normalizeName(input) {
  return String(input ?? '').trim().slice(0, MAX_NAME);
}

/** True if the name may join the room (2–20 chars: letters, digits, _ -). */
export function validUsername(input) {
  return USERNAME_RE.test(normalizeName(input));
}

/** Case-insensitive duplicate check against the live user list. */
export function isTaken(usernames, name) {
  const lower = normalizeName(name).toLowerCase();
  return usernames.some((u) => u && u.toLowerCase() === lower);
}

/** Trim + cap a chat message. Returns '' when there is nothing to relay. */
export function sanitizeChat(input) {
  return String(input ?? '').trim().slice(0, MAX_MSG);
}
