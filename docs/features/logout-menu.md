# Logout menu

## What + why

Give users a visible way to leave the room and erase everything this browser
remembers about them: stored username plus stored chat history. After logout
the app returns to the join popup, so the device is clean for the next person.

## User-visible behavior / UX flow

1. User opens the menu (☰ in the name bar) and picks **Log out**.
2. A confirm dialog asks: "Log out and erase everything on this device?"
   (username + local history). Cancel keeps the session untouched.
3. On confirm:
   - client sends `typing: false` (best-effort, so others clear our indicator),
     then closes the WebSocket — the server drops the name and broadcasts
     `<name> left` + the updated user list to everyone else;
   - `localStorage` username is removed, IndexedDB history is wiped;
   - in-memory state resets: messages, draft, typing map, user list, timers;
   - the join popup appears for a fresh identity (no silent rejoin, because no
     name is remembered anymore).
   - a connection-generation guard suppresses the old socket's late `close`
     event, and any pending auto-reconnect timer is cleared, so there is no
     auto-reconnect/rejoin loop with the old name.
4. The existing **Clear history** action stays as-is (history only, stays
   logged in). It moves into the same menu.

## Wire-protocol impact

None. Logout reuses the existing close path: server already broadcasts
`{type:'system', text:'<name> left'}` + `{type:'users', ...}` on disconnect.
No new message shapes; `join`/`chat`/`system`/`users`/`error` unchanged.

## Storage impact

- Server: none — nothing was stored there; closing the socket only drops the
  live `clients` entry (existing behavior).
- Browser (`src/lib/store.js`): new `wipeLocalData(storage, db)` helper that
  composes the existing `clearStoredUsername` + `clearHistory`. Tolerates a
  missing DB (private mode): username is still cleared, wipe still resolves.

## Acceptance criteria

- [ ] Menu (☰) in the name bar offers **Clear history** and **Log out**.
- [ ] Cancel at the confirm dialog changes nothing (still joined, data kept).
- [ ] Confirm erases stored username (`localStorage`) and all stored messages
  (IndexedDB), clears the screen, frees the name server-side (others see
  `<name> left`), and shows the join popup.
- [ ] After logout there is no auto-reconnect/rejoin loop with the old name.
- [ ] `npm test` green (new cases in `test/store.test.js`), `npm run build`
  passes.
