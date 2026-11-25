---

description: "Task list for Sound Annotations"
---

# Tasks: Sound Annotations

**Input**: Design documents from `specs/014-sound-annotations/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/sound-annotation.md, quickstart.md

**Tests**: Included. The project's constitution (III, IV) requires a unit test for every rule
in `src/domain/` and a browser check for anything drawn, played or encoded. No TDD ordering is
implied: write each unit test beside its rule. The end-to-end additions are the two the
verification skill allows — one committed check in `e2e/checks/annotations.spec.ts` for the
file, and one temporary `verify-*.html` harness for the review and the editing.

**Organization**: Tasks are grouped by user story so each can be implemented and tested on its
own, in priority order. User stories from spec.md:
- **US1** (P1) — A stock sound over a stretch, heard with the recording
- **US2** (P2) — Choose which sound, and change everything about it
- **US3** (P3) — It is a kind among the kinds, and it fits the whole clip

**PR map** (Project workflow: one change per pull request): Phase 1 → `docs/sound-annotation-words`;
Phase 2 → `feat/sound-annotation-kind` then `feat/stock-sound-store` then
`feat/sound-annotation-export`; Phase 3 → `feat/sound-annotation-plugin` then
`feat/sound-annotation-review`; Phase 4 → `feat/sound-annotation-preferences`; Phase 5 →
`feat/sound-annotation-family`; Phase 6 → `docs/sound-annotation-final`. CI owns the version —
`package.json` is never bumped by hand.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel — different files, no dependency on an incomplete task
- **[Story]**: `[US1]`, `[US2]`, `[US3]` for a user story phase; no label in Setup, Foundational or Polish
- Every task names the file(s) it changes

## Path Conventions

Single-project browser application: application code under `src/`, the page and its served files
under `web/`, the agent server under `mcp/`, the end-to-end suite under `e2e/`, and the feature's
documents under `specs/014-sound-annotations/`.

## Field citations

Every constrained field in `data-model.md` is cited by at least one implementing task, in the
`Entity.field` form that names the exact entry in `data-model.md`. A task restates a constraint
only when it adds to or narrows the canonical rule.

| Field | Cited by |
|---|---|
| `StockSounds.STOCK_SOUNDS`, `StockSounds.isStockSound`, `StockSounds.stockSound`, `StockSounds.DEFAULT_STOCK_SOUND`, `StockSounds.SOUND_LEVEL`, `StockSound.name` (data-model.md `StockSounds`) | T003, T004 |
| `SoundAnnotation.id`, `SoundAnnotation.geometry`, `SoundAnnotation.create`, `SoundAnnotation.restore`, `SoundAnnotation.isUsable` (data-model.md `SoundAnnotation`) | T005, T006, T007 |
| `SoundAnnotation.handles`, `SoundAnnotation.withHandle`, `SoundAnnotation.movedBy`, `SoundAnnotation.withSpan`, `SoundAnnotation.withSound`, `SoundAnnotation.duplicated`, `SoundAnnotation.hitTest`, `SoundAnnotation.stored` (data-model.md `SoundAnnotation`) | T005, T006, T017, T018 |
| `ExportPlan.sound`, `ExportPlan.soundings`, `ExportPlan.audio`, `Sounding.sound`, `Sounding.at`, `Sounding.length` (data-model.md `ExportPlan`) | T010, T011, T012, T013 |
| `planExport` carries the clip's sound annotations (data-model.md `planExport`) | T012 |
| `StockSoundPort.buffer`, `StockSoundPort.get`, `StockSoundPort.ready`, `StockSoundPort.clear` (data-model.md `The stock sound at the edge`) | T009 |
| `renderAudio` adds the sounds after the boost (data-model.md `The file's mix`) | T013 |
| `sounds.tick`, `sounds.reset`, the destination connection (data-model.md `The review's mix`) | T018 |
| `SoundPlugin.id`, `SoundPlugin.action`, `SoundPlugin.needsPicture`, `SoundPlugin.properties`, `SoundPlugin.renderer`, `SoundPlugin.begin` (data-model.md `The kind in the view`) | T015, T016, T022, T026 |
| `PropertyControl` gains `'sound'`; the `sound` `AnnotationProperty` `value`/`with` (data-model.md `The kind in the view`) | T021, T022, T023, T024 |
| The lane's boxless controls and the inspector's no-box placement (data-model.md `The lane, and a kind with no box`) | T017 |
| `annotate-options` offers a picture-less kind (data-model.md `annotate-options`) | T027 |
| The sidecar and the store carry the sound by name (data-model.md `The sidecar and the store`) | T029 |
| `edit.annotate('sound', …)`, `edit.setProperty(id, 'sound', …)`, `describe`, MCP `annotate`, MCP `set_property` (data-model.md `The automation surface`) | T014, T024, T028 |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: the words come first (constitution V), and a known-green baseline.

