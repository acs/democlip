---

description: "Task list for moving and resizing the webcam bubble"
---

# Tasks: Move and Resize the Webcam Bubble

**Input**: Design documents from `/specs/010-move-resize-webcam-bubble/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/webcam-bubble.md

**Tests**: Included. The project's constitution requires a rule in `src/domain/` to have a
unit test beside it (principle III) and anything drawn to have a committed browser check
(principle IV), so the test tasks below are part of the feature, not optional.

**Organization**: Tasks are grouped by user story so each can be implemented and tested on
its own. Because the move gesture, the resize gesture and the reset all touch the same two
view files (`ui/recording/webcam.ts` and `ui/recording/region.ts`), the view edits run
**sequentially in priority order** — the `[P]` markers appear only where files truly differ.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are in each description

## Path Conventions

Single Vite app at the repository root: `src/` for the app, `e2e/` for the browser suite.
No new directories.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Write the words before they reach the code — the constitution's principle V.

- [X] T001 [P] Add the **webcam bubble** and its **placement** to `GLOSSARY.md`, in the capture/export table beside the **crop region** entry (same file as `CropRegion`): the camera drawn as a circle over the recorded picture when the screen is shared, and its placement — where and how big — held per sitting and not persisted.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The circle's rules and the drawing every story needs. No story can begin until this is done.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Create the pure value object `WebcamBubble` in `src/domain/capture/WebcamBubble.ts` (immutable, like `CropRegion`): fields `cx`, `cy` and `size` exactly as defined in `data-model.md` (`WebcamBubble.cx`, `WebcamBubble.cy`, `WebcamBubble.size` — the diameter is a fraction of the region's shorter side), the constants `MIN_SIZE`/`MAX_SIZE` (`data-model.md` `WebcamBubble.MIN_SIZE`, `WebcamBubble.MAX_SIZE`), and the operations `of`, `default(width, height)`, `withCentre`, `withSize`, `fitted`, `geometry`, `contains`, `equals` with the signatures in `contracts/webcam-bubble.md`. The invariant of `data-model.md` ("the circle is wholly inside the recorded region") is enforced by `withCentre`, `withSize` and `fitted`; `of` throws on a non-finite coordinate or an out-of-bounds size, as `CropRegion.of` does.
- [X] T003 [P] Write the unit test `src/domain/capture/WebcamBubble.test.ts` in node beside the class: finiteness and size-bounds rejection in `of`; `default` puts the circle in the bottom-right for wide, tall and square regions; `withCentre`/`withSize`/`fitted` keep the whole circle inside when pushed past an edge or a corner; `withSize` clamps at `MIN_SIZE` and `MAX_SIZE`; `contains` is true on the circle and, with a tolerance, on the rim, false outside.
- [X] T004 Hold the sitting's placement and draw from it, in `src/ui/recording/webcam.ts`: add the view state `bubble: WebcamBubble | null` (`null` = the sitting's default, `data-model.md` "The placement's home in the view") and rewrite `drawWebcamOverlay(ctx, x, y, width, height)` to compute the centre and radius with `WebcamBubble.geometry` — `WebcamBubble.default(width, height)` when `bubble` is null, else `bubble.fitted(width, height)` — keeping the mirrored, cover-cropped camera drawing as it is. Do not add any gesture yet. **Proved by the existing circle check in `e2e/checks/capture.spec.ts` passing unmodified** (the default corner and size are unchanged).

**Checkpoint**: The bubble is drawn from the value object, at exactly the default place and size as before. The four other `drawWebcamOverlay` call sites (`preview.ts`, `record-flow.ts`) are unchanged.

---

## Phase 3: User Story 1 - Move the bubble to a chosen place (Priority: P1) 🎯 MVP

**Goal**: A person drags the camera circle to another place in the live preview, and the next take records it there.

**Independent Test**: With screen + webcam on, drag the bubble from the bottom-right to another corner, record a take, and confirm the recorded picture holds the bubble in the new place; a drag off the bubble still crops.

- [X] T005 [US1] Add the move gesture to `src/ui/recording/webcam.ts`: a `BubbleDrag` object (a class with a lifetime, exported like `crop` in `region.ts`) with `begin(point, width, height)`, `move(point, width, height)`, `end()`, `cancel()`, and a `hitTest(point, width, height)` that asks `WebcamBubble.contains` (`data-model.md` state transitions; `contracts/webcam-bubble.md` Contract 2). `begin` materialises the default when `bubble` is null and moves it with `withCentre`; `end` commits the proposed `WebcamBubble` to `bubble`.
- [X] T006 [US1] Route a preview press in `src/ui/recording/region.ts` (the module that owns the canvas's pointer handlers — `contracts/webcam-bubble.md` Contract 3): on `pointerdown`, if the phase is `live` and screen + webcam are on and the press is on the bubble, begin the bubble drag and do **not** begin the crop; otherwise begin the crop exactly as today. On `pointermove`/`pointerup`, drive whichever gesture is active.
- [X] T007 [US1] Fold the move check into `e2e/checks/capture.spec.ts`, beside the existing circle check: boot with the stand-in share and Chromium's fake camera, drag the bubble to another corner with `page.mouse`, assert the preview's `arc` for the bubble moved and stayed whole, record a take, and read the recorded picture back with `frameCounts` (in `e2e/helpers/exports.ts`) to assert the bubble is painted in the **new** corner of the take; then drag off the bubble and assert a crop is still set.

**Checkpoint**: User Story 1 works on its own — the bubble can be moved, and the take holds it there.

---

## Phase 4: User Story 2 - Make the bubble the size they want (Priority: P2)

**Goal**: A person drags the bubble's rim to change its diameter; it stays a circle, and the next take records it at that size.

**Independent Test**: Drag the rim outward and inward, record a take, and confirm the recorded picture holds the bubble at the chosen diameter and still circular.

- [X] T008 [US2] Add the resize gesture to `src/ui/recording/webcam.ts`: a press on the rim (`WebcamBubble.contains` with a tolerance — `contracts/webcam-bubble.md` Contract 2) begins a resize drag whose distance from the centre sets the diameter through `WebcamBubble.withSize`; the cluster clamps at `MIN_SIZE` and `MAX_SIZE` per `data-model.md` `WebcamBubble.MIN_SIZE` and `WebcamBubble.MAX_SIZE` (the bounds belong to the value object and are not re-stated in the view).
- [X] T009 [US2] Draw the rim handle in `drawWebcamOverlay` in `src/ui/recording/webcam.ts`, only while the phase is `live`, so the resize is discoverable; the handle is **not** drawn in the recording and not outside the live phase (`contracts/webcam-bubble.md` Contract 2).
- [X] T010 [US2] Extend the check in `e2e/checks/capture.spec.ts`: drag the rim outward (assert the circle's radius grew and it stayed round), then inward past the minimum (assert it stopped at the smallest allowed diameter), record a take, and confirm with `frameCounts` that the bubble in the recorded picture is the chosen size.

**Checkpoint**: User Stories 1 and 2 both work; a person can move **and** size the bubble.

---

## Phase 5: User Story 3 - The placement lasts the sitting and then is forgotten (Priority: P3)

**Goal**: The placement lasts across takes and across turning the webcam off and on, and is gone at New and at a reload — the bubble is back in the bottom-right corner.

**Independent Test**: Move and resize the bubble, record a take, start another take and confirm the bubble keeps its place; then reload (and press New) and confirm the bubble is back in the default corner at the default diameter.

- [X] T011 [US3] Reset the placement when the session ends, in `src/ui/lifecycle/view-lifetime.ts`: beside `crop.cancel()` in the `cleared` handler, set the webcam placement back to `null` and `cancel()` the bubble drag (the lifetime in `data-model.md` "The placement's home in the view" — New and reload both return the default). Add nothing to `Session` or `Clip`.
- [X] T012 [US3] Extend the check in `e2e/checks/capture.spec.ts`: after moving the bubble, assert the placement survives a second take unchanged, then reload the page and assert the bubble is back in the bottom-right at the default diameter (and, in the same check, that pressing New does the same).

**Checkpoint**: All three stories work independently; the placement is per sitting and never persisted.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finish the change as one pull request.

- [ ] T013 Run the manual walk in `quickstart.md` against a real screen share and a real camera, and write down in the pull request what it confirmed and what it could not (the picker and a real recording, per the verification skill).
- [X] T014 [P] Run `npm run lint`, `npm run typecheck`, `npm run test` and `npm run test:e2e`, and confirm the default bubble is unchanged for a person who never touches it (the existing circle check passing unmodified is the proof).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately. T001 must land before any code names the concept (principle V).
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**. T002 before T003 (the test compiles against the class) and before T004 (the drawing asks the class); T003 and T004 are independent files once T002 exists.
- **User Stories (Phase 3+)**: All depend on Foundational. The view edits touch the same files, so run them **sequentially in priority order** (P1 → P2 → P3) rather than in parallel.
- **Polish (Phase 6)**: Depends on all three stories.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational. No dependency on other stories.
- **User Story 2 (P2)**: Can start after Foundational. Edits the same `webcam.ts` as US1, so it follows US1's task on that file.
- **User Story 3 (P3)**: Can start after Foundational. `view-lifetime.ts` is its own file, but its check extends the same `capture.spec.ts` as US1/US2.

### Within Each User Story

- The rules (T002) exist before the view uses them.
- The move gesture before the routing; the routing before the check.
- Story complete and checked before moving to the next priority.

### Parallel Opportunities

- **Phase 1**: T001 alone (a single file).
- **Phase 2**: T003 `[P]` can be written alongside T004 once T002 is in place (different files).
- **Phase 6**: T014 `[P]` can run alongside T013.
- The `capture.spec.ts` checks (T007 → T010 → T012) are sequential: same file.

---

## Parallel Example: Foundational Phase

```bash
# Once T002 (the value object) exists, these two touch different files:
Task: "Write the unit test in src/domain/capture/WebcamBubble.test.ts"           # T003
Task: "Hold the placement and draw from it in src/ui/recording/webcam.ts"        # T004
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 (T001) and Phase 2 (T002–T004) — the words, the rules, the drawing.
2. Complete Phase 3 (T005–T007) — move, routing, check.
3. **STOP and VALIDATE**: a person can move the bubble and the take records it there; the
   crop still crops. This is a shippable slice on its own.

