---
name: release
description: Cut a release of the relay-chat app. Use when the user says "release", "ship", "cut a version", "deploy to production", or names a version like "v1.1.0". Creates the release branch, verifies everything, merges, tags, and confirms the Coolify deploy.
---

# Release — verify → branch → merge → tag → deploy

You run the release; the user only confirms the version number. Never release
with a red suite or unreviewed changes on `main`.

## 1. Confirm scope

- Ask the user for the version (suggest the next semver from the latest tag:
  `git tag --sort=-v:refname | head -3`) unless they already gave one.
- `git checkout main && git pull --ff-only`; require a clean tree
  (`git status --porcelain` empty) and `gh pr list --state open` showing
  nothing release-blocking.

## 2. Release branch + version bump

```bash
git checkout -b release/vX.Y.Z
# bump "version" in package.json to X.Y.Z, add CHANGELOG entry if one exists
npm test && npm run build
git add package.json && git commit -m "chore(release): vX.Y.Z" && git push -u origin release/vX.Y.Z
gh pr create --title "chore(release): vX.Y.Z" --body "Release candidate. Verified: npm test green, npm run build OK."
```

- Run the `code-review` skill on the release PR (fast-track: checklist only).
- Merge only on user approval: `gh pr merge --squash`, then
  `git checkout main && git pull --ff-only`.

## 3. Tag + production sanity

```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z" && git push origin vX.Y.Z
docker build -t relay-chat:vX.Y.Z .
docker run -d --name relay-smoke -p 3139:3000 relay-chat:vX.Y.Z
curl -s -o /dev/null -w "smoke: %{http_code}\n" http://localhost:3139/
docker rm -f relay-smoke
```

## 4. User testing + deploy gate

- Give the user a 3-step smoke script to run against production: open the app
  twice (two browsers/incognito), join as two names, exchange a message,
  confirm no history after refresh.
- Coolify auto-deploys `main` (Dockerfile, port 3000). Ask the user to confirm
  the Coolify deployment shows green for the merge commit; if it fails, treat
  it as a `fix/` hotfix via the `feature-dev` skill.
- Close with: tag URL, what shipped (1–3 bullets), and deploy status.
