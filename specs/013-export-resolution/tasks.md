# Tasks: Export Resolution

**Input**: Design documents from `specs/013-export-resolution/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/export-resolution.md, quickstart.md

**Tests**: Included. The constitution (III, IV) requires a unit test for every rule in
`src/domain/` and a browser check for anything encoded — the resolution the **file's own video
track** comes out at is proved in `e2e/`.

**Organization**: Tasks are grouped by user story so each can be implemented and tested on its
own. The rule and the clip property are shared by all three stories, so they are foundational;
each story then names only the files it touches.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: the user story the task belongs to (US1, US2, US3)

## Path Conventions

Single project: application code under `src/`, the shell under `web/`, end-to-end checks under
`e2e/`, documents under `docs/`.

---

## Phase 1: Setup

**Purpose**: the words come first (constitution V).

- [x] T001 Write the words into `docs/GLOSSARY.md` before any code: a new **export resolution** row (the size the clip's file and publish are finally written at — a clip property, optional, defaulting to the **clip size**, which a **profile** may fix), and correct the existing **clip size** row, which still says the person sets it (`008-clip-size` removed that); add **export resolution** to the **clip property** row's list.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the shared rule (`ExportResolution`) and the one clip property every story leans on.
Both are needed before any story: US1 sets it, US2 fixes it, US3 shows and keeps it.

**⚠️ CRITICAL**: no user story work begins until this phase is complete.

- [x] T002 [P] Create `ExportResolution` in `src/domain/clip/ExportResolution.ts`: `EXPORT_RESOLUTION_ID = 'exportResolution'`, `LEVELS` (`[2160, 1440, 1080, 720, 480]`), `of(value)` (`''` → the clip-size instance; a level → that level; anything else → `null`), `isExportResolution(value)`, the `value` field (`''` or a level as a string), `picture(clipSize)` (scale so the clip's **shorter edge** is the level, both edges through `ClipSize.of` so they are even and past `MAX_EDGE` is `null`, **aspect kept**), `label()` (`'Clip size'` | `'1080p'`), and the free function `exportPicture(properties, clipSize)` reading `EXPORT_RESOLUTION_ID` and answering the clip size for an unknown value and `null` for no size (data-model.md `ExportResolution.value`, `ExportResolution.LEVELS`, `ExportResolution.picture`; research.md R2, R3).
- [x] T003 [P] Write `src/domain/clip/ExportResolution.test.ts`: `of('')` answers the clip size and `picture` leaves the clip size unchanged; `of('1080')` on 3840×2160 is 1920×1080 (16:9 kept), on 1080×1920 is 1080×1920 (portrait kept), on 1440×1080 is 1440×1080 (4:3 kept); both edges come out even; a level above the clip size enlarges it; `of('999')` and `isExportResolution('999')` are `null`/`false`; `picture` past `ClipSize.MAX_EDGE` is `null`; `exportPicture` reads the property, answers the clip size for an unknown stored value, and `null` for no size (data-model.md `ExportResolution.value`, `ExportResolution.picture`).
- [x] T004 [P] Register the `exportResolution` clip property in `src/ui/clip/clip-properties.ts`, after the read-only `size` row: `id: EXPORT_RESOLUTION_ID`, `label: 'Export resolution'`, `control: 'choice'`, `seedable: true`, `choices` = **Clip size** (`''`) first then `2160p … 480p` (`'2160' … '480'`), `value` = the stored string, `with` returning `null` unless `isExportResolution(value)`, and `blocked` returning the sound-only reason for a clip with takes and no picture (data-model.md §4; contracts/export-resolution.md §2).
- [x] T005 [P] Extend `src/ui/clip/clip-properties.test.ts` and `src/ui/agent/surface.test.ts` for the new property: the choices in order (`''`, `2160`, `1440`, `1080`, `720`, `480`), `with(properties, '999')` is `null`, `with(properties, '')` returns it to the clip size, `seedableClipProperties()` includes it, and `describeClip` lists it with its `choices` and its `readOnly` (data-model.md §4).

**Checkpoint**: the rule and the clip property are in place and proved in node; every story can start.

---

## Phase 3: User Story 1 — Write the file at a size of my choosing (Priority: P1) 🎯 MVP

**Goal**: the person sets an **export resolution** in the clip's settings, and every file the clip writes — the WebM download, the MP4 download, the file for editing and a publish — is written at it; with none set the file is the clip size, exactly as today; the review does not move.

**Independent Test**: seed a clip whose take is larger than 1080p, set **Export resolution** to 1080p in `#props-btn`, export, and read back the file's own video track: it is **1920×1080**; with nothing set it is the clip size; 720p writes a smaller file than 1080p.

### Implementation for User Story 1

