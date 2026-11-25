# Tasks: Magnifier Annotation

**Input**: Design documents from `specs/015-magnifier-annotation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Required by the project constitution. Principle III asks for a unit test beside every
rule in `src/domain/`; Principle IV asks for a committed browser check for what is drawn or
encoded. The test tasks below are therefore part of the work, and the existing kind and cut tests
are the regression proof.

**Organization**: Tasks are grouped by user story so each story is an independently testable
increment: the core lens (US1), correcting it after it is placed (US2), and the family fit plus
the agent's path (US3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task includes the exact file path(s) it changes

## Path Conventions

Single-project browser app: `src/` in four layers, `web/` the shell, `mcp/` the agent server,
`e2e/` the browser suite, `docs/` the map. No new dependency and no `package.json` change.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The words come first (constitution V), and the project has no new dependency or
configuration to initialise.

- [ ] T001 Add **magnifier**, **lens**, **magnified region**, **zoom level**, **rim** and
  **spotlight dim** to `docs/GLOSSARY.md` — the "Annotating" table and its prose — before any
  code uses them.
- [ ] T002 [P] Add the magnifier to `docs/FEATURES.md`, the module map in `docs/FILES.md`, the
  quick reference in `src/ui/shell/help-steps.html` and the complete guide in `web/help.html`,
  using the words added in T001.
- [ ] T003 [P] Record the baseline: run `npx vitest run`, `npm run typecheck` and `npm run lint`
  against `src/` and `e2e/`, and confirm `package.json` and `package-lock.json` need no change.

**Checkpoint**: The words exist and the baseline is green. No code has changed yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The kind, the handle seam and the picture pass that every user story needs.

**⚠️ CRITICAL**: No user story work can begin until T004–T013 are complete.

- [ ] T004 Add `PictureSize` and the optional picture to a kind's handles and resize in
  `src/domain/annotation/Annotation.ts`: `handles(picture?: PictureSize)` and
  `HandleOptions.picture`, documenting that a kind whose rim depends on the picture's shape asks
  for it (data-model.md `Annotation.PictureSize`, `Annotation.handles`,
  `Annotation.HandleOptions.picture`). Existing kinds keep their signatures and tests.
- [ ] T005 [P] Add `src/domain/annotation/Magnifier.ts`: the constants and the class —
  `DEFAULT_ZOOM`/`MIN_ZOOM`/`MAX_ZOOM`/`ZOOM_STEP`, `MIN_RADIUS`/`MAX_RADIUS`,
  `create`/`restore`/`isUsable`, `handles(picture)`, `withHandle` (centre fixed, radius from the
  picture), `movedBy`, `withZoom`, `withColour`, `withSpan`, `duplicated`, `hitTest`, `stored`
  (data-model.md `Magnifier.geometry`, `Magnifier.radius`, `Magnifier.zoom`, `Magnifier.colour`,
  `Magnifier.create`, `Magnifier.handles`, `Magnifier.withHandle`, `Magnifier.movedBy`,
  `Magnifier.withZoom`, `Magnifier.hitTest`, `Magnifier.stored`). No DOM, no canvas.
- [ ] T006 Add `src/domain/annotation/Magnifier.test.ts`: the centre and radius clamped inside
  the picture, a radius below `MIN_RADIUS` and a zoom outside 1.5–8 refused, the grips placed by
  the shorter side on a non-square picture, a resize around the same centre, move/hit/duplicate,
  and the `stored()`/`restore()` round-trip (data-model.md `Magnifier.isUsable`, validation
  rules).
- [ ] T007 [P] Register the kind in `src/domain/annotation/kinds.ts` and extend
  `src/domain/annotation/kinds.test.ts`: a magnifier is rebuilt from its stored numbers, and a
  geometry this build cannot use is left out while the rest opens (data-model.md `kinds`).
- [ ] T008 [P] Add the picture pass to `src/ui/annotating/annotation-layer.ts`:
  `AnnotationRenderer.readsPicture`, the fifth `draw(ctx, annotation, w, h, picture?)` argument,
  `needsPicture`, `pictureFor`/`copyPicture` (one copy of the frame before any annotation),
  `drawOrder` (picture-reading first, then the family's stable order) and
  `drawAnnotations(..., picture?)` (data-model.md `AnnotationRenderer.readsPicture`,
  `AnnotationRenderer.draw`, `needsPicture`, `pictureFor`, `drawOrder`, `drawAnnotations`).
  The drawing function touches no DOM.
- [ ] T009 Extend `src/ui/annotating/annotation-layer.test.ts`: `needsPicture` is true only with
  a reader, `drawOrder` puts readers first and keeps the rest stable, `drawAnnotations` hands the
  passed picture to the reader, and no drawing function reaches for the DOM.
- [ ] T010 [P] Wire the copy into `src/ui/clip/playback.ts` and
  `src/ui/exporting/frame-renderer.ts`: call `pictureFor` before `drawAnnotations` and pass the
  picture, so the review and the file draw the same lens.
- [ ] T011 [P] Wire `src/ui/annotating/annotation-canvas.ts`: hit-test and grip in the layer's
  `drawOrder` (reversed), pass `{ free, picture: { w, h } }` to `withHandle`, take one picture
  with the draft, draw the draft last with it, and pass the picture to the grips through
  `handles({ w, h })`.
- [ ] T012 [P] Wire `src/ui/annotating/properties-inspector.ts`: pass the picture to
  `annotation.handles({ w, h })` in `place()`, so a lens's settings panel sits beside its rim.
- [ ] T013 Run `npx vitest run` and `npm run typecheck` against `src/` and `e2e/` as the
  foundation checkpoint: every existing kind, cut and canvas test passes **unmodified**; nothing
  user-visible has changed.

**Checkpoint**: The kind's rules, the handle seam and the picture pass are proved in node. The
plugin can now be written.

---

## Phase 3: User Story 1 — A magnifier over a detail (Priority: P1) 🎯 MVP

**Goal**: Place a magnifier by dragging a circle over a detail; for its stretch the region is
enlarged inside the lens and the rest of the picture dimmed, in the review and in every drawn
export.

**Independent Test**: With a finished clip in review, select a stretch, add a **Magnifier**, drag
a circle over a detail, play the clip and export it: the detail is enlarged inside the circle and
the rest is dimmed over that stretch and nowhere else, in both the review and the file; reloading
brings it back.

### Implementation for User Story 1

- [ ] T014 [US1] Add `src/ui/annotating/magnifier-plugin.ts`: the **Magnifier** action and icon,
  `readsPicture: true`, the creation drag from the detail's centre outward (a stray or
  shorter-than-`MIN_RADIUS` drag says the smallest size and adds nothing), and the renderer's
  lens (central `R / zoom`, round, wholly inside), rim (the annotation's colour over a dark
  edge) and one-level spotlight dim, under the annotation's dissolve; register it in
  `src/ui/annotating/plugins.ts` (data-model.md `Magnifier` in the view, `Magnifier.geometry`,
  `Magnifier.radius`, `MIN_RADIUS`, `DEFAULT_ZOOM`, `DIM_ALPHA`; contracts/magnifier-annotation.md,
  "The kind" and "The picture").
- [ ] T015 [P] [US1] Add a band's mean luma helper to `e2e/helpers/exports.ts` (decode a frame at
  a moment, as `frameCounts` does, and return the mean luma of a band) for the spotlight check.

### Tests for User Story 1

- [ ] T016 [US1] Update `e2e/checks/annotations.spec.ts`: the annotate-row count becomes **five**
  in the existing assertions, and a new test presses the **Magnifier** row, drags from the centre
  of a detail outward, and asserts the lane mark, the preview's larger white frame number inside
  the lens, the darker band outside it, an exported file with and without the lens showing the
  same, and the same circle, radius and zoom after a reload. Uses T015's helper and
  `frameCounts`/`exportFile`.
- [ ] T017 [P] [US1] Add `src/ui/annotating/magnifier-plugin.test.ts`: the action's label and
  `readsPicture`, and `begin`'s creation through a fake `CreationContext` — a drag commits a
  `Magnifier` in the clip's colour, a too-small drag abandons it and says the smallest size, and
  the module loads in node without the DOM.

**Checkpoint**: US1 is fully functional and independently testable. The zoom is fixed at 2× and
the preferences offer the shared duration; correcting the lens is US2.

---

## Phase 4: User Story 2 — Make the magnifier say the right thing (Priority: P2)

**Goal**: After it is placed, the person moves it, resizes it, changes its zoom and rim colour,
changes its duration, copies it, deletes it and takes any change back with the one undo.

**Independent Test**: Add a magnifier, pick it, move and resize it, open the preferences and change
the zoom, colour and duration, copy it, delete it and undo; every change is in the review and the
export at once, and a reload brings every value back.

### Implementation for User Story 2

- [ ] T018 [US2] Add the generic **number** control to
  `src/ui/annotating/annotation-plugin.ts` (`PropertyControl 'number'`; optional `min`, `max`,
  `step` and `suffix` on `AnnotationProperty`) and render it in
  `src/ui/annotating/properties-inspector.ts` as the duration's stepper shape, with the suffix
  shown (e.g. `2×`) and an out-of-range value refused and reported
  (data-model.md `PropertyControl`, `AnnotationProperty.min`, `.max`, `.step`, `.suffix`).
- [ ] T019 [US2] Add the magnifier's **Colour** and **Zoom** properties in
  `src/ui/annotating/magnifier-plugin.ts` — the colour through the existing colour control and
  the zoom through the new number control with `MIN_ZOOM`/`MAX_ZOOM`/`ZOOM_STEP` and a `×`
  suffix, reading and writing `Magnifier.colour`/`Magnifier.zoom`; the renderer draws the rim in
  the annotation's own colour (data-model.md `Magnifier.colour`, `Magnifier.zoom`;
  contracts/magnifier-annotation.md, "The preferences").

### Tests for User Story 2

- [ ] T020 [US2] Extend the magnifier test in `e2e/checks/annotations.spec.ts`: pick the lens,
  open the settings control, step **Zoom** from 2× and see the preview change, choose another
  **Colour**, change the **Duration**, move the body, resize from a rim grip, copy and paste,
  delete and undo; assert the model and the picture at each step, and that the panel shows
  **Colour**, **Zoom** and **Duration** in that order.
- [ ] T021 [P] [US2] Add the property tests: in `src/ui/annotating/magnifier-plugin.test.ts` the
  magnifier's property list is **Colour** then **Zoom** with the number control's range and
  suffix, and `propertiesFor` adds **Duration**; in
  `src/ui/annotating/annotation-plugin.test.ts` the number descriptor's `value`/`with` refuses an
  out-of-range value (data-model.md `AnnotationProperty`, `Magnifier.withZoom`).

**Checkpoint**: US1 and US2 both work independently; the shared canvas supplies the gestures and
the lens's own preferences now correct it.

---

## Phase 5: User Story 3 — A kind among the kinds, and the agent's path (Priority: P3)

**Goal**: The magnifier is an ordinary family member — cut, kept, reloaded, offered only where a
picture is, round at any shape, dropped when a build does not know it — and an agent can place,
read, change, remove and undo one through the automation surface.

**Independent Test**: Confirm every arrow, image, text, sound and cut behaves exactly as before
with the magnifier present; cut through a magnifier's stretch; open a sound-only clip and see
**Magnifier** absent; place one on a non-16:9 clip and see the lens still draw; place, read and
change one through the automation surface; and an unknown magnifier shape is dropped when a clip
opens.

### Implementation for User Story 3

- [ ] T022 [P] [US3] Add `makeMagnifier` to `src/ui/agent/make.ts`: a magnifier from `x`, `y`
  (the centre), `radius` (shorter-side fraction, default 0.2) and `zoom` (default
  `DEFAULT_ZOOM`), refused with the kind's reason for a tiny lens or an out-of-range zoom
  (data-model.md `Magnifier.geometry`, `Magnifier.radius`, `Magnifier.zoom`;
  contracts/magnifier-annotation.md, "The automation surface").
- [ ] T023 [P] [US3] Add `geometry: unknown` to `AnnotationSummary` in
  `src/ui/agent/surface.ts` and report `annotation.stored().geometry` in
  `src/ui/agent/describe.ts`, so a magnifier's centre, radius, zoom and colour are readable with
  its kind and span; extend `src/ui/agent/surface.test.ts` to assert it
  (data-model.md `AnnotationSummary.geometry`).
- [ ] T024 [P] [US3] Extend `mcp/src/tools.ts`: `annotate`'s `kind` gains `"magnifier"` with `x`,
  `y`, `radius` and `zoom` documented (centre, shorter-side fraction, 1.5–8), `set_property`'s
  description names `"zoom"`, and `describe_clip`'s says each annotation carries its geometry;
  update `mcp/src/tools.test.ts`'s enum.

### Tests for User Story 3

- [ ] T025 [US3] Add the agent's magnifier check to `e2e/checks/agent.spec.ts`: place one through
  `edit.annotate('magnifier', …)`, read its geometry and zoom from `describe()`, change the zoom
  with `edit.setProperty`, remove it and undo it back.
- [ ] T026 [P] [US3] Extend `e2e/checks/annotations.spec.ts` with the family proof: a cut through
  the lens's stretch leaves the frame without lens or dim (and the cut's undo brings them back);
  a sound-only clip's annotate options do not offer **Magnifier**; and a magnifier on a non-16:9
  take still draws the lens, with its grips on the rim. The unit proof for an unusable shape is
  T007.

**Checkpoint**: All three stories work; the family's existing kinds and cuts are unchanged and
the agent has the magnifier.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final docs, the full suite and the pull-request evidence.

- [ ] T027 [P] Correct the final docs where the built kind differs from the draft:
  `docs/GLOSSARY.md`, `docs/FEATURES.md`, `docs/FILES.md`, `src/ui/shell/help-steps.html`,
  `web/help.html`, and the quickstart's zoom range and dim if they moved.
- [ ] T028 Run the full verification: `npm run lint && npm run typecheck && npx vitest run &&
  npm run build`, then `npm run test:e2e` (including the two magnifier checks in
  `e2e/checks/annotations.spec.ts` and `e2e/checks/agent.spec.ts`); confirm the existing export,
  publishing, profile, capture and watermark checks still pass.
- [ ] T029 Release hygiene and the stated gaps: confirm `package.json` and `package-lock.json`
  are untouched and no dependency was added; in the pull request record the three levels (unit
  rules, the browser checks, and a real session with a 1080p clip for smoothness), the lens/dim
  look being a personal judgement, the frame rate not being a headless number, and the untouched
  share picker.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 first (the words come first); T002 and T003 can run together after
  T001.
- **Foundational (Phase 2)**: Depends on Setup. T004 first; then T005 and T008 in parallel; T006
  and T007 after T005 (different files, parallel); T009 after T008; T010, T011 and T012 in
  parallel after T008; T013 after all. **T013 blocks every user story.**
- **US1 (Phase 3)**: After T013. T014 and T015 in parallel; T016 and T017 after T014 (different
  files, parallel).
- **US2 (Phase 4)**: After US1's T014 (the plugin file it edits). T018 first (the number
  control); T019 after T018 and T014; T020 and T021 after T019 (different files, parallel).
- **US3 (Phase 5)**: After US1 (the kind must be registered for `edit.annotate`). T022, T023 and
  T024 in parallel (different files); T025 after them; T026 after T016's check file and T014.
- **Polish (Phase 6)**: After all code tasks. T027 and T028 can run together; T029 after the
  full run.

### User Story Dependencies

- **US1 (P1)**: No dependency on US2/US3. It is the MVP.
- **US2 (P2)**: Needs US1's plugin file to add its properties; its shared gestures come from the
  family and T005/T011. Independently testable once US1 is in.
- **US3 (P3)**: Needs the domain (T005) and the registered kind (T014) for the agent's
  `annotate`; independent of US2's preferences.

### Within Each User Story

- The rules and the seams (T004–T013) precede any view or agent work.
- The implementation precedes its test task where the test imports the new code; the browser
  check follows the plugin.
- Each checkpoint leaves the app working and its tests green.

### Parallel Opportunities

- **Setup**: T002 and T003.
- **Foundation**: T005 ∥ T008; T006 ∥ T007; T010 ∥ T011 ∥ T012.
- **US1**: T014 ∥ T015; T016 ∥ T017.
- **US2**: T020 ∥ T021.
- **US3**: T022 ∥ T023 ∥ T024; T025 ∥ T026.
- **Polish**: T027 ∥ T028.

---

## Parallel Example: User Story 1

```bash
# The plugin and the test helper are different files:
Task: "Add the magnifier plugin in src/ui/annotating/magnifier-plugin.ts"
Task: "Add a band-luma helper in e2e/helpers/exports.ts"

