# Tasks: Projects

**Input**: Design documents from `/specs/016-projects/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — the project constitution makes a unit test mandatory beside every
rule in `src/domain/`, and the verification skill makes a committed browser check the
proof of anything drawn. They are not optional here.

**Organization**: Tasks are grouped by user story so each story can be implemented and
tested on its own. The plan's delivery slices (one PR each) cut across these phases; the
"Dependencies" section maps the two.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Every task names the exact file path it touches

## Path Conventions

Single project: `src/`, `mcp/`, `e2e/`, `web/`, `docs/` at the repository root, with the
layers and modules of `plan.md`. Field constraints are canonical in `data-model.md`; a
task cites the `Entity.field` it implements rather than restating the rule.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The words first (constitution V), and a green baseline to compare against.

- [X] T001 Add the Projects words to `docs/GLOSSARY.md`: project, current project, default project, description, recording, in progress, finished, project default profile, clip profile, recording store, project book — each with its one-line meaning and the module that will own it.
- [X] T002 [P] Add a **Projects** section to `docs/FEATURES.md` describing what a person can do, in the app's words, as the other sections do.
- [X] T003 [P] Add the new modules and groups to `docs/FILES.md` (`domain/project/`, `application/recordings.ts`, `infra/recording-store.ts`, `ui/project/`, the MCP project tools).
- [X] T004 Record the baseline using the scripts in `package.json`: run `npm test`, `npm run test:e2e`, `npm run test:mcp` and `npm run build`, and note the passing counts for the pull request.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The domain, the two stores, the recording lifecycle and the migration. No
user story can be built until this is in place, and the app must still behave as before
when it lands.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete.

### Domain

- [X] T005 [P] Create `ClipProfile` in `src/domain/clip/ClipProfile.ts` and its test, with the snapshot's `id`, `name` and `controls`, `declares`/`valueFor`, and `ClipProfile.DEFAULT` — constraints: `data-model.md` `ClipProfile.id`, `ClipProfile.name`, `ClipProfile.controls`.
- [X] T006 [P] Create `Project` in `src/domain/project/Project.ts` and `Project.test.ts` — constraints: `data-model.md` `Project.id`, `Project.name` (trimmed, required, case- and space-insensitive uniqueness helper), `Project.motivation`, `Project.objectives`, `Project.defaultProfileId`; derivation of the description.
- [X] T007 Create `Projects` in `src/domain/project/Projects.ts` and `Projects.test.ts`: the Default project, `starting`, `of` repair, `currentId`, create/select/rename/remove/setDefaultProfile — constraints: `data-model.md` `Projects.projects`, `Projects.currentId`, and `Project.name` for the uniqueness rule; depends on T006.
- [X] T008 Add the profile snapshot to `src/domain/clip/Clip.ts`: a `profile` field, `chooseProfile(profile)` refused once a take exists, and `profile` in `snapshot()`/`restore()` with the built-in Default for an old snapshot — constraints: `data-model.md` `Clip.profile`; extend `Clip.test.ts`; depends on T005.
- [X] T009 Add the open recording's identity to `src/domain/session/Session.ts` and its test — constraints: `data-model.md` `Session.recordingId`, `Session.projectId`; the capture latch and `end()` unchanged.

### Ports and adapters

- [X] T010 [P] Define `src/application/ports/RecordingStorePort.ts` for many recordings: save meta, save take, save all, load, list headers, delete, the open pointer — naming the record fields, never IndexedDB. Cite `data-model.md` `Recording.id`, `Recording.projectId`, `Recording.profile`, `Recording.createdAt`, `Recording.duration`, `Recording.count`, `Recording.cuts`, `Recording.annotations`, `Recording.properties`, `Recording.watermark`, `Recording.audio`.
- [X] T011 [P] Define `src/application/ports/ProjectStorePort.ts` for the project book (load/save), mirroring `ProfileStorePort`.
- [X] T012 Implement `src/infra/recording-store.ts` (IndexedDB version 4): `recordingMeta` keyed by id, `recordingTakes` and `recordingImages` keyed by `[recordingId, …]`, and the `app` store holding the open pointer; one transaction writes a first meta and the pointer together. Cite `data-model.md` `Recording.*` and "The open pointer" (`recordingId`, `projectId`, the same identity as `Session.recordingId` and `Session.projectId`); its browser proof is the upgrade check T031; depends on T010.
- [X] T013 [P] Implement `src/infra/project-store.ts` (localStorage `democlip_projects`) and `project-store.test.ts`, following `profile-store.ts`; depends on T011.
- [X] T014 Scope `src/infra/images.ts` by the open recording (`setRecording(id)`, keys `[recordingId, imageId]`, load only the open recording's pictures, delete with the recording); update its callers and `src/application/…` image use; the existing `e2e/checks/annotations.spec.ts` guards the drawn path; depends on T012.

### Application

- [X] T015 Implement `src/application/recordings.ts` — `Recordings`: `startFresh`, `open`, `finish`, `list`, `move`, `remove` (to Default), `delete`, and the derived state/progress; `recordings.test.ts` with a fake store. Cite `data-model.md` `Recording.projectId`, `Recording.duration`, `Recording.count`, `Recording.createdAt`, `Recording.profile`, `Session.recordingId`, `Session.projectId`; depends on T008, T009, T010, T012.
- [X] T016 Rework `src/application/keep-clip.ts` (and `src/ui/keeping/keep.ts`) onto the open recording: a take writes under its id, a cut writes the meta, `finish()` flushes and moves the pointer to a fresh draft instead of clearing the recording; extend `keep-clip.test.ts`; depends on T015.
- [X] T017 Implement `src/application/projects.ts` — `ManageProjects` (create, select, edit, remove, set default profile), refusing an unknown profile and a rename/removal of Default; `projects.test.ts` with a fake store. Cite `data-model.md` `Project.name`, `Project.defaultProfileId`, `Projects.currentId`; depends on T006, T007, T011, T013.
- [X] T018 Implement `src/application/adopt-recording.ts` and its test: the previous version's `meta/current` + takes + images become the `adopted` recording in Default under one transaction, idempotent, failure-safe — depends on T012.
- [X] T019 Wire the composition in `src/session.ts`, `src/main.ts`, `src/ui/keeping/resume-flow.ts` and a new `src/ui/project/project-flow.ts` skeleton: load profiles, load the project book, adopt, open the remembered recording or start a draft in the current project, snapshot that project's default profile, and finish on New/export/publish. The app runs in the Default project and stores recordings; no projects UI yet — depends on T014, T015, T016, T017, T018.
- [X] T020 Re-run `npm test`; change the existing `src/application/keep-clip.test.ts` and `src/ui/keeping/resume-flow.ts` tests only where the behaviour deliberately moved (the recording is kept instead of cleared), and state that in the pull request — constitution III's refactor proof.

**Checkpoint**: The app still records, reloads and exports; the stored clip is now a recording of the Default project. No project UI exists yet.

---

## Phase 3: User Story 1 — A project gathers the recordings made for one purpose (Priority: P1) 🎯 MVP

**Goal**: Create and select a project, see its recordings, open one to continue, move/remove
one to Default, and delete one from Default after a confirmation.

**Independent Test**: Create a project with a name, motivation and objectives; record two
clips (fixture takes) in it; reload; both are listed; open the second and cut it; remove the
first and find it in Default, whole. Delete it there only after the confirmation.

### Tests for User Story 1

- [X] T021 [P] [US1] Unit-test the row data in `src/ui/project/recording-rows.test.ts`: title from `Recording.properties`, fallback label from `Recording.createdAt` and the project name, length and state — cite `data-model.md` `Recording.properties`, `Recording.createdAt`, `Recording.duration`.
- [X] T022 [US1] Add the committed check `e2e/checks/projects.spec.ts` (person's path): create and select a project through the UI, make a recording from fixture takes, press **New**, reload, see it listed, open it, remove it to Default. Assert what a person sees, not only the model.

### Implementation for User Story 1

- [X] T023 [P] [US1] Implement `src/ui/project/recording-rows.ts`: the display row (title, length, state, project id) and the fallback label, pure and DOM-free, from `recordings.list()`.
- [X] T024 [US1] Add the project pill, the project menu, the project dialog and the overview containers to `web/index.html` and their styling to `web/styles.css`, with the ids the flows need; add them to `src/ui/dom.ts`.
- [X] T025 [US1] Implement `src/ui/project/project-menu.ts`: the project list with the current one marked, select, create, open the dialog, open the overview — wired to `ManageProjects` with a refusal toast.
- [X] T026 [US1] Implement `src/ui/project/project-def.ts`: the dialog for a project's name, motivation, objectives and (later) default profile; the Default project's name is fixed — constraints: `data-model.md` `Project.name`, `Project.motivation`, `Project.objectives`.
- [X] T027 [US1] Complete `src/ui/project/project-flow.ts`: the pill's initials and tooltip, selecting/creating a project (refused once capture began), redrawing on change, and starting a draft in the new current project; depends on T025, T026.
- [X] T028 [US1] Implement the recordings list in `src/ui/project/project-overview.ts` with **Open** (`Recordings.open`), **Move to…** and **Remove** (to Default), and make it follow the change events rather than re-render from the caller; depends on T023, T027.
- [X] T029 [US1] Implement `src/ui/project/delete-recording.ts`: the confirmation naming the recording, only from Default, deleting takes/meta/images through `Recordings.delete`, with the quota-failure message — constraints: `data-model.md` `Recording.id`; depends on T028.
- [X] T030 [US1] Run `npx vitest run` and the check in `e2e/checks/projects.spec.ts`; fix until both pass on the story alone.

**Checkpoint**: Projects exist and gather recordings; nothing yet proves the Default project's immunity or the overview's counts.

---

## Phase 4: User Story 2 — The Default Project keeps every existing recording (Priority: P1)

**Goal**: The Default project always exists, cannot be renamed or removed, holds the
previous version's recording, and the person who ignores projects records exactly as before.

**Independent Test**: Seed a version-3 store with a take, a cut and an annotation; boot the
app; the recording is in Default with its length, cut and annotation, and no project choice
is ever asked. Press New and record again: nothing new is required.

### Tests for User Story 2

- [X] T031 [US2] Extend `e2e/checks/projects.spec.ts` with the upgrade story: seed a version-3 store before load, assert the adopted recording in Default, then record, press New, and export without touching the projects UI. The adoption use case's unit test is T018; this proves the browser path.
- [X] T032 [US2] Add a test in `src/application/projects.test.ts` for the Default immunity (`remove`, `rename`) and the current-project fallback — cite `data-model.md` `Projects.currentId`.

### Implementation for User Story 2

- [X] T033 [US2] Make the Default project's immunity visible in `src/ui/project/project-menu.ts` and `src/ui/project/project-def.ts`: no rename or remove is offered for it, and the reason is said (tooltip or disabled control), matching the spec's "the app says why".
- [X] T034 [US2] Make creation while capturing safe: the project joins the list but does not become current, and the app says the session's project is fixed; cover it in `src/ui/project/project-flow.ts` and its check.
- [X] T035 [US2] Run the upgrade check in `e2e/checks/projects.spec.ts` on an empty and on a seeded store; confirm the old recording opens, exports and is never duplicated by a second boot.

**Checkpoint**: An update cannot cost anyone a recording, and the individual-recording workflow is unchanged.

---

## Phase 5: User Story 3 — A project's default Profile is how its videos are produced (Priority: P2)

**Goal**: A project names a default profile; a recording starts under it and snapshots it;
the person may choose another profile for the draft before capture; whichever profile is in
force locks its declared items; later profile or project changes never reach a recording
already made.

**Independent Test**: Give a project a profile that fixes **Add to export** on. A recording
in it shows the value, locked, naming the profile. Change the draft's profile before
recording to a free one: every item is the person's. A second recording starts under the
project's default again.

### Tests for User Story 3

- [X] T036 [P] [US3] Unit-test the profile resolution and application: `src/ui/profile/apply.test.ts` and `src/application/projects.test.ts` cover an unknown default profile falling back to Default, a snapshot being taken on a draft, and declared properties being applied while undeclared ones stay the person's — cite `data-model.md` `Project.defaultProfileId`, `ClipProfile.controls`.
- [X] T037 [P] [US3] Extend `src/domain/clip/Clip.test.ts` for the snapshot: a profile chosen before a take is kept, after a take refused, and an old snapshot restores as the built-in Default — cite `data-model.md` `Clip.profile`.
- [X] T038 [US3] Extend `e2e/checks/profiles.spec.ts` with the project's default: a project-level default locks an item, a draft chooses another profile, and a second recording follows the project again.

### Implementation for User Story 3

- [X] T039 [US3] Add the default-profile choice to `src/ui/project/project-def.ts`, listing the profile book and refusing an unknown one through `ManageProjects` — cite `data-model.md` `Project.defaultProfileId`.
- [X] T040 [US3] Point the profile surfaces at the clip's snapshot: `src/ui/profile/control.ts` reads `clip.profile`, `src/ui/profile/profile-flow.ts` shows the clip's profile on the pill and chooses through `Clip.chooseProfile`, with the existing lock refusal wording; depends on T008, T039.
- [X] T041 [US3] Rework `src/ui/profile/apply.ts` to seed the declared clip properties from the snapshot on a new draft and on a profile change, leaving undeclared items the person's; keep its node test.
- [X] T042 [US3] Make `src/ui/agent/describe.ts`'s `readOnly` follow the clip's snapshot through the same `Controlling` seam, and extend `describe`/`surface` tests so the person's panel and the agent cannot disagree.
- [X] T043 [US3] Run the checks in `e2e/checks/profiles.spec.ts` and `e2e/checks/projects.spec.ts` together; the profile lock must be identical in both.

**Checkpoint**: A project is a production commitment; the lock invariant of spec 009 is untouched.

---

## Phase 6: User Story 4 — A project shows its description, its progress and its finished recordings (Priority: P2)

**Goal**: One overview shows the project's description, its recordings, the count finished
against the total, the empty and complete states, and which recording is in progress.

**Independent Test**: With several recordings, finish some by ending their sessions and
leave others in progress; the overview agrees with the list, and ending one updates the
count without a reload.

### Tests for User Story 4

- [X] T044 [P] [US4] Unit-test the progress derivation in `src/application/recordings.test.ts`: finished/total, the open recording in progress, a draft with no take not counted, and the counts agreeing with the list.
- [X] T045 [US4] Extend `e2e/checks/projects.spec.ts` with the overview: description shown, progress counts after New and after a reload, the in-progress row, and the empty/complete states.

### Implementation for User Story 4

- [X] T046 [US4] Implement the description and progress in `src/ui/project/project-overview.ts`: the motivation and objectives as the description, "N of M finished", the in-progress recording, and plain empty/complete messages — constraints: `data-model.md` `Project.motivation`, `Project.objectives`; depends on T028.
- [X] T047 [US4] Make the overview reachable in no more than two actions from the main screen in `src/ui/project/project-menu.ts` and `src/ui/project/project-flow.ts`: the pill's project row opens it, and the change events from a session ending refresh it — depends on T046.
- [X] T048 [US4] Run the check in `e2e/checks/projects.spec.ts` and confirm the counts match the rows in every state the check visits.

**Checkpoint**: A person can see where a project stands without counting the list.

---

## Phase 7: User Story 5 — The agent works with projects too (Priority: P3)

**Goal**: The agent lists projects, reads one with its recordings and progress, creates a
project, selects the current one, edits a project, and moves a recording between projects —
and can never delete a recording or remove a project.

**Independent Test**: From the agent interface, list the projects, create one, select it,
move a recording into it, and see each change in the person's window without a reload. Ask
to delete a recording: no tool exists.

### Tests for User Story 5

- [X] T049 [P] [US5] Add `src/ui/agent/projects.test.ts` for the surface group: the shapes, the refusal reasons, and that no delete/remove-project operation exists — against a fake `ManageProjects`/`Recordings`.
- [X] T050 [P] [US5] Add `mcp/src/tools.test.ts` cases for the six tools: schemas, each call reaching the right surface path, an unknown project answered with the existing ones, and the absence of a deletion tool.
- [X] T051 [US5] Add the second committed check to `e2e/checks/projects.spec.ts` (agent's path): `?agent=1`, list, create, select, move; assert the person's pill, list and overview follow.

### Implementation for User Story 5

- [X] T052 [P] [US5] Add the `projects` group to `src/ui/agent/surface.ts` and implement `src/ui/agent/projects.ts` — the six operations of `contracts/agent-surface.md`, each calling the app's own use case and answering a result.
- [X] T053 [US5] Wire the group in `src/main.ts` into `createAgentSurface`, so it exists only on a page opened with `?agent=1`.
- [X] T054 [P] [US5] Add the six tools to `mcp/src/tools.ts` with the schemas of `contracts/mcp-tools.md`, and no deletion tool; resolve a project given by id or name.
- [X] T055 [US5] Run `npm run test:mcp` with `mcp/src/tools.test.ts`, the surface test `src/ui/agent/projects.test.ts` and the agent check in `e2e/checks/projects.spec.ts`; confirm a page without `?agent=1` publishes nothing.

**Checkpoint**: Projects are drivable by an agent within the same bound as everything else.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: The checks that guard the whole feature, the docs that must not drift, and the
pull request's honesty.

- [X] T056 [P] Bring `docs/FEATURES.md` and `docs/FILES.md` level with what was built (new files, the project pill, the agent tools); ensure `docs/GLOSSARY.md`'s words are the ones the code and tests use.
- [X] T057 [P] Fold the scaffolding checks: `e2e/checks/projects.spec.ts` must hold the person's upgrade+project story and the agent's story, and any duplicate assertions must be merged without losing coverage — the verification skill's two-checks rule.
- [X] T058 Run the full gate from `package.json`: `npm test`, `npm run test:e2e`, `npm run test:mcp`, `npm run build`, `npm run lint`; fix anything they surface.
- [ ] T059 Run the scenarios in `specs/016-projects/quickstart.md` by hand, including a real share and a large take; note the quota behaviour and the picker as the unverified gaps.
- [X] T060 Remove what the change retired: the old single-clip exports in `src/infra/clip-store.ts` and any dead `applyProfile`/`locked` path; `grep` for callers before deleting, and keep the old store's read path only for the migration.
- [X] T061 Write the pull request body per the project-workflow skill: what and why, the verification levels and the numbers, the gaps, and confirm `package.json` was not bumped (CI owns the version).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies; T002/T003 run in parallel, T001 first in spirit because the words precede the code.
- **Foundational (Phase 2)**: depends on Setup; **blocks every user story**. Within it, the domain (T005–T009) and the ports (T010, T011, T013) are parallel; the adapter, lifecycle and migration follow in the order shown.
- **User Story 1 (Phase 3)**: depends on Phase 2. It is the MVP's visible half.
- **User Story 2 (Phase 4)**: depends on Phase 2. Its e2e task edits the same file as T022, so run it after US1's check exists; its implementation (T033, T034) is independent of US1.
- **User Story 3 (Phase 5)**: depends on Phase 2 and on US1 (the project dialog and pill exist).
- **User Story 4 (Phase 6)**: depends on Phase 2 and on US1 (the overview exists).
- **User Story 5 (Phase 7)**: depends on US1, US3 and US4 (the operations and progress it exposes); the surface/tool files are independent of each other.
- **Polish (Phase 8)**: after all desired stories.

### User Story Dependencies at a Glance

```text
Setup → Foundational ─┬─▶ US1 (P1) ─┬─▶ US3 (P2) ─┐
                      │             └─▶ US4 (P2) ─┼─▶ US5 (P3)
                      └─▶ US2 (P1)                │
                                                 └─▶ Polish