- [x] T006 [P] [US1] Change `picture` in `src/ui/exporting/export-flow.ts` to `exportPicture(session.clip.properties, session.clip.size()) ?? { width: el.cv.width, height: el.cv.height }`, so the export's canvas and its byte budget are the export resolution (data-model.md §5; contracts/export-resolution.md §3).
- [x] T007 [P] [US1] Change `picture` in `src/ui/publishing/publish-flow.ts` to the export picture, so the encoded MP4's size **and** the post's `AspectRatio` are both it (data-model.md §5; spec FR-021).
- [x] T008 [P] [US1] Change `picture` in `src/ui/publishing/youtube-flow.ts` to the export picture (data-model.md §5).
- [x] T009 [US1] Make the timeline's **estimated export size** follow the export picture in `src/ui/clip/timeline-ui.ts` (and `src/ui/recording/live-timeline.ts`): pass `exportPicture(...)`'s width and height where `el.cv.width/height` are passed today, so the number the person watches matches the file (spec FR-008, SC-002; contracts/export-resolution.md §3). Leave the review canvas itself at the clip size.
- [x] T010 [US1] Write `e2e/checks/export-resolution.spec.ts` (User Story 1 half): with nothing set, `probeFile` reports the clip size; set **Export resolution** to **1080p** and the file's video track is 1920×1080; 720p is 1280×720 and a **smaller byte size** than 1080p; the review canvas (`#cv`) is unchanged; the timeline's estimate text follows the resolution (spec SC-001, SC-002, SC-003, SC-005).

**Checkpoint**: User Story 1 is functional on its own — a file written at the chosen resolution, with no profile involved.

---

## Phase 4: User Story 2 — A production writes every video at one resolution (Priority: P2)

**Goal**: a **profile** fixes the export resolution, so every clip made under it is written at that size with nothing to press, and it is not the person's to change while the profile is active.

**Independent Test**: store a profile that fixes **Export resolution** to 1080p (the store record, no sheet needed), load the app, seed a 4K take, export: the file is 1920×1080 and the clip's settings show 1080p with `set by …` and no control; an agent's `setClipProperty` is refused, naming the profile.

### Implementation for User Story 2

- [x] T011 [P] [US2] Prove the existing machinery carries it in `src/ui/profile/apply.test.ts` and `src/ui/profile/profile-menu.test.ts`: a profile declaring `exportResolution` fixes it onto an **empty** clip, a value the app does not offer fixes nothing at all, an undeclared item is left alone, and the profile's sheet lists it as a **choice** row with **Not fixed** above the levels (data-model.md §4; contracts/export-resolution.md §4).
- [x] T012 [P] [US2] Extend `src/ui/agent/surface.test.ts` and `src/ui/agent/edit.test.ts`: with a `Controlling` that names a profile for `exportResolution`, `describeClip` reports it `readOnly: true`, and `setClipProperty` answers `ok: false` with the profile named (contracts/export-resolution.md §4; spec SC-007).
- [x] T013 [US2] Add the User Story 2 half to `e2e/checks/export-resolution.spec.ts`: with a profiles record fixing 1080p active, the clip's settings show **1080p** with `set by …` and no control, the exported file's track is 1920×1080 for a 4K take, and removing the profile leaves the value the person's (spec SC-006, SC-007).

**Checkpoint**: User Stories 1 and 2 both work independently — a person sets it, and a production fixes it.

---

## Phase 5: User Story 3 — The size the file will be, told plainly (Priority: P3)

**Goal**: the export resolution is shown beside the clip size, comes back after a reload with the clip, and the one undo takes back the person's own choice.

**Independent Test**: set an export resolution, reload, and confirm the row still reads it and the next export is at it; undo the choice and the row returns to the clip size.

### Implementation for User Story 3

- [x] T014 [P] [US3] Extend `src/domain/clip/Clip.test.ts` (or `ClipProperties.test.ts`): the export resolution travels in `ClipSnapshot.properties` and comes back through `restore`; setting it through `Clip.setProperty` is **announced** and is what the one **undo** takes back — while a value a profile applied through `Clip.applyProperty` is not (spec FR-019, SC-008; data-model.md §2, §6).
- [x] T015 [US3] Add the User Story 3 half to `e2e/checks/export-resolution.spec.ts`: the row reads its value with the **Clip size** row beneath it read-only; after a reload the export resolution is still set and the next export is at it; undo returns the row to **Clip size** (spec SC-008).

**Checkpoint**: all three stories are functional and independent.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: the documents and the whole-suite pass the change must leave behind.