# Then the browser check and the plugin's node test are different files:
Task: "Add the magnifier check in e2e/checks/annotations.spec.ts"
Task: "Add the plugin/creation test in src/ui/annotating/magnifier-plugin.test.ts"
```

## Parallel Example: User Story 3

```bash
# The maker, the described geometry and the MCP schema are different files:
Task: "Add makeMagnifier in src/ui/agent/make.ts"
Task: "Add the annotation geometry to describe/surface in src/ui/agent/"
Task: "Add the magnifier kind to mcp/src/tools.ts"

# Then the two checks are different files:
Task: "Add the agent's magnifier check in e2e/checks/agent.spec.ts"
Task: "Add the family proof in e2e/checks/annotations.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: the words and the map.
2. Complete Phase 2: the kind, the handle seam and the picture pass (T004–T013).
3. Complete Phase 3: the plugin and the committed check (T014–T017).
4. **STOP and VALIDATE**: run `npm run test:e2e -- e2e/checks/annotations.spec.ts --grep
   "magnifier"` and the node suite; the lens and the dim are in the review and the file.
5. This is a shippable increment: a lens placed at 2× with the shared duration, move, resize,
   copy, delete and undo.

### Incremental Delivery

1. Setup + Foundational → the rules and the picture pass are proved; the app looks unchanged.
2. US1 → the lens works and exports (MVP).
3. US2 → the zoom/colour preferences and the corrected lens; the same check grows to walk them.
4. US3 → the family proof and the agent's path.
5. Polish → the final docs and the full suite.