```

US2 shares only the projects check with US1; the rest of US2 is independent. US3 and US4
can run in parallel by different people once US1 is in.

### Within Each Story

- Tests first where they exist (T021 before T023; T049/T050 before T052/T054).
- The pure row/derivation modules before the flows that draw them.
- The flow before its e2e assertions.
- Run the story's check before leaving its checkpoint.

### Parallel Opportunities

- T002/T003 (docs) and T005/T006/T010/T011/T013 (independent files) can run together.
- T021/T023 can run together; T049/T050 and T052/T054 are different files and can run in parallel.
- Once Foundational is done, US1 and US2's implementations can proceed in parallel; US3 and US4 can follow in parallel.

---

## Parallel Example: Foundational Domain

```bash
# Three files, no dependency between them:
Task: "Create ClipProfile in src/domain/clip/ClipProfile.ts and its test"
Task: "Create Project in src/domain/project/Project.ts and Project.test.ts"
Task: "Define RecordingStorePort in src/application/ports/RecordingStorePort.ts"
```

## Parallel Example: The Agent Phase

```bash
# The page's group and the server's tools are separate files:
Task: "Add the projects group to src/ui/agent/projects.ts"
Task: "Add the six tools to mcp/src/tools.ts"
```

---

## Implementation Strategy

### MVP First

1. Phase 1 (the words) → Phase 2 (foundation, with the migration).
2. **US1 and US2 together** are the shippable MVP: a project can gather recordings, and an
   update costs nobody a recording. Neither alone is safe to release: US1's store change
   would lose an old clip without US2's adoption, and US2 without US1 has no projects UI.
3. Stop and validate with `e2e/checks/projects.spec.ts`.

### Incremental Delivery

1. Foundation + US2 → the app behaves as before, storing a recording of Default; the
   migration is proved. This is the plan's slice 3.
2. Add US1 → projects exist and gather recordings; the person's check grows. Slice 4.
3. Add US3 → the project is a production commitment; the profile lock is proved. Slice 5.
4. Add US4 → the overview shows the work's state. Slice 4's overview is completed here.
5. Add US5 → the agent's tools land. Slice 6.
6. Polish and open the pull request, or one pull request per slice as the project workflow
   requires.

### Parallel Team Strategy

- Two people: one takes the domain and stores (T005–T019), the other the docs and the
  eventual UI markup (T001–T003, T023–T024). Once the foundation is in, one takes US1+US2
  and the other US3+US4; US5 follows.
- Three people: domain/stores, UI, and the agent/MCP pair, with the agent waiting for US1's
  use cases.

---

## Notes

- `[P]` means different files and no incomplete dependency; do not parallelise two tasks
  that edit `project-overview.ts` or `projects.spec.ts`.
- The projects check `e2e/checks/projects.spec.ts` is edited by T022, T031, T045 and T051; the profiles check `e2e/checks/profiles.spec.ts` by T038 — sequence those.
- Field constraints live in `data-model.md`; a task that adds or narrows one says so.
- Commit after each task or logical group, one change per pull request, and never bump
  `package.json`.

---

## Implementation status (2026-11-27)

Completed: all tasks except the one below.

- **T059 — real share session**: not run. The projects and profiles checks seed fixture
  takes, and no check can open the screen-share picker; a real recording remains the
  person's session. Everything else in `quickstart.md` that can be automated was run.
- **Verification levels**: `npm test` 80 files / 751 tests; `npm run test:mcp` 9 files /
  48 tests; `npm run build` and `npm run lint` clean; `e2e/checks/projects.spec.ts` 2/2; the full suite ran 47 passed and 10 failed, all in
  real-recording, agent and annotation checks that fail at `HEAD` in this environment too
  (a clean worktree: 36 passed, 19 failed).
- **Pull request body**: `specs/016-projects/pull-request.md`.
