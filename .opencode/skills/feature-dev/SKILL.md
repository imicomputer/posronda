---
name: feature-dev
description: Develop a new feature end-to-end in the PosRonda chat repo with docs-first TDD. Use when the user asks to add a feature, change behavior, fix a bug, or says "implement", "build", "add", "documentation", "test-first", "TDD". Pipeline: analyze, document, design, write failing tests, code to green, review, retest, pull request.
---

# Feature Dev — analyze → document → design → test (red) → code (green) → review → retest → PR

You own the whole task. Phases run strictly in order — never write code
before the doc, never write implementation before its failing test. Keep
changes minimal and in this repo's simple style (see AGENTS.md).

## 0. Prerequisites

- Git repo with an `origin` remote. If none exists, stop and ask the user for
  the GitHub repo URL, then `git remote add origin <url>`.
- `gh` CLI for PR steps (`brew install gh`, then `gh auth login`). If `gh` is
  missing, still do everything up to push, then print the exact manual PR
  commands for the user.

## 1. Analyze

- Read the files the request touches: `server.js` (relay + static hosting),
  `src/App.svelte` (UI), `lib/protocol.js` (shared validation — wire contract),
  `src/lib/ui.js` (pure UI helpers), `src/lib/store.js` (browser persistence),
  `test/*.test.js` (existing coverage).
- State back in one or two sentences what you understood, plus which files
  will change and which tests cover them.

## 2. Document (first artifact — before any design or code)

- Write `docs/features/<short-slug>.md` covering: what + why (2–3 sentences),
  user-visible behavior / UX flow, wire-protocol impact (`join`/`chat`/`system`/
  `users`/`error` shapes), storage impact (server must stay storage-free;
  browser storage goes in `src/lib/store.js`), and acceptance criteria as a
  checkbox list.
- Update the user-facing `README.md` section for the feature (short).
- If the design (next phase) changes any of this, update the doc first —
  the doc is the spec, code follows it, not the reverse.

## 3. Design

- Derive a short technical plan (max 5 bullets) from the doc: approach, files,
  protocol/UI impact, test strategy (which new cases go in
  `test/protocol.test.js` / `test/ui.test.js` / `test/store.test.js` /
  `test/server.test.js`).
- Hard invariants — never break these without explicit user approval:
  1. Messages are relayed only — never stored server-side.
  2. One room, unique usernames, case-insensitive duplicate rejection.
  3. One container serves UI + WS (`/` and `/ws`); Coolify deploys the Dockerfile.
- If the request is ambiguous, ask the user with the question tool before
  writing any test or code.

## 4. Branch

```bash
git checkout main && git pull --ff-only
git checkout -b feat/<short-slug>   # or fix/<short-slug> for bugfixes
```

## 5. Tests first (RED)

- Write the failing tests before any implementation: pure helpers in
  `test/protocol.test.js` / `test/ui.test.js` / `test/store.test.js`
  (inject fakes, never real browser APIs), wire behavior in
  `test/server.test.js` (queued-listener pattern, no hangs).
- Run `npm test` and confirm the new tests FAIL for the right reason
  (missing behavior, not typos). A test that passes before the code exists
  is a bad test — rewrite it.

## 6. Code (GREEN)

- Write the minimal implementation that turns the new tests green: shared
  logic in `lib/protocol.js` / `src/lib/ui.js` / `src/lib/store.js` first;
  `server.js` and `App.svelte` stay thin.
- If the code needs something the doc forbids (or vice versa), stop: update
  `docs/features/<short-slug>.md` first, then continue.
- `npm run build` must succeed (Svelte/Vite production build).

## 7. Review

- Run the `code-review` skill against your branch and fix every blocking
  finding (same invariants checklist, plus: doc matches implementation,
  every new behavior has a test).

## 8. Retest

- After review fixes: full `npm test` (all green) + `npm run build` again.
- If fixes were non-trivial, re-run the `code-review` skill once more.
  Loop review → retest until both are clean. Never hand a red suite to the user.

## 9. Commit + push + pull request

- Stage only intended files — including the feature doc (`git status`,
  `git diff` to verify).
- Conventional message: `feat: ...` / `fix: ...` with a one-line body if needed.
- `git push -u origin feat/<short-slug>`, then:

```bash
gh pr create --fill --title "feat: <what>" --body "- What/why (link docs/features/<slug>.md)
- Tests: new cases in <files>, npm test (N passing), npm run build OK
- Review: code-review clean
- Screenshots for UI changes"
```

- Report the PR URL + review result to the user. Do NOT merge without the
  user saying so.