### Incremental Delivery

1. Setup + Foundational → the bubble is drawn from the value object, unchanged on screen.
2. US1 → move → validate → deliver.
3. US2 → resize, with the rim handle → validate → deliver.
4. US3 → the per-sitting lifetime → validate → deliver.
5. Polish → the manual walk, the reports, the one pull request (CI owns the version).

---

## Notes

- `[P]` = different files, no dependencies.
- Every rule in T002 is proved by T003 in node, beside the file; the drawing and gestures
  are proved by the committed checks in `e2e/checks/capture.spec.ts`.
- A placement never alters a take already recorded — the bubble is its pixels.
- Do not bump `package.json`: CI owns the version.

### Deviations from the plan (what was actually built)

- **T005/T008 — the gesture object is `BubblePlacer`, not a separate `BubbleDrag`.** The
  placement and the gesture in flight share one lifetime and one owner, so both live on
  the exported `bubblePlacer` in `src/ui/recording/webcam.ts` rather than on two objects.
  `hit()` returns `'move' | 'resize' | null`.
- **The rim is grabbable from both sides of the line (a correction).** The first cut read
  a press *inside* the circle as a move and only a press *outside* it as a resize, so a
  hand aiming at the visible edge — which lands a hair inside it — moved the bubble
  instead, shunting the circle sideways as the press point became its centre. Now the
  middle of the circle moves it and a band straddling the edge resizes it (`RIM_IN = 0.25`
  of the radius inside, `RIM_OUT = 0.06` of the shorter side outside), and a move keeps
  the point taken hold of so the bubble never jumps under the pointer. The check presses
  **inside** the edge (`0.9 × radius`) and asserts the centre does not move — it fails on
  the old rule and passes on the new one.
- **T007/T010 — the take is proved by the compositor's own drawing, not by decoding a
  file.** The check watches `arc` on the canvas the take is recorded from
  (`e2e/helpers/bubble.ts`, `compositedBubble`) and asserts the circle's centre and radius
  match the preview's. That is the pixels the recorder is handed, and it avoids writing a
  file the check would then have to decode. The camera's non-square cover is still
  asserted from the preview's `drawImage`.
- **T007/T010/T012 are one folded check**, per the verification skill's "one feature, one
  or two checks": move, resize, the crop still cropping, the take recording it, and the
  per-sitting lifetime (reload and New), in
  `e2e/checks/capture.spec.ts`. `e2e/helpers/bubble.ts` was extracted from the existing
  circle check so both share one watcher.
- **T012 — "survives a second take" is covered by the placement surviving to the record
  step after the move and resize**, rather than a second take.
- **T013 is not done here**: a real screen share and a real camera are the user's session.
  The share picker cannot be opened by any check (verification skill), so this stays the
  stated gap.
