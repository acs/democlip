---

description: "Task list for Annotation Duration, Placement and Stretch"
---

# Tasks: Annotation Duration, Placement and Stretch

**Input**: Design documents from `/specs/010-annotation-duration/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/annotation-duration.md, quickstart.md

**Tests**: Included — the project's constitution (Principle III) requires a unit test for every
rule in `src/domain/`, and the Verification skill requires a committed `e2e/` check for
anything drawn or wired to the DOM. No TDD ordering is implied; write each test with its rule.

**Organization**: Tasks are grouped by user story. User stories from spec.md:
- **US1** (P1) — Annotate from a control that does not crowd
- **US2** (P1) — Say how long an annotation lasts
- **US3** (P2) — See the stretch of the annotation being edited
- **US4** (P3) — The next kind fits the same control

**PR map** (Project workflow: one change per pull request): Phase 3 → `feat/annotate-options`;
Phase 4 → `feat/annotation-duration-property`; Phase 5 → `feat/annotation-stretch-lane`;
Phase 1 docs → `docs/annotation-duration-words`; Phase 7 docs → `docs/annotation-duration-final`.
Phase 2 (`feat/annotation-duration-rule`) lands first because US1 and US2 both read the
duration constants. CI owns the version — `package.json` is never bumped by hand.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Exact file paths are in every description

## Path Conventions

Single-project browser application: `src/` and `web/` at repository root, `e2e/` beside them.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The words first (Principle V), and a known-green baseline.

- [X] T001 Add **annotation duration**, **annotate options** and **active stretch** to `GLOSSARY.md`, and note the new modules (`annotate-options.ts`, `duration-property.ts`) in `.agents/skills/domain-model/SKILL.md`. Docs only, no code.
- [X] T002 [P] Confirm a green baseline before any change: run `npx vitest run` and `npm run test:e2e` at repository root and record the result.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The duration rule and its constants, read by US1 (the default) and US2 (the control).

**⚠️ CRITICAL**: US1 and US2 cannot begin until this phase is complete.

- [X] T003 Add `withDuration(seconds, total, min = MIN_ANNOTATION_S)` and the exported constants to `src/domain/annotation/Annotation.ts`, exactly as `data-model.md` defines `Annotation.withDuration`, `DEFAULT_ANNOTATION_S` (= 2) and `MIN_ANNOTATION_S` (= 0.1): keep the start fraction, clamp the end to `min(1, span.s + seconds / total)`, answer `null` when `total <= 0` or the result is below `min`, and delegate to the kind's `withSpan` so colour, geometry, words and id are kept. Per `contracts/annotation-duration.md` §1.
- [X] T004 [P] Add unit tests for `withDuration` in `src/domain/annotation/Annotation.test.ts` (or beside each kind): start held; end clamped to `1`; too-short value `null`; `total = 0` `null`; the kind's other fields kept — for `Arrow`, `ImageAnnotation` and `TextAnnotation`. Run with `npx vitest run src/domain/annotation`.
- [X] T005 [P] Confirm the regression gate: `npx vitest run src/domain/clip src/ui/annotating` passes **unmodified** (records the baseline for the "old tests passing unmodified" claim).

**Checkpoint**: `withDuration` and the constants exist and are tested; US1 and US2 can begin.

---

## Phase 3: User Story 1 - Annotate from a control that does not crowd (Priority: P1) 🎯 MVP

**Goal**: The annotation kinds move from the selected stretch on the timeline into a vertical column of rows on the picture, just below the clip's settings control. A press places over the selected stretch, or at the playhead with the default duration.

**Independent Test**: In review, the column shows one row per kind and none outside review; pressing a kind with a stretch selected places over it, and with none places at the playhead; the timeline section carries no kind buttons.

### Implementation for User Story 1

- [X] T006 [P] [US1] Create `src/ui/annotating/annotate-options.ts`: render one row per `plugins()` entry (the kind's `action.icon` and `action.label`) into `#annotate-bar`; show only when `currentPhase() === 'review'` and `session.clip.total() > 0`; on a press compute the span as `selection.section()` else `Span.of(f, f + DEFAULT_ANNOTATION_S / total)` from `player.time()` and call `canvas.add(kind, span)`. Names no kind (`data-model.md` `AnnotateOptions`; `contracts/annotation-duration.md` §3).
- [X] T007 [P] [US1] Add the `#annotate-bar` element to `web/index.html` directly below `#props-btn` inside `.preview-wrap`, and its column styles to `web/styles.css`.
- [X] T008 [US1] Remove the kind buttons (`plugins().map(...)`) from the section's action row in `src/ui/cutting/marks.ts`, keeping the scissors and the keep/undo, and drop the `plugins` import (`data-model.md` "Changed entity — the timeline marks").
- [X] T009 [US1] Initialise the column in `src/main.ts` (call `initAnnotateOptions()`) alongside the other annotating modules.
- [X] T010 [US1] Update `e2e/checks/annotations.spec.ts` for the moved control (place from `#annotate-bar` instead of `[data-act="add"]`) and fold in the column/placement assertions: one row per kind in review and none outside it; a press with a stretch selected places over that stretch; a press with none places at the playhead with `DEFAULT_ANNOTATION_S`; the section carries no kind buttons.

