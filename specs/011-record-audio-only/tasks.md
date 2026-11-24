# Tasks: Recording Audio Only

**Input**: Design documents from `specs/011-record-audio-only/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. The project's constitution (III, IV) requires a unit test for every
rule in `src/domain/` and a browser check for anything recorded, drawn, played or encoded.
The end-to-end checks are the two the verification skill allows: one for the microphone-only
record → review → export, and one for a mixed clip's black stretch.

**Organization**: Tasks are grouped by user story so each can be implemented and tested on
its own, in priority order.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel — different files, no dependency on an incomplete task
- **[Story]**: `[US1]`, `[US2]`, `[US3]` for a user story phase; no label in Setup,
  Foundational or Polish
- Every task names the file(s) it changes

## Path Conventions

Single project: application code under `src/`, the page under `web/`, the agent server under
`mcp/`, and the end-to-end suite under `e2e/`.

## Field citations

Every constrained field in `data-model.md` is cited by at least one implementing task. The
`Entity.field` form names the exact entry in `data-model.md`; a task only restates a
constraint when it adds to or narrows the canonical rule.

| Field | Cited by |
|---|---|
| `SourceSet.canRecord`, `SourceSet.soundOnly`, `SourceSet.hasPicture` (data-model.md `SourceSet.canRecord`, `SourceSet.soundOnly`, `SourceSet.hasPicture`) | T002 |
| `Take.picture`, `Take.duration`, `Take.blob` (data-model.md `Take.picture`, `Take.duration`, `Take.blob`) | T004, T011, T012, T032 |
| `Clip.size`, `Clip.hasPicture`, `Clip.keepsPicture` (data-model.md `Clip.size`, `Clip.hasPicture`, `Clip.keepsPicture`) | T003 |
| `ExportPlan.soundOnly`, `ExportPlan.intro`, `ExportPlan.introSeconds` (data-model.md `ExportPlan.soundOnly`, `ExportPlan.intro`, `ExportPlan.introSeconds`) | T005, T033, T040 |
| `TakeFile.media`, `TakeFile.container` (data-model.md `TakeFile.media`, `TakeFile.container`) | T030 |
| `TakeFileInfo.duration`, `TakeFileInfo.hasAudio`, `TakeFileInfo.picture` (data-model.md `TakeFileInfo.duration`, `TakeFileInfo.hasAudio`, `TakeFileInfo.picture`) | T031, T032 |
| `ClipProperties.addToExport` (data-model.md `ClipProperties` and the `Add to export` paragraph) | T035 |
| `ClipSnapshot.takes` (data-model.md `ClipSnapshot`) | T029 |
| `Session.audio` (data-model.md `Session`) | T011 |
| The sound-only file's `tracks`, `type` and `name` (data-model.md `The sound-only file`) | T033, T029 |

---

## Phase 1: Setup

**Purpose**: the words come first (constitution V).

- [X] T001 Write **sound-only** into `GLOSSARY.md` and update the **record source**, **source set**, **export**, **Bluesky** and **YouTube** entries: a sound-only take is the microphone alone with no picture; its file is the sound alone; a video service does not take it.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the shared derived facts every story asks — the source rule, the clip's two
picture questions, the plan's sound-only answer — and the test takes that must look like
real ones.

**⚠️ CRITICAL**: no user story work begins until this phase is complete.

- [X] T002 [P] Add `canRecord` and `soundOnly` to `src/domain/capture/SourceSet.ts` and extend `src/domain/capture/SourceSet.test.ts`: the microphone alone can record; a picture or the microphone is a source; none is not (data-model.md `SourceSet.canRecord`, `SourceSet.soundOnly`, `SourceSet.hasPicture`).
- [X] T003 [P] Add `Clip.hasPicture()` (any take) and `Clip.keepsPicture()` (the kept stretches) to `src/domain/clip/Clip.ts`, and extend `src/domain/clip/Clip.test.ts`: a sound-only clip has neither, a mixed clip has both, and cutting the only picture away leaves `hasPicture()` true and `keepsPicture()` false (data-model.md `Clip.size`, `Clip.hasPicture`, `Clip.keepsPicture`).
- [X] T004 [P] Give the test takes the picture a real take carries: update the `FakeTakes`/`clipOf` helpers in `src/application/export-video.test.ts`, `src/application/export-clip.test.ts`, `src/application/publish-to-bluesky.test.ts`, `src/application/publish-to-youtube.test.ts` and `src/ui/agent/edit.test.ts`; add a sound-only helper where a test needs one (data-model.md `Take.picture`).
- [X] T005 [P] Add `soundOnly` to `ExportPlan` in `src/domain/clip/ExportPlan.ts` and extend `src/domain/clip/ExportPlan.test.ts`: the fact comes from the kept segments' pictures; a sound-only plan drops the card and leaves `introSeconds` 0; a mixed plan keeps the card and the offset (data-model.md `ExportPlan.soundOnly`, `ExportPlan.intro`, `ExportPlan.introSeconds`).
- [X] T006 [P] Give the e2e publishing seeder's take its 640×360 picture in `e2e/checks/publishing.spec.ts`, so the existing publishing checks stay picture checks (data-model.md `Take.picture`).

**Checkpoint**: the source rule and the two picture questions are in place, and the
existing suite still means what it meant. Every story can start.

---

## Phase 3: User Story 1 — Record a take of sound alone (Priority: P1) 🎯 MVP

**Goal**: the microphone alone records a take, the review shows the sound-only clip, and
the playhead, waveform, marks, cuts and playback work.

**Independent Test**: with the screen and webcam off, turn the microphone on, record a few
seconds, stop, and confirm a take arrived, the review shows the waveform and no picture,
and ▶ plays the recorded sound.

### Tests for User Story 1

> **NOTE: Write these tests first and watch them fail.**

- [X] T007 [P] [US1] Extend `src/application/record-take.test.ts`: the microphone alone starts and asks the compositor for no picture, no picture element and no bubble; no source refuses naming the three; an empty stream refuses and adds no take (data-model.md `SourceSet.canRecord`, `Take.picture`).
- [X] T008 [P] [US1] Extend `src/ui/clip/size-estimate.test.ts` for `estimateSoundText`: a ten-second clip is `~0.1–0.2 MB (audio)` and zero is `~0.0–0.0 MB (audio)`.
- [X] T009 [P] [US1] Add the first part of a browser check to `e2e/checks/capture.spec.ts`: press **Mic** only, confirm the status says the take is sound-only, record, stop, and confirm the review is in sound-only mode with a visible waveform and no picture. It will be extended in T029 and T039.
- [X] T010 [P] [US1] Update the surface gate in `e2e/checks/agent.spec.ts`: with every source off, `takes.start` refuses and names the screen, webcam and microphone.

### Implementation for User Story 1

- [X] T011 [US1] Record a take with no picture in `src/application/record-take.ts`: refuse only when `!sources.canRecord`, pass no picture, picture element or bubble when there is no picture source, refuse a composed stream with no tracks, and keep the audio flag through `setAudio` (data-model.md `SourceSet.canRecord`, `Take.picture`, `Take.duration`, `Session.audio`).
- [X] T012 [P] [US1] Choose the recording type from the stream in `src/infra/codecs.ts` and `src/infra/take-recorder.ts`: `audio/webm;codecs=opus` (then `audio/webm`) when there is no video track, and the blob keeps that type (data-model.md `Take.blob`, the sound-only file's `type`).
- [X] T013 [P] [US1] Confirm and document the audio-only stream in `src/infra/compositor.ts`: no picture source yields the mixed microphone sound alone, with no video track.
- [X] T014 [P] [US1] Draw the sound-only preview in `src/ui/recording/preview.ts`: `drawSoundOnly()` paints the app's panel on the canvas; `drawFrame`/`drawClipFrame` fill the background when a take has no picture instead of throwing.
- [X] T015 [P] [US1] Add `estimateSoundText` to `src/ui/clip/size-estimate.ts` at the export's 128 kbps, with the `(audio)` label.
- [X] T016 [US1] Wire the microphone-only live state in `src/ui/recording/record-flow.ts`: `canRecord()` replaces the picture gate; the mic-only preview, idle overlay, status and Record label follow; `toggleRecord` says "turn on a source" only when none is on; a sound-only take draws the panel and starts the live timeline (depends on T011, T014).
- [X] T017 [US1] Show the sound-only live timeline in `src/ui/recording/live-timeline.ts`: set the `sound-only` class, keep the growing waveform, and use `estimateSoundText` for the size (depends on T014, T015).
- [X] T018 [US1] Open the sound-only review in `src/ui/clip/clip.ts`, `src/ui/clip/review-flow.ts`, `src/ui/clip/playback.ts` and `src/ui/lifecycle/view-lifetime.ts`: `seekAndDraw`, `resizeReview`, playback and `openReview` draw the sound-only panel; the strip is not built; the mode is cleared with the clip (depends on T003, T014).
- [X] T019 [US1] Follow the clip's picture in `src/ui/clip/timeline-ui.ts` and `src/ui/clip/thumbnail.ts`: use the audio estimate, skip the strip when the clip has no picture, and leave a 0×0 frame's cell blank instead of throwing (depends on T003, T015).
- [X] T020 [P] [US1] Hide the annotation actions for a clip with no picture in `src/ui/cutting/marks.ts`; cuts and the section's own actions remain (depends on T003).
- [X] T021 [P] [US1] Add the sound-only timeline layout to `web/styles.css`: hide the thumbnail strip and give the waveform its room.
- [X] T022 [P] [US1] Name the microphone in the idle hint in `web/index.html`: "Turn on Screen, Webcam or Mic, or import a file".
- [X] T023 [US1] Make the automation surface and MCP agree in `src/ui/agent/takes.ts`, `src/main.ts` and `mcp/src/tools.ts`: the gate is `canRecord`, the refusal names the three sources, and `start_take` says a source is needed and the microphone alone is one (depends on T016).

**Checkpoint**: User Story 1 is fully functional and independently testable; the capture
check's first part and the surface gate pass.

---

## Phase 4: User Story 2 — The sound leaves as a file, and comes back (Priority: P2)

**Goal**: a sound-only clip exports WebM or MP4 with no picture, imports back as a take,
survives a reload, and asks for no card it cannot draw.

**Independent Test**: record a sound-only clip (or seed one), export WebM and MP4, confirm
each file has sound and no picture; import the file, reload the page, and confirm the clip
is back as a sound-only clip.

### Tests for User Story 2

- [X] T024 [P] [US2] Extend `src/application/export-clip.test.ts`: `planExport` says `soundOnly` for a clip of sound-only takes and false for a picture clip (data-model.md `ExportPlan.soundOnly`).
- [X] T025 [P] [US2] Extend `src/domain/clip/TakeFile.test.ts`: `audio/webm` and `audio/mp4` are accepted with their media kind; `audio/mpeg` and `audio/wav` are refused; `audio/webm` answers `audio/webm` (data-model.md `TakeFile.media`, `TakeFile.container`).
- [X] T026 [P] [US2] Extend `src/application/import-take.test.ts`: a sound-only file becomes a take with `picture: null`, sets the sound, and leaves the clip with no picture (data-model.md `Take.picture`, `TakeFileInfo.picture`).
- [X] T027 [P] [US2] Extend `src/ui/clip/clip-properties.test.ts`: with a clip that has a take and no picture, `addToExport` is blocked with a reason naming the picture; with a mixed clip it follows the existing card rules (data-model.md `ClipProperties.addToExport`).
- [X] T028 [P] [US2] Add `hasSound(page, bytes)` to `e2e/helpers/exports.ts`, decoding a file's audio in the page so an exported sound track can be asserted.
- [X] T029 [US2] Extend the `e2e/checks/capture.spec.ts` check with the sound-only file: export WebM (and MP4 when the browser has AAC), assert the true duration, the 0×0 picture and the decodable sound; reload and assert the clip comes back sound-only, cuts included (data-model.md the sound-only file's `tracks`, `type` and `name`; `ClipSnapshot.takes`).

### Implementation for User Story 2

- [X] T030 [US2] Add the media kind to `src/domain/clip/TakeFile.ts`: `audio/webm` and `audio/mp4` join the two containers, `mime` follows the kind, and another audio container is refused (data-model.md `TakeFile.media`, `TakeFile.container`).
- [X] T031 [US2] Let the inspector read a sound file in `src/infra/take-file.ts` and update `src/application/ports/TakeFilePort.ts`: a file with an audio track and no video track is a take with `picture: null`; a file with neither is rejected (data-model.md `TakeFileInfo.duration`, `TakeFileInfo.hasAudio`, `TakeFileInfo.picture`).
- [X] T032 [US2] Take a sound file in through `src/application/import-take.ts`, `src/ui/recording/import-flow.ts` and `web/index.html`: the copy says files, the file input accepts the two audio types, and the take is appended with its own length and sound (data-model.md `Take.picture`, `TakeFileInfo.picture`).
- [X] T033 [US2] Write the sound-only file in `src/infra/offline-encoder.ts`: when `plan.soundOnly`, build an `Output` with an audio track only — Opus for WebM, AAC for MP4 — no canvas, no video codec, no card; the blob is `audio/webm` or `audio/mp4` and the download keeps its name (data-model.md `ExportPlan.soundOnly`, the sound-only file's `tracks`, `type` and `name`).
- [X] T034 [US2] Ask for no card a sound-only file cannot draw in `src/ui/exporting/export-flow.ts`: pass `intro: null` when `!clip.keepsPicture()` so no logo is loaded for an audio export (data-model.md `Clip.keepsPicture`, `ExportPlan.intro`).
- [X] T035 [US2] Block the card switch in `src/ui/clip/clip-properties.ts`: when a clip has takes and no picture, `addToExport` refuses with the reason that a card needs a picture; a logo stays the clip's value and draws nothing (data-model.md `ClipProperties.addToExport`).

**Checkpoint**: User Stories 1 and 2 both work independently; a sound-only clip can be
recorded, exported in both containers, imported back and restored.

---

## Phase 5: User Story 3 — A clip that holds sound and picture (Priority: P3)

**Goal**: a mixed clip exports a video with black over its sound-only stretches; a clip
whose kept stretches have no picture is a sound file and offers no video service.

**Independent Test**: seed a sound-only take and a picture take, export, and confirm the
file's picture is black over the sound-only stretch and the picture take's own over the
other; cut the picture stretch away and export, and confirm the file is sound only with no
video-service destination.

### Tests for User Story 3

- [X] T036 [P] [US3] Extend `src/application/publish-to-bluesky.test.ts` and `src/application/publish-to-youtube.test.ts`: a sound-only plan is refused with a reason naming the picture, before the encode; the service receives nothing (data-model.md `ExportPlan.soundOnly`).
- [X] T037 [P] [US3] Add an audio-only mode to `e2e/fixtures/encode-take.ts` (a tone, no video track) and describe its no-picture shape in `e2e/fixtures/takes.ts`, so a mixed clip can be seeded deterministically.
- [X] T038 [US3] Add the mixed-clip check to `e2e/checks/export.spec.ts`: seed the sound-only fixture and a picture fixture, export, and assert the picture is black over the sound-only stretch and painted over the picture stretch; cut the picture stretch away and assert the file has no video track.
- [X] T039 [US3] Extend the `e2e/checks/capture.spec.ts` check with the destination rule: open the Export menu and assert the Bluesky and YouTube entries are disabled with their reason.

### Implementation for User Story 3

- [X] T040 [US3] Write a mixed plan's sound-only stretch in `src/infra/offline-encoder.ts`: for a step with no video track, add black frames at 30 fps over its pieces with the annotations and preview drawn, while its sound comes through the audio renderer; make `firstStill` walk to the first kept picture for the card (depends on T033; data-model.md `ExportPlan.soundOnly`).
- [X] T041 [P] [US3] Refuse a sound-only plan in `src/application/publish-to-bluesky.ts` and `src/application/publish-to-youtube.ts` before the ceiling check and the encode, with the destination's reason (data-model.md `ExportPlan.soundOnly`).
- [X] T042 [P] [US3] Disable the two publish entries in `src/ui/exporting/export-menu.ts` when `!session.clip.keepsPicture()`, with the reason as the disabled item's tooltip (data-model.md `Clip.keepsPicture`).
- [X] T043 [P] [US3] Refuse a sound-only clip in `src/ui/publishing/publish-flow.ts` and `src/ui/publishing/youtube-flow.ts` before the client is loaded or a sign-in is asked for (data-model.md `Clip.keepsPicture`).

**Checkpoint**: All three stories work: record, export/import/restore, and mix with
picture; a video service is offered only for a clip that keeps a picture.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: the written product, the final proof, and what was not verified.

- [X] T044 [P] Update the product documents: `FEATURES.md` (sources, export, import, microphone), `README.md` (headline, usage, export note), `src/ui/shell/help-steps.html` and `web/help.html` (Mic alone, sound-only export, no video service).
- [X] T045 Walk `specs/011-record-audio-only/spec.md` FR-001–FR-020 and the validation table in `data-model.md`; confirm each has a task, a unit test or a browser check, and fix a gap before closing.
- [X] T046 Run `npm run lint && npm run typecheck && npx vitest run && npm run build` from the repository root; fix every failure.
- [X] T047 Run the full end-to-end suite with `npm run test:e2e`; confirm the two new checks and every picture-clip check (publishing, agent, export) pass.
- [ ] T048 Run the by-hand session in `specs/011-record-audio-only/quickstart.md` with the person's own microphone and ears; record the MP4/AAC result if the browser has it, and state what could not be verified.
- [X] T049 Confirm `package.json` is untouched, the change is one pull request, and no version bump was made; CI owns the version.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: starts immediately; T001 blocks nothing in code but is the
  constitution's words-first gate.
- **Foundational (Phase 2)**: T002–T006 block every story. T004 must land before T005 so
  the existing export tests keep meaning a picture clip; T002, T003 and T005 can proceed
  in parallel.
- **User Stories (Phase 3+)**: all start after Phase 2.
  - **US1** has no story dependency; it delivers the microphone-only take and the review.
  - **US2** uses the foundational `ExportPlan` and the domain `TakeFile`; its browser check
    extends the US1 capture check, so T029 runs after T009 and the US1 review.
  - **US3** uses the US2 encoder (T033) for its video path and its audio-only fixture; it
    can start once T033 is in place.
- **Polish (Phase 6)**: after all three stories.

### User Story Dependencies

- **US1 (P1)**: no other story.
- **US2 (P2)**: no implementation dependency on US1's UI; its end-to-end check reuses the
  US1 recorded clip. The file work is unit-testable without US1.
- **US3 (P3)**: depends on US2's encoder (T033) and shares the fixture with its check; no
  implementation dependency on US1's UI.

### Within Each User Story

- Tests are written and fail first.
- Domain facts and ports before the encoder; the encoder before the flow; the flow before
  the browser check.
- The capture check grows in three tasks — first part (T009), export/restore (T029),
  destination rule (T039) — each after its implementation.

### Parallel Opportunities

- Phase 2: T002, T003, T004, T005 and T006 touch different files.
- US1 tests: T007–T010; US1 codecs/preview/estimate/compositor: T012–T015; CSS and markup:
  T021, T022.
- US2 tests: T024–T028; its domain, inspector and flow tasks can follow their tests.
- US3 tests: T036, T037; the publish use cases, menu and flow: T041–T043.
- Polish documentation (T044) can run alongside the final suite.

---

## Parallel Example: User Story 1

```bash
# Tests first, in parallel:
Task: "Extend src/application/record-take.test.ts for the microphone alone"
Task: "Extend src/ui/clip/size-estimate.test.ts for the audio estimate"
Task: "Add the first part of the browser check to e2e/checks/capture.spec.ts"

