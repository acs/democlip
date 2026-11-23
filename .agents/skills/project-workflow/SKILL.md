---
name: Project workflow
description: How changes are made in DemoClip — one change per pull request, branch and commit conventions, what a pull request body contains (the post-mortem a regression fix carries among it), and that CI owns the version. Use when starting work, committing or opening a pull request, or fixing a regression.
---

# Project workflow

## One change per pull request

A plan's step gets its own branch and its own pull request. Stack pull requests only
when a change genuinely depends on one still open — and if you stack, know that
GitHub retargets a pull request at `main` only when its **base branch is deleted**,
which this repository does automatically on merge (`delete_branch_on_merge`). Three
stacked, merged without checking, put two branches' work in the wrong place and left
`main` without it.

## Branches and commits

- `feat/`, `fix/`, `refactor/`, `chore/`, `docs/` plus a few words:
  `refactor/domain-events`, `fix/seek-as-stall`.
- `main` is written to through pull requests, and by the version bump. Nothing is
  committed to it directly.
- **Commit messages are prose**: what changed and *why*, in the past tense, with the
  reasoning a reader needs in six months, and the honest caveats. Not a file-by-file
  changelog. Read `git log` and match it.

## The pull request body

1. **What and why** — the problem, in the words of whoever reported it, if anyone did.
2. **How it was verified** — the harness output pasted in, the unit tests, and the
   number that mattered (10.8× real time; a duration of 5.36 s). The end-to-end
   suite follows the **one or two checks per feature** rule (the verification
   skill): a fold into a check that exists, never a check per behaviour — a branch
   that grew ten checks for one feature is folded before it is proposed.
3. **A post-mortem, when the change fixes a regression** — see below.
4. **What was deliberately not done**, and why.
5. **Caveats** — what could not be verified, what is a guess, what is a trade.
6. A file table when the change is wider than a couple of files.

The user merges. The agent opens the pull request, reports, and waits.

## A regression carries a post-mortem

A **regression** is something that used to work and does not any more, and the pull
request that fixes it says how it came in — not only what is fixed. Add a
**Post-mortem** section, after *How it was verified*:

- **What introduced it** — the commit of ours, and the pull request or release it
  came in with; or, when it is not ours, the dependency or browser change that moved
  the ground under us (a redesign of Chrome's screen picker), and the assumption of
  ours it landed on.
- **What it did** — the behaviour before and after, and the wrong assumption between
  them, said as the mistake it was: a phase a guard no longer matched, a size read
  before the picture had one, a value assumed set that a rename left unset.
- **Why it was not caught** — the test, harness or review that should have caught it
  and did not: a flow no harness can drive, a rule with no test beside it, a
  behaviour only a real share shows. Plainly — it is what the next change reads.
- **What stops it coming back** — the test, harness or check this change adds, or
  that none does, and why.

It is not blame. A regression is a failure of the process that let it through, and
the next reader needs to know which part failed. When one change introduced several,
each pull request that undoes one names it, so the trail is legible from any of them.

## CI owns the version

Every merge to `main` bumps the patch, tags `vX.Y.Z` and deploys — the workflow
commits that back. Do not bump `package.json` by hand except for a deliberate minor
or major release, done before merging. See `VERSIONING.md`.

## Before pushing

```
npm run lint && npm run typecheck && npx vitest run && npm run build
```

The pre-commit hook runs `eslint --fix` on staged files. Temporary `verify-*.html`
harnesses are deleted before the commit — they are never part of a change.

## Ask when the answer is a product decision

Persistence, an interface change, what a feature should do when it cannot work —
those are the user's calls. Bring the number and the trade to them, and ask.
