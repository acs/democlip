# Implementation Plan: Projects

**Branch**: `feat/projects` | **Date**: 2026-11-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-projects/spec.md`

## Summary

Projects give DemoClip a durable library: a project holds a purpose (name, motivation,
objectives), a default profile, and every recording made for it. The app is always in a
project — the built-in **Default** until the person selects another — and a recording is
finished when its clip session ends. A recording starts under its project's default
profile and may use another profile, chosen before capture; whichever profile is in force
locks what it declares, exactly as today, and the recording snapshots that configuration
so a later profile edit never reaches work already made.

Technically the change replaces the single-slot clip store with a **recording store** of
many recordings in IndexedDB, adds a **project book** in localStorage beside the profile
book, gives `Clip` a profile snapshot and a session-lifecycle owner for the open recording,
and extends the bounded automation surface and MCP tool list with project operations that
organise but never destroy. The existing kept clip is adopted by the Default project in an
atomic, idempotent migration.

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), ES modules; Vite 8 builds the app; Node 22 runs the tools and the MCP server.

**Primary Dependencies**: No new runtime dependency. Existing: `mediabunny` (offline encoding, untouched), `@atproto/oauth-client-browser` (untouched). Dev/test: Vitest 5, Playwright 1.65, ESLint 10.

**Storage**: IndexedDB `democlip` for recordings — one **meta** record per recording (small: cuts, annotations, properties, profile snapshot, project, duration), **takes** and **images** keyed by recording id; localStorage for the **project book** (`democlip_projects`) and the existing profile book (`democlip_profiles`) and theme.

**Testing**: Vitest in node beside every domain and application rule; Playwright checks under `e2e/checks/` for the drawn flows; the MCP server's own Vitest suite for the tool list and tool calls.

**Target Platform**: Modern browsers (Chrome, Firefox, Safari), installed as a PWA, offline; nothing leaves the machine.

**Project Type**: Single-page web app (`src/`, `web/`) plus the MCP server (`mcp/`) released with it.

**Performance Goals**: A project's recordings list appears within 2 s for 50 recordings (SC-003); a take is written once as it arrives, as today; listing reads only small meta records, never take bytes; migration of the existing clip completes before the review opens.

**Constraints**: No server, no accounts, no sync; browser storage quota is the ceiling, and a failed write is reported, never swallowed. The profile lock invariant of spec 009 is unchanged. The MCP tool list is the agent's safety boundary, and deletion is not on it.

**Scale/Scope**: Tens of projects; hundreds of recordings per browser, bounded by quota; recordings are dominated by their take bytes. The UI adds one toolbar control, one project list, one project dialog and one project overview.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Verdict |
|---|---|---|
| I. The skills are the constitution | The plan follows **domain-model** (rules in classes, ports for collaborators, the view listens), **verification** (unit tests for rules, browser checks for drawn flows), **project-workflow** (one change per PR, CI owns the version) and **overview** (the words and where code lives). No skill needs changing; the feature extends the existing shape. | PASS |
| II. `src/domain/` is pure | `Project`, `Projects` and the clip's profile rule are classes under `src/domain/project/` and `src/domain/clip/`; storage is a port with an IndexedDB adapter in `src/infra/`; no DOM or browser import reaches the domain. | PASS |
| III. Every rule has a test beside it | Each new domain class gets a node test: project naming and uniqueness, the Default project's immunity, the current project, the profile snapshot and its lock, finished/in-progress derivation, and the migration use case with a fake store. | PASS |
| IV. What is drawn, played or encoded is proved in a browser | The projects check drives the real page: create and select a project, make a recording, end its session, reload, see it finished, remove it to Default. Migration is proved in the same committed suite against a legacy store. | PASS |
| V. The words come first | `project`, `current project`, `default project`, `description`, `recording`, `in progress`, `finished`, `project default profile`, `clip profile`, `recording store` and `project book` are written into `docs/GLOSSARY.md` in the first change, before code. | PASS |
| VI. One change per PR, CI owns the version | The delivery is sliced below into independent PRs; `package.json` is never bumped by hand. | PASS |

No violations; the Complexity Tracking table stays empty.

**Post-design re-check (after Phase 1)**: unchanged. The design adds one domain folder,
two ports with IndexedDB/localStorage adapters, three use cases and a UI group — the
existing layers, no new kind of module. The glossary change is the first delivery slice,
so principle V holds before any code; the browser checks are committed with their slices,
so principle IV holds as the feature lands. No gate needs justification.

## Project Structure

### Documentation (this feature)

```text
specs/016-projects/
├── plan.md              # This file
├── research.md          # Phase 0: the decisions and their alternatives
├── data-model.md        # Phase 1: entities, fields, storage shape, transitions
├── quickstart.md        # Phase 1: how to prove the feature end to end
├── contracts/
│   ├── agent-surface.md # The page's bounded automation surface, extended
│   └── mcp-tools.md     # The tool list and schemas the server offers
└── tasks.md             # Phase 2 output (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
src/
├── domain/
│   ├── project/
│   │   ├── Project.ts          # one project: name, description, default profile
│   │   ├── Project.test.ts
│   │   ├── Projects.ts         # the book: the Default project, the current one
│   │   └── Projects.test.ts
│   ├── clip/
│   │   ├── Clip.ts             # + profile snapshot, chooseProfile (before capture)
│   │   ├── Clip.test.ts        # + the profile rule
│   │   ├── ClipProfile.ts      # the snapshotted profile: id, name, declarations
│   │   └── ClipProfile.test.ts
│   └── session/
│       ├── Session.ts          # + the open recording's identity and project
│       └── Session.test.ts
├── application/
│   ├── projects.ts             # ManageProjects: create, select, edit, remove
│   ├── projects.test.ts
│   ├── recordings.ts           # Recordings: open, start fresh, finish, list, move,
│   │                           #   remove, delete, profile for a recording
│   ├── recordings.test.ts
│   ├── adopt-recording.ts      # the migration of the previous version's clip
│   ├── adopt-recording.test.ts
│   ├── keep-clip.ts            # writes the open recording (kept, now per recording)
│   ├── keep-clip.test.ts
│   ├── profile-of.ts           # resolve a project's default, with the Default fallback
│   └── ports/
│       ├── RecordingStorePort.ts   # many recordings, named without IndexedDB
│       └── ProjectStorePort.ts     # the project book
├── infra/
│   ├── recording-store.ts      # IndexedDB, keyed by recording: meta, takes, images
│   ├── project-store.ts        # localStorage, the book
│   ├── clip-store.ts           # retired into recording-store.ts; the old keys are read
│   │                           #   once by the migration and then cleared
│   ├── images.ts               # images scoped to the open recording
│   └── ...
├── ui/
│   ├── project/
│   │   ├── project-flow.ts     # the wiring: current project, selection, overview
│   │   ├── project-menu.ts     # the list: select, create, open the overview
│   │   ├── project-def.ts      # the project dialog: name, description, default profile
│   │   ├── project-overview.ts # description, recordings, progress
│   │   ├── recording-rows.ts   # row data: title, length, state — pure and tested
│   │   ├── recording-rows.test.ts
│   │   └── delete-recording.ts # the confirmed, person-only deletion
│   ├── profile/                # the pill and the lock now read the clip's profile
│   ├── agent/
│   │   ├── surface.ts          # + projects group
│   │   └── projects.ts         # the surface's project operations
│   ├── keeping/keep.ts         # the open recording's keeper
│   └── lifecycle/new-session-flow.ts  # finish the recording, start a draft
├── session.ts                  # composition: the Session and the recordings use case
├── prefs.ts                    # + the current project? (it lives in the book)
└── main.ts                     # load the book, adopt, resume, then seed the draft
mcp/src/
├── tools.ts                    # + list_projects, read_project, create_project,
│                               #   select_project, edit_project, move_recording
├── tools.test.ts
└── ...
web/
├── index.html                  # + the project pill, menu, dialog, overview
└── styles.css                  # + their styling
docs/
├── GLOSSARY.md                 # the words, first
├── FEATURES.md                 # the Projects section
└── FILES.md                    # the module map
e2e/
├── checks/projects.spec.ts     # the person's path and the agent's path
└── helpers/                    # + a project/recording helper if two checks need it
```

**Structure Decision**: Single project, the app's existing four layers. Projects follow the
profile precedent exactly: rules in `src/domain/`, a use case in `src/application/` with a
store port, an adapter in `src/infra/`, and flows in `src/ui/`. The MCP server extends its
tool list; it owns no rule. No new package, no new framework.

## Delivery Slices

Each slice is its own branch and pull request, starting from `origin/main`, and each
leaves the app working.

1. **The words.** `docs/GLOSSARY.md` (a Projects section), `docs/FEATURES.md` (the Projects
   section), `docs/FILES.md` (the future modules). No code. Constitution V is satisfied
   before anything is built.
2. **The domain.** `Project`, `Projects`, `ClipProfile`, the `Clip` profile rule and the
   `Session` recording identity, each with its test. No persistence, no UI.
3. **The recording store and the migration.** `RecordingStorePort`, the IndexedDB adapter
   keyed by recording, the project book port and adapter, `Recordings` (open, fresh, finish,
   list, move, remove, delete), the kept-clip use case moved onto it, and
   `adopt-recording`. The app still shows only the Default project, so it behaves as before,
   but everything is stored as a recording of Default. The e2e migration check lands here.
4. **The projects surface.** The toolbar pill, the list, create/select/edit/remove, the
   overview with the recordings and progress, and open/move/remove/delete. The person's e2e
   check lands here.
5. **Profiles per project.** The project's default profile in its dialog, the clip's profile
   choice before capture, the lock read from the clip's snapshot, and the project change
   affecting only later recordings. Folded into the person's check where it belongs, plus
   unit tests for the snapshot.
6. **The agent interface.** The `projects` group on the automation surface, the six MCP
   tools, their tests, the agent e2e check, and the docs that name the new operations.

## Complexity Tracking

No constitution violations to justify.