---
description: Build a feature end-to-end, docs-first TDD (document, design, failing tests, code, review, retest, PR).
---

Run the `feature-dev` skill pipeline for this request: $ARGUMENTS

Follow every phase in order — analyze, document (`docs/features/<slug>.md` + README),
design, branch, failing tests first, code to green, `code-review` skill, retest
(`npm test` + `npm run build`) until clean, commit, push, pull request.
Report the PR URL at the end.
