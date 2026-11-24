# Implementation Plan: Move and Resize the Webcam Bubble

**Branch**: `resize-webcam-bubble` | **Date**: 2026-11-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-move-resize-webcam-bubble/spec.md`

## Summary

Give the person the only chance the app has to place the webcam bubble: the **live
preview**. When the screen is shared and the webcam is on, the camera is a circle over the
recorded region; the person drags it to move it, and drags its rim to change its diameter.
The placement is held in **fractions of the recorded region** and is drawn by the same
function the recorder already uses, so a take holds the bubble exactly where and at the
size the preview showed — including on a take recorded after the change. The bubble stays
wholly inside the recorded region, stays a circle, and is set only in the live phase. It
belongs to the **sitting**: it lasts across takes and is forgotten at New and at a reload.
Nothing about the clip, the compositor's pipeline or persistence changes: the bubble is
drawn into the take's pixels at record time, and placing it after recording is explicitly
out of scope.

The circle's rules become a new pure value object, `WebcamBubble` in `src/domain/capture/`,
with a unit test beside it. The view (`ui/recording/webcam.ts`) holds the sitting's
placement and the drag, draws the bubble and its rim handle, and hands the preview's
pointer routing (`ui/recording/region.ts`) the bubble-first decision so a press on the
circle moves it while a press anywhere else still crops.

## Technical Context

**Language/Version**: TypeScript 6 (ES modules), Vite 8, Vitest 5, Playwright (existing)

**Primary Dependencies**: none new — the Canvas 2D API and pointer events, both already in use

**Storage**: none — the placement is in memory for the sitting; no `localStorage`, no
IndexedDB, no clip snapshot field

**Testing**: Vitest (node) for `WebcamBubble`; one committed check folded into
`e2e/checks/capture.spec.ts` (a real browser, the stand-in share and the fake camera) for
the drawing and the gesture; a real session for the actual share, which no check can open

**Target Platform**: modern browsers — the app is a pure-browser SPA, desktop and mobile

**Project Type**: single-page web app (Vite), no server

**Performance Goals**: no measurable cost — one hit test per press, and the bubble is
already drawn every frame by the preview's mirror loop

**Constraints**: no new dependencies; the placement changes no recording size and no clip
data; the crop gesture keeps working for every press that is not on the bubble; the bubble
stays wholly inside the recorded region and stays a circle; the placement is per sitting
and never persisted; a placement never alters a take already recorded

**Scale/Scope**: one new domain value object and its test; edits to `webcam.ts`,
`region.ts` and `view-lifetime.ts`; one folded end-to-end check; one `GLOSSARY.md` entry.
About one screen of interface

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The constitution (`.specify/memory/constitution.md`, v1.0.0) names six principles and
points at `.agents/skills/` and `GLOSSARY.md` for their detail. This plan is checked
against them:

| Principle | Gate | How this plan passes |
|---|---|---|
| **I. The skills are the constitution** | The plan agrees with the skills | Consulted **overview**, **domain-model** and **verification**; the change follows the domain-model skill's "where a rule belongs", "state has an owner and a lifetime" and "the view listens". No divergence. |
| **II. `src/domain/` is pure** | No DOM/browser in `domain/` | `WebcamBubble` imports nothing; the canvas and the pointer stay in `ui/`. The bubble's geometry is stated once, in the domain, and both the preview and the compositor ask it. |
| **III. Every rule has a test beside it** | A unit test in node | `WebcamBubble.test.ts` beside the class: the bounds, the containment clamp, the default corner across region shapes, and the hit test. |
| **IV. What is drawn is proved in a browser** | A committed browser check | One check folded into `e2e/checks/capture.spec.ts`: move, resize, record and read the take back; and the crop still crops. The recorder's flow (a real share) is the user's session, stated in the pull request. |
| **V. The words come first** | New concept in `GLOSSARY.md` before the code | The **webcam bubble** and its **placement** are written into `GLOSSARY.md` beside the **crop region**, before the code uses them. |
| **VI. One change per PR; CI owns the version** | One change, no manual version bump | This is one change on its own branch; `package.json` is not touched. |

**Result**: PASS — no violation, so the Complexity Tracking table stays empty.

**Post-design re-check**: PASS — the Phase 1 design adds no dependency, no storage, no new
directory and no rule outside `src/domain/`; the same six gates hold.

## Project Structure

### Documentation (this feature)

```text
specs/010-move-resize-webcam-bubble/
├── plan.md                     # this file (/speckit.plan)
├── research.md                 # Phase 0 output — every decision and its rejected alternative
├── data-model.md               # Phase 1 output — WebcamBubble and the view state
├── quickstart.md               # Phase 1 output — the manual walk and the two proofs
├── contracts/
│   └── webcam-bubble.md        # Phase 1 output — the value object and the interaction contract
├── checklists/
│   └── requirements.md         # the spec-quality checklist (/speckit.specify)
├── spec.md                     # the specification (/speckit.specify)
└── tasks.md                    # Phase 2 output (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
src/
├── domain/capture/
│   ├── WebcamBubble.ts          # NEW — the placement: a circle over the recorded region
│   └── WebcamBubble.test.ts     # NEW — its unit test in node
├── ui/recording/
│   ├── webcam.ts                # holds the sitting's placement and the drag; draws the
│   │                            #   bubble and its rim handle (drawWebcamOverlay)
│   ├── region.ts                # routes a preview press: the bubble first, else the crop
│   └── preview.ts               # unchanged call site — the mirror already draws the bubble
├── ui/recording/record-flow.ts  # unchanged injection — drawBubble reads the placement
└── ui/lifecycle/view-lifetime.ts# reset the placement when the session ends (cleared)

e2e/checks/capture.spec.ts       # the folded check: move, resize, record, and the crop
GLOSSARY.md                      # the webcam bubble and its placement, beside the crop region
```

**Structure Decision**: Single Vite app, no new directories. The rules of the circle go in
`src/domain/capture/` beside `CropRegion` and `SourceSet`, as a value object with a test
beside it. The placement's *state* and the drawing stay in the webcam view
(`ui/recording/webcam.ts`), because the placement changes only what is drawn and the
compositor already receives the drawing by injection. The one cross-gesture decision — a
press on the preview is the bubble's or the crop's — stays in `region.ts`, the module that
already owns the preview's pointer handlers. The end-to-end proof folds into the existing
bubble check in `capture.spec.ts`.

## Complexity Tracking

> No constitution violations. The change is small, adds no dependency, layer or directory,
> and introduces one value object with its test plus a few view edits.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