**Checkpoint**: US1 works and is testable on its own — the kinds are placed from a control that scales.

---

## Phase 4: User Story 2 - Say how long an annotation lasts (Priority: P1)

**Goal**: A placed annotation's duration is a seconds value in its preferences, applied through the clip so it is announced, undone once and kept.

**Independent Test**: Pick an annotation, open its settings, step the duration, and see the annotation change length in playback and in the export; the one undo reverts it; a refused value says why.

### Implementation for User Story 2

- [X] T011 [P] [US2] Add `'duration'` to `PropertyControl` in `src/ui/annotating/annotation-plugin.ts` (`data-model.md` `PropertyControl.duration`).
- [X] T012 [P] [US2] Create `src/ui/annotating/duration-property.ts` exporting `durationProperty(clip): AnnotationProperty` — `id: 'duration'`, `label: 'Duration'`, `control: 'duration'`, `value` the seconds (`(annotation.span.length * clip.total()).toFixed(2)`), `with` parses a number and calls `withDuration` (null when it will not parse or the rule refuses) — per `data-model.md` `durationProperty` and `contracts/annotation-duration.md` §2.
- [X] T013 [US2] Add `propertiesFor(annotation, clip)` to `src/ui/annotating/annotation-plugin.ts`: `propertiesOf(annotation)` followed by `durationProperty(clip)`, omitting the duration when `clip.watermarks()` includes the annotation (`data-model.md` `propertiesFor`). Leave `propertiesOf`'s signature untouched.
- [X] T014 [US2] Render the `'duration'` row in `src/ui/annotating/properties-inspector.ts`: a seconds read-out with − / + stepping by `DURATION_STEP_S = 0.1`, − stopping at `MIN_ANNOTATION_S` and + at what remains of the clip, applying through `clip.changeAnnotation`; refuse an unusable value with a message (`data-model.md` "Changed entity — the properties inspector and the canvas").
- [X] T015 [US2] Switch the settings-control check in `src/ui/annotating/annotation-canvas.ts` from `propertiesOf(picked).length > 0` to `propertiesFor(picked, session.clip).length > 0`, so the image (now offering the duration) draws a control and the watermark does not.
- [X] T016 [US2] Switch `setProperty` in `src/ui/agent/edit.ts` to read `propertiesFor(annotation, clip)`, so an agent may set `duration` with the same refusal shape (`data-model.md` "Changed entity — the agent's editing surface").
- [X] T017 [P] [US2] Add unit tests for `durationProperty` and `propertiesFor` in `src/ui/annotating/annotation-plugin.test.ts`: `value` reads the seconds; `with` applies `withDuration` and answers `null` for an unparsable or refused value; `propertiesFor` is the kind's properties plus the duration, and omits the duration for a watermark. Run with `npx vitest run src/ui/annotating`.
- [X] T018 [US2] Extend `e2e/checks/properties.spec.ts` with the duration story: the image now draws a settings control; the duration row shows a seconds value; stepping it changes the annotation in playback and in the export; the one undo reverts it; a value below the minimum is refused with a message.

**Checkpoint**: US1 and US2 both work independently — a kind is placed from the column, and its length is a value.

---

## Phase 5: User Story 3 - See the stretch of the annotation being edited (Priority: P2)

**Goal**: A picked annotation's stretch is drawn on the timeline beside a selected cut section, and is the active stretch; the timeline draws more than one stretch at a time, in kept time.

**Independent Test**: Pick an annotation and see its stretch as the active band; select a cut section too and see both; let the annotation go and see only the cut's; a cut closes the band up.

### Implementation for User Story 3

- [X] T019 [P] [US3] Add `stretchLayout(span): { left: string; width: string }` to `src/ui/clip/clip.ts`, in kept time through `keptOf`/`keptLengthNow` (`data-model.md` `stretchLayout`; `contracts/annotation-duration.md` §4).
- [X] T020 [US3] Use `stretchLayout` for the section's position in `src/ui/cutting/marks.ts`, replacing the module's own `at`/`pctWidth`.
- [X] T021 [US3] Draw the picked annotation's whole stretch as a band on `#tl-annots` in `src/ui/annotating/annotation-lane.ts`, marked as the active stretch, keeping the other annotations' start marks; add the band and active styles to `web/styles.css` (`data-model.md` "Changed entity — the annotation lane, and the active stretch").
- [X] T022 [US3] Extend the committed check (`e2e/checks/annotations.spec.ts` or `e2e/checks/timeline.spec.ts`) for the band: picking an annotation draws its stretch as the active one; with a cut section selected both are shown; letting it go leaves the cut's; a cut closes the band up.

