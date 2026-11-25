# Implementation Plan: Export Resolution

**Branch**: `013-export-resolution` | **Date**: 2026-11-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/013-export-resolution/spec.md`

## Summary

A clip is **worked in** at its **clip size** — the picture the review shows, which every take is
fitted into, derived from the takes as it is today (`008-clip-size` stands). This feature adds a
second, **optional** size: the **export resolution**, the size the **file** is finally written at.
With none set, the file is the clip size, exactly as today.

The export resolution keeps the clip size's **aspect ratio**: it is the clip size **scaled**,
both edges made even, so the file is the same picture as the review at fewer (or more) pixels —
nothing cropped, stretched or letterboxed. Because the encoder's **bitrate follows its picture**
(`src/infra/export-target.ts`), a smaller export resolution writes a **smaller file**: that is how
the resolution controls the export size.

It is a **clip property** like the logo, add to export, annotation colour and sound boost — so the
person sets it in the clip's own settings, and a **profile** may **fix** it, giving a production a
common resolution across everything it makes, with nothing to press and no way to change it while
the profile is active.

The whole feature is small and central because the export already draws every take into a canvas
of the **picture it is handed** (`src/infra/offline-encoder.ts`: the canvas is `options.width ×
options.height`, each take is `fitIn` it, and the annotations and the card are drawn from
`context.canvas.width/height` in fractions). So the change is: one domain rule that answers **the
picture the file is written at**, one clip property that carries the person's or a profile's
choice, and the three write paths — the download, the Bluesky publish and the YouTube publish —
handing that picture to the encoder instead of `clip.size()`. The review is untouched.

## Technical Context

**Language/Version**: TypeScript 6 (ES modules)

**Primary Dependencies**: none new. Vite for the build; Vitest (unit) and Playwright
(end-to-end) as today

**Storage**: none new. The export resolution is a **clip property**, kept with the clip in the
existing IndexedDB clip store (`src/infra/clip-store.ts`) through `ClipSnapshot.properties`; a
profile that fixes it is kept by the profiles' own store, untouched

**Testing**: Vitest in node for the domain rule (`ExportResolution.test.ts`), the clip property's
`with`/`value`, and the flows' picture; Playwright in `e2e/` for the one thing only a browser can
show — that the **file's own picture** is the export resolution, decoded from the downloaded bytes

**Target Platform**: the browser (Chrome 94+, Firefox 130+), as the app is today

**Project Type**: single-project browser app (`src/` four layers + `web/` shell + `e2e/`)

**Performance Goals**: setting the export resolution is immediate (a property change, like any
other); a smaller export resolution writes a smaller file and encodes no slower than the same clip
at its own size, since the picture is smaller

**Constraints**: `src/domain/` stays pure (no DOM, no `ui/`/`infra/` import); the **review** and
the **clip size** are untouched — only the picture handed to the encoder moves; the encoder's own
picture (`options.width/height`) and the publish's **aspect ratio** must be the same two numbers,
so the post and the file cannot disagree; the word **export resolution** is written into
`GLOSSARY.md` before the code, and the stale **clip size** row is corrected

**Scale/Scope**: one new clip property, one domain rule, one panel row (a list), the same row in a
profile's sheet by the existing `seedable` flag, and three call sites that already compute a
picture

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. The skills are the constitution** — the plan follows `.agents/skills/domain-model` (a rule
  is a class named after the word, and the view listens), `overview` (which document owns which
  fact) and `verification` (a unit test for the rule, a browser check for the encoded file). Pass.
- **II. `src/domain/` is pure** — `ExportResolution` is a new class in `src/domain/clip/` with no
  DOM and no `ui/`/`infra/` import; it is arithmetic over a width and a height, exactly as
  `ClipSize` and `SoundBoost` already are. The picture is applied in the view (the three flows) and
  the encoder, which are the browser boundary. Pass.
- **III. Every rule has a test beside it** — `ExportResolution.test.ts` proves `of`, the level
  parse and `picture` (the aspect kept, both edges even, up and down); the clip property's
  `with`/`value` and the flows' picture have their own node tests. Pass.
- **IV. What is drawn, played or encoded is proved in a browser** — a new `e2e/checks/` spec drives
  a real export and **probes the file's own video track** (`probeFile`), asserting the picture is
  the chosen resolution and, with none set, the clip size. Pass.
- **V. The words come first** — `GLOSSARY.md` gains **export resolution** before the code, and its
  **clip size** row (which still says the person sets it, removed by `008-clip-size`) is corrected
  in the same change rather than left to lie. Pass.
- **VI. One change per pull request, and CI owns the version** — one change on its own branch;
  `package.json` is not touched. Pass.

No violations, so Complexity Tracking is empty.

**Post-design re-check (after Phase 1)**: the design kept every gate. The rule stayed in
`src/domain/clip/ExportResolution.ts`; the descriptor is the app's register (`ui/clip/`), which
already carries the clip's properties; the picture is applied where a browser is already in hand
(the export and publish flows, and the encoder). The spec was not edited by the design: the aspect
rule (FR-004) is what makes fitting a take straight into the export canvas equal to the clip-size
fit scaled, so the design follows the spec rather than bending it. Still Pass.

## Project Structure

### Documentation (this feature)

```text
specs/013-export-resolution/
├── plan.md                     # This file
├── research.md                 # Phase 0 output
├── data-model.md               # Phase 1 output
├── quickstart.md               # Phase 1 output
├── contracts/
│   └── export-resolution.md    # Phase 1 output — the rule, the clip property, the write paths, the panel
└── tasks.md                    # Phase 2 (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
src/
├── domain/
│   └── clip/
│       ├── ExportResolution.ts        # new: the id, the levels, `of`, `picture` — the whole rule
│       ├── ExportResolution.test.ts   # new: up, down, aspect kept, even edges, refusal
│       ├── ClipSize.ts                # unchanged; `of`'s even/ceiling rules are what `picture` builds through
│       └── ClipProperties.ts          # unchanged; the value is an ordinary named string
├── ui/
│   ├── clip/
│   │   ├── clip-properties.ts         # one more descriptor: `exportResolution`, `control: 'choice'`, `seedable`
│   │   ├── properties-panel.ts        # unchanged: a `choice` row is a list, and a fixed one reads as its label
│   │   └── timeline-ui.ts             # the export size under the Export button is computed at the export picture, so it matches the file
│   └── exporting/
│       ├── export-flow.ts             # `picture` becomes the export resolution, not the clip size
│       └── frame-renderer.ts          # unchanged: annotations and the card are drawn from the canvas it is given
├── ui/publishing/
│   ├── publish-flow.ts                # `picture` becomes the export resolution (encoder size + post ratio)
│   └── youtube-flow.ts                # the same, for the YouTube upload
├── ui/profile/
│   ├── apply.ts                       # unchanged: walks `seedableClipProperties()`, so it carries the new item
│   └── profile-def.ts                 # unchanged: a `choice` item is a list with **Not fixed** above it
└── infra/
    ├── offline-encoder.ts             # unchanged: the canvas is the picture it is handed; each take is fitted into it
    └── export-target.ts               # unchanged: the bitrate follows the canvas, which is the point

e2e/
└── checks/
    └── export-resolution.spec.ts      # new: the file's own picture is the chosen resolution, or the clip size
GLOSSARY.md                            # + export resolution; the clip size row corrected
```

**Structure Decision**: single project, the four layers as they are. The **rule** — what the levels
are, that a value is one of them or the clip size, and that the picture keeps the clip size's
aspect — lives in `src/domain/clip/ExportResolution.ts`, the same shape `src/domain/sound/SoundBoost.ts`
already uses (the id and the rule in the domain; the descriptor in the app's register). The
**person's side** is one descriptor in `src/ui/clip/clip-properties.ts`, which the panel, a
profile's sheet and the automation surface all read without naming the property. The **application**
is three call sites that already compute a picture — `src/ui/exporting/export-flow.ts`,
`src/ui/publishing/publish-flow.ts` and `src/ui/publishing/youtube-flow.ts` — each calling the one
domain function. Nothing in `domain/` imports the view or a browser.

## Complexity Tracking

> No Constitution Check violations: nothing to justify.