### Pull Requests

The project's workflow asks for one change per pull request. The plan's sequence maps the work
to branches: `docs/magnifier-words` (T001–T002), `feat/magnifier-kind` (T004–T007),
`feat/magnifier-picture-pass` (T008–T013), `feat/magnifier-plugin` (T014–T017 and, if the team
folds it in, T018–T021), `feat/magnifier-agent` (T022–T025), the family/e2e work (T026), and
`docs/magnifier-final` (T027–T029). US1 and US2 may be one plugin pull request or two; either
leaves the app working. The version is CI's, so `package.json` is never bumped by hand.

---

## Notes

- `[P]` means the tasks touch different files and do not wait on each other; it does not mean the
  stories are independent — US2 and US3 each need US1's registration.
- The domain rules are cited against `data-model.md` (`Magnifier.*`, `Annotation.*`,
  `AnnotationRenderer.*`, `AnnotationProperty.*`, `AnnotationSummary.geometry`), which stays the
  single source for the ranges, defaults and field shapes.
- A test that would need the DOM is not in the node suite: the picture copy, the lens's pixels
  and the panel's controls are the browser check's; the rules, the order and the descriptors are
  node-tested with fakes.
- A change that had to alter an existing test is a behaviour change: the only intended edits are
  the annotate-row counts (4 → 5), the MCP enum and the mechanical additions named above. Every
  other existing test must pass unmodified.
- Stop at each checkpoint and run the suite; a green build is not the proof (the Verification
  skill) — the unit rule and the browser check are.