**Checkpoint**: All P1 and P2 stories work independently — placement, duration and the visible stretch.

---

## Phase 6: User Story 4 - The next kind fits the same control (Priority: P3)

**Goal**: Adding a kind is one row in the column and the same duration control — no edit to either.

**Independent Test**: A stub kind appears as one more row and its duration is set by the same control, with every existing kind and cut unchanged.

### Implementation for User Story 4

- [X] T023 [P] [US4] Add a unit test in `src/ui/annotating/annotation-plugin.test.ts` that a stub kind registered under a new id (a) takes a row from `plugins()` with no edit to `annotate-options.ts`, and (b) receives the shared duration from `propertiesFor` with no edit to the descriptor.
- [X] T024 [US4] Confirm by inspection (recorded in the pull request) that adding a kind needs no change to `src/ui/annotating/annotate-options.ts` or `src/ui/annotating/duration-property.ts`, and that no existing annotation or cut test changed outcome.

**Checkpoint**: The family grows cleanly — one row, one duration control, every kind.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: The words on screen and the whole suite green.

- [X] T025 [P] Update the guide with the new placement and duration: `web/help.html`, `FEATURES.md` and `README.md` (where the kinds are offered, and that a duration is a value in the annotation's preferences).
- [X] T026 Run the full quickstart validation (`specs/010-annotation-duration/quickstart.md`): `npx vitest run` and `npm run test:e2e`; record which level proved which part.
- [X] T027 [P] Confirm the regression gate across the whole suite: every existing `Arrow`, `ImageAnnotation`, `TextAnnotation`, `AnnotationSet`, `Clip`, `ExportPlan`, `annotation-plugin` and `properties-inspector` test passes **unmodified**; name any that had to change and say why. Note the real reload (`quickstart.md` §3) as the user's to run and state it as a gap.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS US1 and US2.
- **User Story 1 (Phase 3)**: Depends on Foundational (reads `DEFAULT_ANNOTATION_S`).
- **User Story 2 (Phase 4)**: Depends on Foundational (reads `withDuration`).
- **User Story 3 (Phase 5)**: Depends only on Setup (uses existing `canvas.selectedId`); independent of US1/US2.
- **User Story 4 (Phase 6)**: Depends on US1 (the column) and US2 (the descriptor).
- **Polish (Phase 7)**: Depends on all desired stories.

### Within Each Story

- The rule before its consumer (T003 before T013/T014).
- Reuse the seam before switching callers (T012/T013 before T014–T016).
- Implementation before its committed check (T010, T018, T022).

### Parallel Opportunities

- T002 with T001; T004 and T005 together after T003.
- US1: T006 and T007 together (different files); T008 and T009 after them.
- US2: T011 and T012 together; T017 with the implementation.
- US3: T019 before T020/T021.
- US4: T023 alone.

---

## Parallel Example: User Story 2

```bash
# Different files, no dependency on each other:
Task: "Add 'duration' to PropertyControl in src/ui/annotating/annotation-plugin.ts"
Task: "Create src/ui/annotating/duration-property.ts"
Task: "Add unit tests for durationProperty and propertiesFor in src/ui/annotating/annotation-plugin.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup, and Phase 2: Foundational.
2. Complete Phase 3 (US1).
3. **STOP and VALIDATE**: the column places every kind and the timeline section is clear.
4. Deploy/demo if ready.

### Incremental Delivery

1. Setup + Foundational → the rule is in place.
2. US1 → the kinds are placed from the column (MVP).
3. US2 → the duration is a value in the preferences.
4. US3 → the picked annotation's stretch is on the timeline.
5. US4 → the seam is proved to take a new kind.
6. Polish → the docs and the whole suite.

### One Change Per Pull Request

Each phase is its own branch and pull request (`feat/annotate-options`,
`feat/annotation-duration-property`, `feat/annotation-stretch-lane`, and the two `docs/`
branches; Phase 2 is `feat/annotation-duration-rule`). A step leaves the app working and its
tests green, and no step edits `package.json`.

---

## Notes

- [P] tasks touch different files and have no incomplete dependency.
- `propertiesOf` keeps its signature; the duration is the **new** `propertiesFor`, so the existing seam and kind tests stay unmodified.
- [Story] labels map each task to a user story for traceability.
- The duration is the annotation's own span — no stored-shape change (`data-model.md` "Changed entity — the stored shape").
- Verify the committed `e2e/` checks and the unit tests before each pull request; the brief for a regression fix is the failing check first.