# Then the independent browser pieces:
Task: "Choose the audio mime in src/infra/codecs.ts and src/infra/take-recorder.ts"
Task: "Draw the sound-only preview in src/ui/recording/preview.ts"
Task: "Add estimateSoundText to src/ui/clip/size-estimate.ts"
```

## Parallel Example: User Story 2

```bash
Task: "Extend src/domain/clip/TakeFile.test.ts for the audio kinds"
Task: "Extend src/application/import-take.test.ts for a sound-only file"
Task: "Extend src/ui/clip/clip-properties.test.ts for the card block"
Task: "Add hasSound to e2e/helpers/exports.ts"
```

## Parallel Example: User Story 3

```bash
Task: "Extend the publish tests for a sound-only refusal"
Task: "Add the audio-only fixture to e2e/fixtures/encode-take.ts and e2e/fixtures/takes.ts"
Task: "Refuse a sound-only plan in the two publish use cases"
Task: "Disable the publish entries in src/ui/exporting/export-menu.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1: the words.
2. Complete Phase 2: the source rule, the two picture questions, the plan fact, and the
   test takes that look like real ones.
3. Complete Phase 3: the microphone-only take and its review.
4. **STOP and VALIDATE**: the capture check's first part, the record-take tests and the
   surface gate pass.
5. A recording that cannot leave the app is only half the value: the first usable
   increment is US1 + US2, which adds the sound file and its return.

### Incremental Delivery

1. Setup + Foundational → the rule is in place, with the existing suite still meaningful.
2. US1 → a sound-only take and review (MVP slice) → validate.
3. US2 → export, import and restore → validate.
4. US3 → mixed clips and the destination rule → validate.
5. Polish → docs, full suite, the real microphone session.

### Parallel Team Strategy

- One developer on the foundational facts and the world-facing tests.
- After Phase 2, one on the recording and review (US1), one on the file and import (US2),
  one on mixing and destinations (US3), with the capture check owned by the US1/US2 pair
  so the additions do not collide.

---

## Notes

- Tests are required by the constitution, not optional here.
- A take with no audio track is refused; **silence** is a normal sound-only take and is
  kept.
- The review asks `Clip.hasPicture()` (the clip's takes); the file and the publish menu
  ask `Clip.keepsPicture()` (the kept stretches). Keep the two apart.
- The existing `e2e/checks/publishing.spec.ts` seeder must get its picture (T006) or the
  publishing checks become sound-only and fail for the wrong reason.
- Do not bump `package.json`; CI owns the version.
- Commit after each logical group; the user merges the pull request.
