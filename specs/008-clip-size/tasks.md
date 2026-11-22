# Tasks: Clip Size

**Input**: Design documents from `specs/008-clip-size/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. The project's constitution (III, IV) requires a unit test for every
rule in `src/domain/` and a browser check for anything drawn, played or encoded.

**Organization**: Tasks are grouped by user story so each can be implemented and tested
on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: the user story the task belongs to (US1, US2, US3)

## Path Conventions

Single project: application code under `src/`, end-to-end checks under `e2e/`.

---

## Phase 1: Setup

**Purpose**: the words come first (constitution V).

- [X] T001 Write the new words into `GLOSSARY.md` before any code: a **clip size** row (the picture a clip is shown and exported at — the largest width and height among its takes, both even, until the person sets one) and a **fit** row (a take drawn whole and centred inside the clip size, against the clip's background).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the shared rule (`ClipSize`) and the fact every story needs — each take's own picture size.

**⚠️ CRITICAL**: no user story work begins until this phase is complete.

- [X] T002 [P] Create the `Picture` type and the `ClipSize` class in `src/domain/clip/ClipSize.ts`: `of`, `parse`, `largest`, `toString`, `equals`, `frameFor`, and the `MAX_EDGE` bound (data-model.md ClipSize.width, ClipSize.height, ClipSize.MAX_EDGE).
- [X] T003 [P] Write `src/domain/clip/ClipSize.test.ts`: an odd edge rounds **up** to the next even size, a non-finite/non-positive/beyond-`MAX_EDGE` edge is `null`, `largest` gives the widest and tallest of a mixed-shape list, and `frameFor` is centred and never empty (data-model.md ClipSize.width, ClipSize.height).
- [X] T004 Add `picture` to `Take` in `src/domain/clip/Take.ts`, refusing one with no size; extend `src/domain/clip/Take.test.ts` (data-model.md Take.picture).
- [X] T005 Carry `picture` through `TakeRepository.add` in `src/domain/clip/TakeRepository.ts` and `InMemoryTakeRepository` in `src/infra/takes.ts` (data-model.md Take.picture).
- [X] T006 Carry `picture` through `Clip.addTake` and add it to `ClipSnapshot.takes` in `src/domain/clip/Clip.ts`; extend `src/domain/clip/Clip.test.ts` for the new argument (data-model.md ClipSnapshot.takes, Take.picture).
- [X] T007 [P] Return the take's picture from the probe: `TakeProbePort.measure` in `src/application/ports/TakeProbePort.ts` and `TakeProbeAdapter` in `src/infra/take-probe.ts` (read `videoWidth`/`videoHeight` alongside the duration).
- [X] T008 [P] Return the take's picture from the file inspector: `TakeFilePort`/`TakeFileInfo` in `src/application/ports/TakeFilePort.ts` and `TakeFileInspector` in `src/infra/take-file.ts` (the video track's display size).
- [X] T009 Pass the measured picture at arrival: `RecordTake.stop` in `src/application/record-take.ts` and `ImportTake.run` in `src/application/import-take.ts` (data-model.md Take.picture).
- [X] T010 Persist the take's picture in `src/infra/clip-store.ts` (`StoredTake`) and measure a missing one from its blob on load, so an older snapshot still resolves a size (data-model.md ClipSnapshot.takes).
- [X] T011 Implement `Clip.size()` in `src/domain/clip/Clip.ts`: the person's `size` property when it parses, else the largest take picture rounded up to even, else `null` with no takes (data-model.md Clip.size, ClipProperties.size, ClipSize.width, ClipSize.height).
- [X] T012 Update every in-page and test caller of `addTake`/`Take.of` to pass a picture: `src/domain/session/Session.test.ts`, the `src/application/*.test.ts` files, `src/ui/agent/*.test.ts`, `src/ui/exporting/intro.test.ts`, `e2e/helpers/app.ts`, `e2e/checks/youtube.spec.ts` (data-model.md Take.picture).

**Checkpoint**: the rule and each take's picture are in place; every story can start.

---

## Phase 3: User Story 1 — One size for every take (Priority: P1) 🎯 MVP

**Goal**: the review shows every take in one frame and every export writes one frame — the clip size — with each take whole and centred.

**Independent Test**: seed two takes of different picture sizes, open the review, and confirm the canvas is the clip size for both; export the WebM and confirm its video track is that same size.

### Tests for User Story 1

- [X] T013 [P] [US1] Extend `src/domain/clip/Clip.test.ts`: `size()` is the largest take picture with both edges even, and `null` for a clip with no takes (data-model.md Clip.size).

### Implementation for User Story 1

- [X] T014 [P] [US1] Fit the frame in `src/ui/recording/preview.ts`: `drawFrame(vid, frame?)` draws the picture into the given rectangle; the live-mirror callers keep drawing the whole canvas.
- [X] T015 [P] [US1] Fit the frame and hold the background in `src/ui/clip/dissolve.ts`: `hold` and `draw` draw the held frame and the new take through the fit.
- [X] T016 [US1] Draw and resize through the size in `src/ui/clip/clip.ts`: `seekAndDraw` draws through `clip.size()?.frameFor(...)`, and add `resizeReview()` that sets the preview canvas to the clip size and redraws the current frame.
- [X] T017 [US1] Open the review at the clip size in `src/ui/clip/review-flow.ts`: `openReview` calls `resizeReview()` instead of setting the canvas from the take's `videoWidth`/`videoHeight`.
- [X] T018 [US1] Fit playback in `src/ui/clip/playback.ts`: `drawClipFrame`/the frame draw pass the fit to `preview.ts`.
- [X] T019 [US1] Fit the frame under the grips in `src/ui/annotating/annotation-canvas.ts`: the frame redraw passes the fit.
- [X] T020 [US1] Follow the size in `src/ui/clip/timeline-ui.ts`: on `take-added` and `property-changed`, call `resizeReview()` so the preview canvas tracks the clip size.
- [X] T021 [US1] Write one frame size in `src/infra/offline-encoder.ts`: fill the canvas with the clip's background and draw each decoded sample through `frameFor`, including `firstStill`.
- [X] T022 [P] [US1] Take the export's picture from the clip in `src/ui/exporting/export-flow.ts`: `picture: () => clip.size() ?? { width: el.cv.width, height: el.cv.height }`.
- [X] T023 [P] [US1] Take the publish picture from the clip in `src/ui/publishing/publish-flow.ts` and `src/ui/publishing/youtube-flow.ts`, so the encoded video and the aspect ratio are the clip size.
- [X] T024 [US1] Add `e2e/checks/clip-size.spec.ts`: with two fixture takes of different sizes, the review canvas is the clip size for both, each take is whole, and the exported WebM's video track is the clip size (quickstart.md).

**Checkpoint**: a clip of different-sized takes plays and exports as one size — the MVP.

---

## Phase 4: User Story 2 — Choose the clip's size (Priority: P2)

**Goal**: the clip size is a clip property, shown and edited in the clip properties panel, kept with the clip and taken back by the one undo.

**Independent Test**: open the clip's settings, change the size, watch the review re-fit, export at the new size, reload and find it, then undo it.

### Tests for User Story 2

- [X] T025 [P] [US2] Extend `src/ui/clip/clip-properties.test.ts`: the `size` property reads the clip's effective size, writes a canonical even `WxH`, and refuses `0`, `""` and beyond `MAX_EDGE` (data-model.md ClipProperties.size, ClipSize.MAX_EDGE).

### Implementation for User Story 2

- [X] T026 [P] [US2] Add the `size` control and register the `size` property in `src/ui/clip/clip-properties.ts`: add `'size'` to `ClipPropertyControl`, give `ClipProperty.value` an optional `clip` argument, and register the size property (label `Clip size`, `value` from `clip.size()`, `with` through `ClipSize.parse`) (data-model.md ClipProperties.size).
- [X] T027 [US2] Draw the size control in `src/ui/clip/properties-panel.ts`: pass `session.clip` to `property.value`, and render `size` as two number fields that build the `WxH` value on apply.
- [X] T028 [P] [US2] Pass the clip to the property in `src/ui/agent/describe.ts`, so an agent reads the size from the same register (contracts/clip-size.md).
- [X] T029 [US2] Keep the person's size in `src/domain/clip/Clip.ts`: `size()` returns the set `size` property when it parses, so a later take does not change it (data-model.md Clip.size, ClipProperties.size).
- [X] T030 [US2] Extend `e2e/checks/clip-size.spec.ts`: open the panel, the `Clip size` row shows `W×H`, typing a new size re-fits the review, the value is kept across a reload, and the one undo gives the previous size back (quickstart.md).

**Checkpoint**: the person can set the size, and it is kept and undone.

---

## Phase 5: User Story 3 — A clip's size follows the largest take (Priority: P3)

**Goal**: a larger take grows the size, a smaller one does not shrink it, and a restored clip without a stored size still resolves one.

**Independent Test**: 1280×720 then 1920×1080 → the size is 1920×1080; then a 1280×720 take → still 1920×1080; set 800×600 → 800×600; then a 1920×1080 take → still 800×600.

### Tests for User Story 3

- [X] T031 [P] [US3] Extend `src/domain/clip/Clip.test.ts`: a larger take grows the size, a smaller one leaves it, and a size the person set is not moved by a later take (data-model.md Clip.size, ClipProperties.size).

### Implementation for User Story 3

- [X] T032 [US3] Resolve the size for a restored clip in `src/domain/clip/Clip.ts` and `src/infra/clip-store.ts`: a stored take with no picture is measured on load, so the derived size of an older clip still comes back (data-model.md ClipSnapshot.takes, Clip.size).
- [X] T033 [US3] Extend `e2e/checks/clip-size.spec.ts`: a later larger take grows the review's frame and an export written after it is the larger size; a size the person set is kept when a larger take arrives (quickstart.md).

**Checkpoint**: the size follows the largest take until the person sets it.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T034 [P] Add a **Clip size** line to `FEATURES.md`, in the words of the glossary.
- [X] T035 [P] Update `README.md`'s feature list if it names the review or export picture size.
- [X] T036 Run the unit suite (`npx vitest run`) and the end-to-end suite (`npm run test:e2e`); fix what fails.
- [X] T037 Run the quickstart by hand on the dev server; state in the pull request what a check could not cover (the share picker, a real take arriving).
- [X] T038 Run `npm run typecheck` and `npm run lint`; leave the tree clean.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: after Setup; blocks every user story.
- **User Story 1 (Phase 3)**: after Foundational. No dependency on US2 or US3.
- **User Story 2 (Phase 4)**: after Foundational. Uses the `ClipSize` of Phase 2 and the `size()` of Phase 2; does not need US1.
- **User Story 3 (Phase 5)**: after Foundational. Its rule is `Clip.size()` (Phase 2); its restore fallback touches the same method.
- **Polish (Phase 6)**: after the stories wanted.

### Within Each Story

- The domain test for a rule is written before the rule it copies (T003 before T002 exists
  as a class; T013 before/with T011; T025 with T026; T031 with T029).
- Models and the value object before the drawing that uses them.
- The drawing before its end-to-end check.

### Parallel Opportunities

- T002 and T003 (value object and its test) — different files.
- T007 and T008 (the probe and the file inspector) — different files.
- T014, T015 and T022/T023 — different files.
- T025, T026 and T028 — different files.
- T034 and T035 — different files.

### User Story Independence

US1 delivers the visible unification (the MVP); US2 the control; US3 the growth and the
restore. Each is testable on its own against the Phase 2 core.

---

## Parallel Example: User Story 1

```bash
# The fit, in three files at once:
Task: "Fit the frame in src/ui/recording/preview.ts"
Task: "Fit the frame and hold the background in src/ui/clip/dissolve.ts"
Task: "Take the export's picture from the clip in src/ui/exporting/export-flow.ts"

# Then the flows that call them:
Task: "resizeReview and seekAndDraw in src/ui/clip/clip.ts"
Task: "openReview at the clip size in src/ui/clip/review-flow.ts"
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 1 (the words) and Phase 2 (the rule and the picture).
2. Phase 3 (US1): the review and the export at one size.
3. **Stop and validate**: two different-sized takes, one frame, one exported size.
4. Then US2 (the control) and US3 (the growth and the restore).

### Incremental delivery

Each phase is a green build and its own checkpoint: US1 makes the clip consistent; US2
lets the person choose; US3 proves the growth and the restore. One change per pull
request, CI owns the version.

---

## Notes

- `[P]` marks tasks that touch different files and need nothing incomplete.
- Every rule task cites its canonical field in `data-model.md`; do not restate the
  constraint, and do not let a task narrow it differently.
- A refactor's proof is the old tests passing unmodified; where a signature changes
  (T004–T006, T012), the tests change because the shape did, and that is said out loud.
- Commit after each logical group; stop at any checkpoint to validate on its own.
