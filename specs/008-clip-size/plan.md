# Implementation Plan: Clip Size

**Branch**: `record-size` | **Date**: 2026-11-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/008-clip-size/spec.md`

## Summary

A clip gets one **clip size** — a width and height, both even — that the review shows
and every export and publish writes. Each take carries the size of its own picture;
the clip's size is the largest width and largest height among those pictures, rounded
up to even, and it follows them: a larger take grows it and a smaller one does not
shrink it. Every take is drawn into that size whole and centred, letterboxed against
the clip's background, in the review and in the export alike.

The size is **shown as a clip property** and is not the person's to set: the shared
panel draws its value and offers no control, and the automation surface refuses to
change it. It is derived, never stored, so nothing can hold a clip to a shape its own
takes do not have. The takes themselves are untouched — the size changes what is
drawn, never the recorded bytes, so the app's "never re-encoded" rule holds.

## Technical Context

**Language/Version**: TypeScript 6 (ES modules)

**Primary Dependencies**: mediabunny (decode/encode, file inspect), Vite; Vitest
(unit), Playwright (end-to-end)

**Storage**: IndexedDB (the clip store; a take's picture size travels with its blob)

**Testing**: Vitest in node for every rule in `src/domain/`; Playwright in `e2e/` for
what is drawn, played or encoded

**Target Platform**: the browser — Chrome 94+, Firefox 130+ (WebCodecs)

**Project Type**: single-project browser app (`src/` four layers + `web/` shell)

**Performance Goals**: changing the clip size redraws the review immediately; the
export still runs ~10× real time

**Constraints**: `src/domain/` stays pure (no DOM, no `ui/` or `infra/`); a rule
lives in one class; the view listens to the clip's events

**Scale/Scope**: a handful of takes in a clip; a picture up to 8192×8192

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. The skills are the constitution** — the plan follows `.agents/skills/domain-model`
  (a rule is a class; the view listens) and `.agents/skills/verification` (unit test for
  a rule, browser check for what is drawn). Pass.
- **II. `src/domain/` is pure** — `ClipSize` is a class in `src/domain/clip/` with no
  DOM import; the fit rule and the even rule are its own. The take's picture size is
  data an adapter measures and passes in. Pass.
- **III. Every rule has a test beside it** — `ClipSize.test.ts`, plus extensions to
  `Take.test.ts`, `Clip.test.ts`, `ClipProperties.test.ts`. Pass.
- **IV. What is drawn, played or encoded is proved in a browser** — an `e2e/checks/`
  spec drives the real app: two takes of different sizes, one frame size, the size
  changed and kept and undone. Pass.
- **V. The words come first** — `GLOSSARY.md` gains **clip size** (and **fit**) before
  the code, and the code, tests and commit use them. Pass.
- **VI. One change per pull request, and CI owns the version** — this is one change on
  its own branch; `package.json` is not touched. Pass.

No violations, so Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/008-clip-size/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── clip-size.md     # Phase 1 output — the ClipSize API and the property seam
└── tasks.md             # Phase 2 (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
src/
├── domain/clip/
│   ├── ClipSize.ts          # new: the size value object, even rule, fit rect
│   ├── ClipSize.test.ts     # new
│   ├── Clip.ts              # size(): the takes' largest, derived
│   ├── Clip.test.ts         # the largest, the growth, and that a property cannot move it
│   ├── Take.ts              # carries its own picture size
│   ├── Take.test.ts         # refuses a picture with no size
│   └── TakeRepository.ts    # add(blob, duration, picture)
├── application/
│   ├── record-take.ts       # passes the measured picture to addTake
│   ├── import-take.ts       # passes the inspected picture to addTake
│   └── ports/
│       ├── TakeProbePort.ts # measure → duration + picture
│       └── TakeFilePort.ts  # inspect → duration, sound, picture
├── infra/
│   ├── take-probe.ts        # reads videoWidth/videoHeight
│   ├── take-file.ts         # reads the track's display size
│   ├── takes.ts             # TakeRepository.add(…, picture)
│   └── clip-store.ts        # a stored take keeps its picture size
└── ui/
    ├── clip/
    │   ├── clip-properties.ts    # the size row, read-only
    │   ├── properties-panel.ts   # draws the size as a value, not a control
    │   ├── clip.ts               # seekAndDraw fits; resizeReview()
    │   ├── review-flow.ts        # openReview sets the canvas to the clip size
    │   ├── playback.ts           # drawClipFrame fits
    │   ├── dissolve.ts           # hold/draw fit; letterbox is the background
    │   └── thumbnail.ts          # unchanged (cells stay the take's own shape)
    ├── recording/preview.ts      # drawFrame(vid, frame?)
    ├── annotating/annotation-canvas.ts  # redraws the frame under the grips, fitted
    ├── exporting/export-flow.ts  # picture from clip.size()
    ├── exporting/frame-renderer.ts     # 1:1 (canvas is already the clip size)
    ├── publishing/publish-flow.ts      # aspect ratio from clip.size()
    └── publishing/youtube-flow.ts      # picture from clip.size()
infra/offline-encoder.ts               # fills the background; draws each sample fitted
web/styles.css                         # (no change: the canvas is already #000)
```

**Structure Decision**: single project. The rule (even, largest, fit) lives in
`src/domain/clip/ClipSize.ts`; the adapters that measure a take's picture size live in
`src/infra/`; the panel and the review that show and use the size live in `src/ui/`.
Nothing in `domain/` or `application/` imports the view or a browser.

## Complexity Tracking

> No Constitution Check violations: nothing to justify.