- [x] T016 [P] Add one line to `docs/FEATURES.md` (the export resolution: what it is and that a profile may fix it) and update the help panel's words in `web/index.html` for the clip's settings.
- [x] T017 Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run test:e2e` and fix what they surface; walk `specs/013-export-resolution/quickstart.md` and confirm each expected outcome, reporting anything not verified (the recorder's own flow stays the user's to run).
- [x] T018 [P] Against the file list in `specs/013-export-resolution/plan.md`, confirm no file outside it changed, and — per `specs/013-export-resolution/contracts/export-resolution.md` §5 — that the export resolution is **not** written into an exported file, a sidecar or a publish as data (only its effect on the file's picture), and that the **clip size** and the review are untouched (spec FR-004, FR-005, SC-009).

---

## Phase 7: Rework — the bitrate floor had to give way (from the user's own export)

**Purpose**: the user's own export showed the control controlling nothing — 1641×1410 → 4.7 MB,
560×480 → 4.8 MB — because `videoBitrate` clamped the rate **up** to a flat 4 Mbps, above the app's
own rule for every picture under about 1.1 megapixels. The floor became a share (research.md R9).

- [x] T019 [US1] Make the bitrate follow the picture in `src/infra/export-target.ts`: the flat `BITRATE_FLOOR` becomes `MIN_SHARE` (a quarter of what the picture asks) with a small `MIN_BITRATE` sanity bound under it, the 24 Mbps ceiling unchanged; update `src/infra/export-target.test.ts` (the behaviour changed, deliberately) and `src/ui/clip/size-estimate.test.ts`, and strengthen `e2e/checks/export-resolution.spec.ts` to compare **two levels that were both floored** (720p against 480p), which is the regression it missed (research.md R9; spec FR-008, SC-002; contracts/export-resolution.md §3).

---

## Phase 8: Rework — the size belongs under the Export button (from the user's own reading)

**Purpose**: the estimate was read as a bare "0.7–2.7 MB (WebM)" in the timeline header and the
user asked for it to be **one figure, `1.7MB`, under the Export button** — where the button's own
word says what the number means. This supersedes T009's live half: the Export button is not on
screen while a take records, so the recording readout goes with the move.

- [x] T020 [US1] Move the export size under the Export button: `web/index.html` wraps `#btn-exp` and `#t-size` in `#exp-stack` (the `.tl-est` span and its CSS removed), `web/styles.css` styles `.exp-stack`/`.exp-size`, `src/ui/dom.ts` gains `expStack` and `review-flow.ts`/`view-lifetime.ts` show and hide it instead of the button alone; `size-estimate.ts` returns a bare `1.7MB`; the live write in `src/ui/recording/live-timeline.ts` is removed (it would write to a hidden node), and the e2e helpers follow the new text (contracts/export-resolution.md §3).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: after Setup. **Blocks every story** (the rule and the property are shared).
- **User Stories (Phase 3+)**: after Foundational; each can then proceed on its own.
- **Polish (Phase 6)**: after the stories wanted are done.

### User Story Dependencies

- **US1 (P1)**: after Foundational. No dependence on US2 or US3 — it sets the property and reads the file.
- **US2 (P2)**: after Foundational. Its code is the `seedable` flag already set in T004 plus the existing `applyActiveProfile`, so it is the tests and the browser half; it can run in parallel with US1.
- **US3 (P3)**: after Foundational. It proves the panel, the store and the undo; its browser half shares the `e2e/checks/export-resolution.spec.ts` file with US1 and US2, so it follows them.

### Within Each Story

- A rule and its test ship together (constitution III).
- The property (T004) before the write paths that read it (T006–T009).
- The browser check last in each story, once the pieces it drives exist (T010, T013, T015, all in one file, so in that order).

### Parallel Opportunities

- Foundational: T002–T005 are four independent files — all `[P]`.
- US1: T006, T007 and T008 are three different files — all `[P]`; T009 follows T006 (same picture helper) and T010 last.
- US2: T011 and T012 are `[P]` (different test files); T013 last.
- US3: T014 `[P]`; T015 last.
- Polish: T016 and T018 are `[P]`.

## Parallel Example: Foundational (Phase 2)

```text
Task: "Create ExportResolution in src/domain/clip/ExportResolution.ts"        (T002)
Task: "Write src/domain/clip/ExportResolution.test.ts"                        (T003)
Task: "Register the exportResolution clip property in src/ui/clip/clip-properties.ts" (T004)
Task: "Extend src/ui/clip/clip-properties.test.ts and src/ui/agent/describe.test.ts"  (T005)
```

## Parallel Example: User Story 1 (Phase 3)

```text
Task: "Change picture in src/ui/exporting/export-flow.ts"     (T006)
Task: "Change picture in src/ui/publishing/publish-flow.ts"   (T007)
Task: "Change picture in src/ui/publishing/youtube-flow.ts"   (T008)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (the words) and Phase 2 (the rule and the property).
2. Phase 3 — the three write paths, the size estimate, and the browser check.
3. **STOP and VALIDATE**: a clip written at a chosen resolution, with a smaller file, with no
   profile involved. This is the whole point of the feature.

### Incremental Delivery

1. Setup + Foundational → the rule and the property are proved in node.
2. US1 → the file is written at the chosen resolution (MVP).
3. US2 → a production fixes it, with nothing to press.
4. US3 → it is shown, kept and undone like the clip's other properties.
5. Polish → the documents and the whole suite.

### Notes

- `[P]` marks a different file with no incomplete dependency.
- Every rule task ships its test in the same change (constitution III); the browser check covers
  what is encoded (constitution IV).
- This feature is small on purpose: it reuses the clip-property register (the panel, a profile's
  sheet and the automation surface all read it) and the profiles' `seedable`/lock machinery, so US2
  and US3 are mostly proof rather than new code — and the encoder needs no change at all, because
  its canvas already is the picture it is handed.
- Commit after each task or logical group; one change per pull request (constitution VI).
- Stop at any checkpoint to validate a story on its own.
