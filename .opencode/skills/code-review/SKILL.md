---
name: code-review
description: Review a pull request in the relay-chat repo. Use when the user says "review", "check the PR", "is this ready to merge", or after feature-dev opens a PR. Reads the diff, runs tests, and posts an approve or request-changes review.
---

# Code Review — diff → verify → verdict

Review PRs strictly but fairly. You may read and run anything; do not push
code to the PR branch unless the user asked for fixes.

## 1. Gather context

```bash
gh pr view <number> --json title,body,baseRefName,headRefName,statusCheckRollup
gh pr diff <number>
git fetch origin && git checkout <head-branch>   # review the actual code
```

If no number is given, use `gh pr list` and ask the user which PR, or review
the current branch against `main` with `git diff main...HEAD`.

## 2. Checklist (fail the review if any box fails)

- [ ] `npm test` green on the PR branch (run it yourself).
- [ ] `npm run build` succeeds (run it yourself).
- [ ] **Relay-only invariant**: no message history stored server-side
      (no arrays/maps accumulating chat, no DB, no log-to-disk of chat).
- [ ] Single room, unique usernames still enforced case-insensitively.
- [ ] Wire contract intact: `join`/`joined`/`chat`/`system`/`users`/`error`
      shapes unchanged, or client + server + tests updated together.
- [ ] Shared helpers live in `lib/protocol.js` / `src/lib/ui.js` with tests;
      no logic duplicated between server and client.
- [ ] No secrets, no new heavy dependencies without justification.
- [ ] Dockerfile still builds the single-container image (only re-verify with
      `docker build` if Docker-related files changed).

## 3. Verdict

- Post it on the PR so it is recorded:
  - Approve: `gh pr review <number> --approve --body "<summary + test evidence>"`
  - Request changes: `gh pr review <number> --request-changes --body "<blocking issues>"`
  - Non-blocking nits: `gh pr comment <number> --body "<nits>"`
- Report to the user: verdict, blocking issues (with `file:line` refs), test
  evidence (`npm test`: N passing, build OK), and the safe merge command
  (`gh pr merge <number> --squash`) — but never merge unless asked.
- If `gh` is not installed, print the checklist results and the exact commands
  for the user to run after `brew install gh` + `gh auth login`.