- [X] T001 Add **sound annotation** and **stock sound** (and the stock list) to `docs/GLOSSARY.md` — under the *Annotating* section — and note the new modules (`SoundAnnotation.ts`, `StockSounds.ts`, `sound-plugin.ts`, `stock-sounds.ts`, `ui/clip/sounds.ts`) in `.agents/skills/domain-model/SKILL.md`; add the sound row to `docs/FEATURES.md` and the help text in `web/index.html`. Docs only, no code.
- [X] T002 [P] Confirm a green baseline before any change: run `npx vitest run` and `npm run test:e2e` at repository root and record the result.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the kind, the app's sounds and their bytes, and the file's mix — the core every
story reads. Nothing here creates a sound from the view yet.

**⚠️ CRITICAL**: no user story can begin until this phase is complete.

- [X] T003 Create `src/domain/sound/StockSounds.ts` exactly as `data-model.md` `StockSounds` defines: the `StockSound` shape (`name`, `label`, `file`), `STOCK_SOUNDS` (the app's chosen set: **chime**, **gong**, **pluck** … **wow**, each file a relative `./sounds/…` path), `isStockSound(name)`, `stockSound(name)`, `DEFAULT_STOCK_SOUND`, and `SOUND_LEVEL`. No bytes, no `fetch`, no clock — pure.
- [X] T004 [P] Add `src/domain/sound/StockSounds.test.ts`: the list holds the palette; `isStockSound` is true for them and false for a name the app does not serve; every `file` is a relative `./sounds/…` path; `DEFAULT_STOCK_SOUND` is one of the list. Run `npx vitest run src/domain/sound`.
- [X] T005 Create `src/domain/annotation/SoundAnnotation.ts` exactly as `data-model.md` `SoundAnnotation` defines: `static id = 'sound'`; geometry `{ sound }`; `create` (null unless `isStockSound`); `restore` (null for an unknown sound); `isUsable`; `handles()` → `[]`; `withHandle()` → `null`; `movedBy()` → `this`; `withSpan`; `withSound` (null when not a stock sound); `duplicated`; `hitTest()` → `false`; `stored()`. Import `isStockSound`/the list from `StockSounds.ts`; touch no DOM.
- [X] T006 [P] Add `src/domain/annotation/SoundAnnotation.test.ts`: a stock sound is required (`create(span,'applause')` is null); `restore` of an unknown name is null; `handles()` is `[]`; `withHandle` is null; `hitTest` is false; `movedBy` keeps it; `withSound` changes the sound and keeps id, span and kind; `duplicated` keeps the sound under a new id; `stored`/`restore` round-trip the name. Run `npx vitest run src/domain/annotation`.
- [X] T007 Register the kind in `src/domain/annotation/kinds.ts` (a line, `registerKind(SoundAnnotation)`), and extend `src/domain/annotation/kinds.test.ts`: `annotationFrom` rebuilds a sound annotation and answers **null** for a sound this build does not know.
- [X] T008 [P] Add the app's stock sound files under `web/public/sounds/` — the palette's `.wav` files — served beside the app, small and mastered to sit over a voice. Matches the `file` paths `StockSounds.STOCK_SOUNDS` declares.
- [X] T009 [P] Create `src/infra/stock-sounds.ts` behind `src/application/ports/StockSoundPort.ts` exactly as `data-model.md` `The stock sound at the edge` defines: `buffer(name)` fetches the app's `./sounds/…` file, decodes it **once** into an `AudioBuffer` at the app's rate and caches it by name; `get(name)`; `ready()`; `clear()`; a failed fetch or decode caches "none" and contributes silence. Add a node test with a fake port (cache, unknown → null, a failing decode → null).
- [X] T010 Add `sound: readonly SoundAnnotation[]` and `soundings(): readonly Sounding[]` to `src/domain/clip/ExportPlan.ts`, and make `audio` also true when `soundings()` is not empty, exactly as `data-model.md` `ExportPlan` defines: `Sounding = { sound, at, length }`; the intersection of each annotation's stretch with the kept pieces (a cut takes its part; a fully-cut stretch answers nothing); `at` in output seconds past any card.
- [X] T011 [P] Extend `src/domain/clip/ExportPlan.test.ts`: `soundings()` is one entry per kept stretch a sound covers; a cut through a stretch leaves the kept part only; a fully-cut stretch answers nothing; `audio` is true for a clip with no recorded sound that holds a sound annotation. Run `npx vitest run src/domain/clip/ExportPlan.test.ts`.
- [X] T012 Pass the clip's sound annotations from `src/application/export-clip.ts` into `ExportPlan.of` (read `clip.annotations` for the kind), so every plan builder — the download, both publishes, the review — inherits them. Extend `src/application/export-clip.test.ts`: the plan carries them.
- [X] T013 In `src/infra/offline-encoder.ts`, after the mix is rendered and the boost gain applied, add each `plan.soundings()` stock sound's samples into the rendered buffer at `at · SAMPLE_RATE`, scaled by `SOUND_LEVEL`, clamped — per `data-model.md` `The file's mix`. Decode via `src/infra/stock-sounds.ts` (a `OfflineAudioContext` decode at the mixing rate). Cite `ExportPlan.soundings`.
- [X] T014 Add `makeSound(kind, params, span)` to `src/ui/agent/make.ts` (data alone): a sound annotation over the span in `params.sound` or `DEFAULT_STOCK_SOUND`, refused with a reason when the name is not one the app serves; wire it in the `makeAnnotation` dispatch so `edit.annotate('sound', …)` works without the view. Per `data-model.md` `The automation surface`.

**Checkpoint**: a sound annotation can be created from data, the plan carries it and the file mixes it. The view still cannot make one by hand.

---

## Phase 3: User Story 1 - A stock sound over a stretch, heard with the recording (Priority: P1) 🎯 MVP

**Goal**: A person selects a stretch, adds a **Sound**, and hears it mixed with the recording in
the review and in every file.

**Independent Test**: In review, select a stretch, add a **Sound**; it appears on the lane and
plays over that stretch (and nowhere else) with the recorded voice; export the clip and read the
file back — the sound is in the audio at its stretch.

### Tests for User Story 1

- [X] T015 [US1] Extend `e2e/checks/annotations.spec.ts` with the sound check: place a sound annotation through the data-only maker (`edit.annotate('sound', { span, sound })`); export; read the file back in the page — the stock sound's samples are present over the stretch and absent outside it, the recording's samples and length are unchanged versus the same export with the sound removed, a **silent** clip gains an audio track, and a **cut** through the stretch is silent over the cut. Run `npm run test:e2e -- e2e/checks/annotations.spec.ts`.

### Implementation for User Story 1

- [X] T016 [US1] Create `src/ui/annotating/sound-plugin.ts`: `id = SoundAnnotation.id`; `action` (`label: 'Sound'`, a title, a speaker icon); a **no-op** `renderer` (the kind draws nothing); `begin(ctx)` places one in `DEFAULT_STOCK_SOUND` over `ctx.span` and `ctx.commit`s it, then opens its **preferences** via the shared inspector. No `properties` yet (US2 adds the sound property). Per `data-model.md` `SoundPlugin`.
- [X] T017 [US1] Wire the kind in `src/ui/annotating/plugins.ts` (a line) and `src/main.ts` (the plugin is registered with the others), so the **Sound** row appears in the annotate options on a clip with a picture.
- [X] T018 [US1] Make the shared editing reach a boxless annotation, per `data-model.md` `The lane, and a kind with no box`: in `src/ui/annotating/properties-inspector.ts` add a placement **fallback** when `annotation.handles()` is empty (anchor beside the lane's picked mark; the preview's lower area as the fallback); in `src/ui/annotating/annotation-lane.ts` draw the picked boxless annotation's controls — **remove** and **settings** — beside its band as small buttons, **settings** opening the shared inspector (`inspector.open(annotation)`).
- [X] T019 [US1] Create `src/ui/clip/sounds.ts` per `data-model.md` `The review's mix`: `tick(keptSeconds)` starts a stock sound's buffer from the review's `AudioContext` (`elementAudio()`), connected straight to the destination (not through the boost), when the playhead has **crossed** the start of a `sounding` moving forward, and stops it at its end; `reset()` clears the crossings on a pause, a seek and a cut jump. Read the same `plan.soundings()` the file does.
- [X] T020 [US1] Hook the review's trigger in `src/ui/clip/playback.ts`: call `sounds.tick(keptNow)` from the playback loop with where the playhead is in **kept** time (`keptOf`), and `sounds.reset()` on pause, on a seek and on a cut jump. No behaviour change to the transport.
- [X] T021 [US1] Prove the review by a temporary harness: add `web/verify-sound-annotations.html` on the dev server, drive adding a sound, playing it (sound at its stretch, silent outside), and a seek (no double-play, none on a jump); paste its output (screenshots and console) into the pull request and **delete the file before the commit**, as the verification skill asks.

**Checkpoint**: a person can place a stock sound and hear it in the review and the file — the MVP.

---

## Phase 4: User Story 2 - Choose which sound, and change everything about it (Priority: P2)

**Goal**: The sound is chosen in the annotation's **preferences** from the app's stock list, and
the annotation is edited like any other — its sound, its length, a copy, a delete, an undo.

**Independent Test**: Add a sound, open its preferences, change the sound to the other stock sound
and hear the change in the review and the file; change its duration; copy it to the playhead;
delete it and take it back with the one undo.

### Tests for User Story 2

- [X] T022 [US2] Add unit tests for the `sound` property in `src/ui/annotating/sound-plugin.test.ts`: `value` reads the annotation's sound; `with` changes it and **refuses** a name the app does not serve (null); a change through `clip.changeAnnotation` is announced (so the one undo holds it). Extend `src/ui/agent/describe.test.ts`: a sound annotation's properties include **Sound** and **Duration**.

### Implementation for User Story 2

- [X] T023 [US2] Add `'sound'` to `PropertyControl` in `src/ui/annotating/annotation-plugin.ts` (per `data-model.md` `The kind in the view`).
- [X] T024 [US2] Declare the sound property on the plugin in `src/ui/annotating/sound-plugin.ts`: `{ id: 'sound', label: 'Sound', control: 'sound', value: a => sound name, with: (a, name) => a.withSound(name) }` — reading and writing `SoundAnnotation.withSound` (`SoundAnnotation.withSound`, `SoundAnnotation.geometry`). `propertiesFor` adds the shared **duration** on top, so no duration code is written here.
- [X] T025 [US2] Render the `'sound'` control in `src/ui/annotating/properties-inspector.ts` as the app's **list of stock sounds** (`STOCK_SOUNDS`): a labelled row per sound with the current one told apart, applying through `property.with` and `clip.changeAnnotation`, exactly as the colour swatches and the words row do.
- [X] T026 [US2] Fold the editing into the harness: change the **Sound** in the preferences and hear it in the review and the file; change the **Duration**; copy the sound to the playhead and confirm it is independent; delete it and take it back with the one undo; a sound-only clip's sound file carries the chosen sound. Paste the output and delete the harness.

**Checkpoint**: the sound is chosen in the one place the spec names, and the annotation is fully editable.

---

## Phase 5: User Story 3 - It is a kind among the kinds, and it fits the whole clip (Priority: P3)

**Goal**: The sound kind fits the family without changing it, reaches a clip with no picture, and
reaches an agent — and a sound this build does not know is left out, not a failure.

**Independent Test**: Confirm every arrow, image, text and cut behaves as before with the sound
kind present; open a sound-only clip and add a sound to it; open a clip/sidecar with an unknown
sound and confirm it opens with the rest intact.

### Implementation for User Story 3

- [X] T027 [US3] Add optional `needsPicture?: boolean` (default true) to `AnnotationPlugin` in `src/ui/annotating/annotation-plugin.ts`, and set `needsPicture = false` on `SoundPlugin` in `src/ui/annotating/sound-plugin.ts` (`SoundPlugin.needsPicture`).
- [X] T028 [US3] Update `src/ui/annotating/annotate-options.ts` per `data-model.md` `annotate-options`: with a picture, every kind as today; with **no** picture, only the kinds whose `needsPicture === false` — the sound. Add a test in `src/ui/annotating/annotate-options.test.ts` (or the plugin test) that a picture-less clip offers only the sound.
- [X] T029 [US3] Reach an agent from the MCP server in `mcp/src/tools.ts`: `annotate`'s `kind` enum gains `"sound"` with a `sound` name, and its description says the sounds are the app's own and there is no file to give; `set_property`'s description names `"sound"` as a value of a sound annotation. Extend `mcp/src/tools.test.ts`.
- [X] T030 [US3] Prove the sidecar and the store carry the sound by name, per `data-model.md` `The sidecar and the store`: extend `src/infra/annotation-sidecar.test.ts` (a sound travels beside a file and comes back through `annotationFrom`; an unknown sound is left out and the rest opens) and confirm `clip-store.ts` needs no change.
- [X] T031 [US3] Prove the family did not change (the regression gate): `npx vitest run src/domain/annotation src/domain/clip src/ui/annotating` passes with the existing `Arrow`, `ImageAnnotation`, `TextAnnotation`, `AnnotationSet`, `Clip` and cut tests **unmodified**; `npm run test:e2e -- e2e/checks/annotations.spec.ts e2e/checks/export.spec.ts e2e/checks/profiles.spec.ts` passes with no existing check changed except the sound fold.

**Checkpoint**: all three stories work independently; a sound-only clip takes a sound, and an unknown sound is left out.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: the docs and the final gates.

- [X] T032 [P] Finish the docs: the help modal and `docs/FEATURES.md`; the `docs/GLOSSARY.md` cross-references (**annotation kind**, **annotation plugin**, **annotation lane**, **sound boost**) and the `README` module map if it lists the annotating modules.
- [X] T033 Run the full gates: `npm run lint && npm run typecheck && npx vitest run && npm run build`, then `npm run test:e2e`. Fix anything they surface.
- [X] T034 Validate `specs/014-sound-annotations/quickstart.md` end to end (the by-hand walkthrough), and record the **person's own session** as the stated gap for whether a clap or a gong sits right over a voice.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately.
- **Foundational (Phase 2)**: depends on Setup — **blocks every user story**.
- **US1 (Phase 3)**: depends on Foundational. Delivers the MVP.
- **US2 (Phase 4)**: depends on Foundational and on US1's plugin (`sound-plugin.ts`) and inspector/lane work — it extends those files, so it comes after US1.
- **US3 (Phase 5)**: depends on Foundational and US1's plugin; the sidecar/store and MCP tasks are independent of US2.
- **Polish (Phase 6)**: depends on the stories that are being shipped.

### Within Each Story

- The kind and the mix (`SoundAnnotation`, `StockSounds`, `ExportPlan`, `renderAudio`) before the
  view; the plugin before its property; the property before the inspector's control.
- Each unit test beside its rule (constitution III); the browser check and the harness after the
  behaviour exists.

### Parallel Opportunities

- Foundational: `StockSounds.ts`+test (T003/T004) and the sound files (T008) and the infra store
  (T009) touch different files; `SoundAnnotation.ts`+test (T005/T006) is independent of the
  export path (T010–T013).
- US2's property tests (T022) are independent of the inspector's rendering (T025).
- US3's MCP task (T029) and sidecar test (T030) are independent of each other.

---

## Parallel Example: Foundational

```bash
# Different files, no dependency between them:
Task: "Create src/domain/sound/StockSounds.ts (T003) with its test (T004)"
Task: "Create src/domain/annotation/SoundAnnotation.ts (T005) with its test (T006)"
Task: "Add the stock sound files (T008)"
Task: "Create src/infra/stock-sounds.ts and its port (T009)"
```

## Parallel Example: User Story 2

```bash
Task: "Add unit tests for the sound property (T022)"
Task: "Render the 'sound' control in the properties inspector (T025)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (the words) and Phase 2 (the kind, the sounds, the file's mix).
2. Complete Phase 3 (US1): the plugin, the lane editing, the review's trigger, the e2e check.
3. **STOP and VALIDATE**: place a sound and hear it in the review and the file.
4. Demo if ready — the feature is worth shipping here.

### Incremental Delivery

1. Setup + Foundational → a sound annotation exists, the file mixes it.
2. US1 → place and hear it (MVP).
3. US2 → choose and change the sound, copy, delete, undo.
4. US3 → sound-only clips, the agent, an unknown sound left out.
5. Each step is its own pull request (see the PR map) and leaves the app working.

---

## Notes

- [P] tasks = different files, no dependency on an incomplete task.
- [Story] label maps a task to its user story for traceability.
- The kind reuses the shared canvas, the lane, the preferences, the store, the sidecar and the
  automation surface; a task that writes editing behaviour for the sound kind is a mistake.
- A sound annotation draws nothing and is never picked from the picture; editing is the lane's
  and the preferences'.
- The words come first (constitution V): T001 lands before any code.
- Commit after each task or logical group; stop at a checkpoint to validate a story independently.
