# DemoClip Constitution

The principles of this project are **already written down** — in `.agents/skills/` and
`docs/GLOSSARY.md`. This file does not restate them, because two copies of a rule drift and
then one of them lies. It names them, so that Spec Kit's gates have something to check
a plan against.

## Core Principles

### I. The skills are the constitution

`.agents/skills/` holds how work is done here: **overview** (what the app is, and which
document owns which fact), **domain-model** (where a rule belongs), **verification**
(what counts as proof), **project-workflow** (branches, commits, pull requests) and
**branding** (the mark, the name, the colours). `docs/GLOSSARY.md` holds the words.

A plan or a task list that disagrees with a skill is wrong. Change the skill, in its
own change — never quietly diverge from it.

### II. `src/domain/` is pure

No DOM, no browser API, no import from `ui/` or `infra/`. A rule about a range, a set
of ranges, a take or the clip as a whole lives in a **class** in `src/domain/`; a
collaborator it needs is a port it defines and an adapter implements. An interface is
for data with no rules.

### III. Every rule has a test beside it

A rule in `src/domain/` is proved by a unit test in node, with a fake behind any port.
A refactor's proof is the old tests passing **unmodified** — if they had to change, the
behaviour changed, and that is decided deliberately and said out loud.

### IV. What is drawn, played or encoded is proved in a browser

A temporary `verify-*.html` harness on the dev server, its output pasted into the pull
request, the file deleted before the commit. The recorder's flow — a real screen share —
is the user's to run: no harness can start one, and that is a gap to state rather than
to hide.

### V. The words come first

A new concept is written into `docs/GLOSSARY.md` **before** it appears in code, and the
code, the tests, the commits and the pull request all use those words.

### VI. One change per pull request, and CI owns the version

A plan's step gets its own branch and its own pull request. `main` is written to
through pull requests, and every merge bumps the patch, tags it and deploys —
`package.json` is never bumped by hand except for a deliberate minor or major.

## Development Workflow

A feature is specified, clarified, planned, broken into tasks and implemented:
`/speckit.specify` → `/speckit.clarify` → `/speckit.plan` → `/speckit.tasks` →
`/speckit.implement`. A spec lives in `specs/<NNN>-<name>/` and is committed with the
change it describes. The gates `/speckit.plan` checks are the six principles above.

## Governance

These principles are amended by amending `.agents/skills/` or `docs/GLOSSARY.md`, in their
own pull request. This file is a pointer to them: if it and a skill ever disagree, the
**skill wins**, and this file is the thing to fix.

**Version**: 1.0.0 | **Ratified**: 2026-11-18 | **Last Amended**: 2026-11-18
