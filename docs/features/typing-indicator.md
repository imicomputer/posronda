# Typing indicator

## What + why

Show who else is currently typing so conversations feel live and people avoid
talking over each other. Typing state is ephemeral presence (like the online
list): relayed to the room, never stored anywhere.

## User-visible behavior / UX flow

1. User types in the composer input → client sends `typing: true` (throttled,
   resends at most every ~2s while typing continues).
2. User stops (input empty, message sent, or ~3s of no input) → client sends
   `typing: false`.
3. Other clients show a small line above the composer: `Alice is typing…`,
   `Alice and Bob are typing…`, or `Several people are typing…` (3+).
4. Indicator auto-clears per user after ~5s without a refresh (handles
   disconnects / lost `stop` events). The typer never sees their own indicator.
5. Typing state is not persisted: reloads and history restores never show stale
   typists.

## Wire-protocol impact

Existing shapes unchanged: `join` / `joined` / `chat` / `system` / `users` /
`error`.

New messages (client → server, then server → room):

- Client sends: `{ type: 'typing', typing: true | false }`
  - `typing` must be a boolean; anything else is ignored (no error reply).
  - Requires prior `join`; pre-join `typing` gets `{ type: 'error',
    message: 'Join first.' }` like `chat`.
- Server broadcasts: `{ type: 'typing', username: '<sender>', typing: true | false,
  time: <ms-epoch> }`
  - Broadcast to **all** clients including the sender (client filters self out,
    same as `chat` echo convention); no storage, relay only.

## Storage impact

- Server: none — typing events are relayed only, never stored (invariant #1).
- Browser (`src/lib/store.js`): none — typing state is in-memory only in
  `App.svelte`, never written to localStorage or IndexedDB.

## Acceptance criteria

- [ ] Typing in the composer sends throttled `typing: true`; stopping/sending
  sends `typing: false`.
- [ ] Other clients render `X is typing…` / `X and Y are typing…` /
  `Several people are typing…`; typer does not see self.
- [ ] Stale typists expire after ~5s without refresh; `chat` from a user clears
  their typing state.
- [ ] Pre-join `typing` is rejected with `Join first.`; non-boolean `typing`
  is ignored.
- [ ] `npm test` green (new cases in `protocol` / `ui` / `server` tests),
  `npm run build` passes.
