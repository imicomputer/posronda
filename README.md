# PosRonda — single room, no storage

Simple WebSocket chat: Svelte UI + Node `ws` relay. Messages are forwarded to everyone in the room and never stored.

## Run locally

```bash
npm install
npm run dev        # frontend :5173 + relay :3000 (open http://localhost:5173)
# or separately:
# npm run dev:server  +  npm run dev:client
npm run build && npm start  # production on :3000
```

## How it works

1. Open the app → SweetAlert asks for a username (`2–20 chars: A-Z, 0-9, _ -`).
2. Client sends `{type:'join'}`. Server rejects duplicates with `{type:'error'}` → popup re-asks.
3. Chat sends `{type:'chat'}` → server broadcasts to all. No history kept; `users` + `system` events keep presence, `typing` events drive the typing indicator.

## Continuing a conversation (browser storage)

The server still stores nothing. Your browser keeps what is needed to pick up
where you left off:

| What | Where | Why there |
|---|---|---|
| Username | `localStorage` (`posronda.username`) | tiny + synchronous — rejoin happens silently on return; if the name is taken now, the popup asks again |
| Last 200 messages | `IndexedDB` (`posronda` → `messages`) | async + larger quota — restored on load with a "Restored N messages" note; oldest pruned past 200 |
| Online users | nowhere | presence is live — a stored list would be stale |

Use the ☰ menu next to your name: **clear history** wipes this browser's
message copy (username is kept), **log out** erases username + history,
leaves the room, and shows the join popup again. Private mode etc.: chat
still works, history just won't persist. See `docs/features/logout-menu.md`.

## Typing indicator

Start typing and others see `Alice is typing…` above the composer (two names
shown, `Several people are typing…` for 3+). State is ephemeral presence —
relayed over WS as `{type:'typing'}`, never stored on the server or in the
browser, and auto-clears after ~5s. See `docs/features/typing-indicator.md`.

## Develop with prompts (opencode skills)

This repo ships AI skills so you can drive development by prompt:

| Prompt | What the agent does |
|---|---|
| `/feature add typing indicator` | analyze → design → branch → code → `npm test` + build → push → open PR → self-review |
| `/review 12` (or "review the PR") | diff + run tests + post approve/request-changes |
| `/release 1.1.0` | verify → release branch → merge → tag → smoke-test → Coolify deploy check |

Skills live in `.opencode/skills/`, shortcuts in `.opencode/commands/`.
Restart opencode after pulling skill changes. PR steps need the `gh` CLI
(`brew install gh` + `gh auth login`).

## Tests

```bash
npm test   # unit (lib/protocol, src/lib/ui, src/lib/store) + live relay integration, zero extra deps
```

## Deploy on Coolify (from repo)

1. Push this folder to a Git repo.
2. Coolify → New Resource → Application → pick repo, Build Pack: **Dockerfile**.
3. Port: `3000`, no env vars needed (respects `$PORT` if Coolify sets it).
4. Deploy — the single container serves both UI (`/`) and WebSocket (`/ws`), no extra config.

Files: `server.js` (relay + static), `src/App.svelte` (UI), `lib/protocol.js` + `src/lib/` (shared helpers), `docs/features/` (per-feature specs), `Dockerfile` (build + serve).

### Forked
2026-09-24
