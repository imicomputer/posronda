# AGENTS.md — PosRonda repo conventions

Simple single-room WebSocket chat. Svelte UI + Node `ws` relay. Keep it simple.

## Commands

- `npm run dev` — frontend :5173 + relay :3000 (WS proxied at /ws)
- `npm test` — unit + live relay integration tests (Node built-in runner, zero deps)
- `npm run build` — production build to `dist/` (must pass before any PR)
- `npm start` — serve `dist/` + WS on `$PORT` (default 3000)

## Architecture

- `server.js` — HTTP static host for `dist/` + WS endpoint at `/ws`. Thin:
  connection tracking, presence broadcasts, relay. No storage.
- `lib/protocol.js` — shared validation + wire-contract helpers, used by BOTH
  server and client. Changing it changes the contract: update client + tests together.
- `src/App.svelte` — whole UI in one component. Pure helpers live in `src/lib/ui.js`.
- `src/lib/store.js` — client persistence only: username in localStorage,
  last 200 messages in IndexedDB. Backends injectable for tests. Server stays storage-free.
- `test/` — `protocol.test.js` + `ui.test.js` (pure units), `server.test.js`
  (boots real server on an ephemeral port, queued-listener pattern, no hangs).
- `Dockerfile` — single container serves UI + WS. Coolify deploys it, port 3000.

## Invariants (never break without explicit user approval)

1. Messages are relayed only — never stored server-side.
2. One room, unique usernames, case-insensitive duplicate rejection.
3. Small deps, small files. Ask before adding a dependency.

## Workflow

Skills in `.opencode/skills/` own the process: `feature-dev` (docs-first TDD:
doc → design → failing tests → code → review → retest → PR),
`code-review` (PR verdicts), `release` (version → tag → deploy). Slash
shortcuts: `/feature`, `/review`, `/release`. Conventional commits
(`feat:`, `fix:`, `chore(release):`). Never merge without being asked.
