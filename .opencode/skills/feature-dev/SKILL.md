---
name: feature-dev
description: Develop a new feature end-to-end in the PosRonda chat repo. Use when the user asks to add a feature, change behavior, fix a bug, or says "implement", "build", "add". Covers analyze, design, branch, code, test, commit, push, and pull request.
---

# Feature Dev — analyze → design → code → test → PR

You own the whole task. Work through every phase in order; do not skip testing
or the pull request. Keep changes minimal and in this repo's simple style
(see AGENTS.md).

## 0. Prerequisites

- Git repo with an `origin` remote. If none exists, stop and ask the user for
  the GitHub repo URL, then `git remote add origin <url>`.
- `gh` CLI for PR steps (`brew install gh`, then `gh auth login`). If `gh` is
  missing, still do everything up to push, then print the exact manual PR
  commands for the user.

## 1. Analyze

- Read the files the request touches: `server.js` (relay + static hosting),
  `src/App.svelte` (UI), `lib/protocol.js` (shared validation — wire contract),
  `src/lib/ui.js` (pure UI helpers), `test/*.test.js` (existing coverage).
- State back in one or two sentences what you understood, plus which files
  will change and which tests cover them.

## 2. Design

- Write a short plan (max 5 bullets): approach, wire-protocol impact
  (`join`/`chat`/`system`/`users`/`error` message shapes), UI impact.
- Hard invariants — never break these without explicit user approval:
  1. Messages are relayed only, never stored server-side.
  2. Single room, unique usernames (case-insensitive).
  3. One container serves UI + WS (`/` and `/ws`); Coolify deploys the Dockerfile.
- If the request is ambiguous, ask the user with the question tool before coding.

## 3. Branch

```bash
git checkout main && git pull --ff-only
git checkout -b feat/<short-slug>   # or fix/<short-slug> for bugfixes
```

## 4. Code

- Shared logic goes in `lib/protocol.js` or `src/lib/ui.js` first (both are
  unit-tested); `server.js` and `App.svelte` stay thin.
- If `lib/protocol.js` changes, update `test/protocol.test.js` and check the
  Svelte client still matches the wire contract.

## 5. Test (all three, every time)

```bash
npm test          # 19+ tests: node:test unit + live relay integration
npm run build     # Svelte/Vite production build must succeed
```

- Add tests for the new behavior: pure helpers in `test/protocol.test.js` /
  `test/ui.test.js`, wire behavior in `test/server.test.js`.
- If anything fails, fix and re-run until green. Never hand a red suite to the user.

## 6. Commit + push

- Stage only intended files (`git status`, `git diff` to verify).
- Conventional message: `feat: ...` / `fix: ...` with a one-line body if needed.
- `git push -u origin feat/<short-slug>`

## 7. Pull request

```bash
gh pr create --fill --title "feat: <what>" --body "- What/why
- How tested: npm test (N passing), npm run build OK
- Screenshots for UI changes"
```

- Then run the `code-review` skill on your own PR, fix findings, and report
  the PR URL + review result to the user. Do NOT merge without the user
  saying so.
