# Relay Chat — single room, no storage

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
3. Chat sends `{type:'chat'}` → server broadcasts to all. No history kept; `users` + `system` events keep presence.

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
npm test   # unit (lib/protocol, src/lib/ui) + live relay integration, zero extra deps
```

## Deploy on Coolify (from repo)

1. Push this folder to a Git repo.
2. Coolify → New Resource → Application → pick repo, Build Pack: **Dockerfile**.
3. Port: `3000`, no env vars needed (respects `$PORT` if Coolify sets it).
4. Deploy — the single container serves both UI (`/`) and WebSocket (`/ws`), no extra config.

Files: `server.js` (relay + static), `src/App.svelte` (UI), `Dockerfile` (build + serve).
