# Implementation Plan: Annotation Duration, Placement and Stretch

**Branch**: `010-annotation-duration` | **Date**: 2026-11-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-annotation-duration/spec.md`

## Summary

Two halves of the same gap. First, the annotate kinds move off the selected stretch of
the timeline — where each new kind widens a row until the controls collide — into a
**vertical column of rows on the picture, just below the clip's settings control**. The
column is built from the plugin register, one row per kind, so adding a kind adds a row
and crowds nothing.

Second, an annotation's **duration becomes a value it holds** instead of a stretch frozen
at the moment it was made. A kind pressed with a stretch selected spans that stretch; with
nothing selected it starts at the playhead with a fixed default. Either way the duration is
a **seconds value in the annotation's preferences** — a stepper, applied through the clip's
own `changeAnnotation`, so it is announced, taken back by the one undo and kept with the
clip like any other change. A picked annotation's stretch is drawn **on the timeline beside
a selected cut section**, and it is the **active stretch** while it is picked; the timeline
draws more than one stretch at a time, all in kept time.

The value is the annotation's own `span`, so nothing new is stored: `stored()`/`restore()`
already carry it, and the recording is never re-encoded.

## Technical Context

**Language/Version**: TypeScript ^6.0.3, ES modules, strict.

**Primary Dependencies**: Vite ^8.3.8 (dev server and build), Vitest ^5.1.1 (node tests),
Playwright ^1.65.1 (the committed `e2e/` suite), Mediabunny ^1.66.1 (offline export),
`@atproto/oauth-client-browser` ^0.5.15 (Bluesky sign-in). **No new runtime dependency**:
the annotate column and the seconds control are DOM and CSS, and the duration arithmetic is
on the existing `Annotation` and `Span` classes.

**Storage**: unchanged. A duration is the annotation's own `span` (the fractions `s`/`e`),
which `stored()` already writes and `restore()` already reads, so the clip store's small
half carries it with everything else. The recording is never touched, and the image store
is untouched.

**Testing**: Vitest in node for `Annotation.withDuration` and the duration constants, the
duration **property descriptor**, and `propertiesFor` (the kind's properties plus the
duration, the watermark excluded); a **committed `e2e/` check** for the annotate column,
placing an annotation with and without a selected stretch, the seconds control changing the
annotation in playback and in the export, the picked annotation's band on the timeline
beside a selected cut section, and the one undo. The existing `Arrow`, `ImageAnnotation`,
`TextAnnotation`, `AnnotationSet`, `Clip`, `ExportPlan`, `annotation-plugin` and
`properties-inspector` tests are the regression proof and must pass **unmodified**.

**Target Platform**: Modern browsers. The column sits inside `.preview-wrap`, below the
clip's `#props-btn`; the seconds control is a row in the existing properties popover, placed
and clamped as `ui/recording/camera-menu.ts` already places its menu.

**Project Type**: Single-project browser application (SPA), no backend.

**Performance Goals**: no measurable change. A duration change is one `changeAnnotation`,
which repaints one frame; the annotate column is a handful of DOM rows and does not run
while hidden.

**Constraints**: no new runtime dependency; `src/domain/` stays pure; the existing kind
tests pass **unmodified**; **`propertiesOf`'s signature does not change** — the shared
duration is added by a new `propertiesFor(annotation, clip)`, so a refactor's proof is the
old tests untouched; one step per pull request; CI owns the version and `package.json` is
never bumped by hand; the words go into `GLOSSARY.md` before they appear in code.

**Scale/Scope**: three kinds today (arrow, image, text). Every hand-placed annotation gains
the duration property, so the image — which declared none — now draws a settings control
(with the duration alone); the clip's **watermark** is excluded. The change touches the
domain's `Annotation`, the view's annotate options (new), the timeline marks and lane, the
properties inspector and the plugin seam, one shared layout helper, plus markup, CSS, the
help modal, `FEATURES.md` and the README.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status | Evidence |
|---|---|---|---|
| I. The skills are the constitution | The plan must not disagree with `.agents/skills/` or `GLOSSARY.md`; new words go in the glossary first | PASS | Step 1 adds **annotation duration**, **annotate options** and **active stretch** to `GLOSSARY.md` and notes the new modules in the Domain model skill before any code moves. The plan follows the Domain model skill (rule in the class, drawing in the view, one id) and the Verification skill (unit test vs a committed `e2e/` check). |
| II. `src/domain/` is pure | No DOM, no browser API, no import from `ui/` or `infra/`; a collaborator is a port | PASS | `Annotation.withDuration(seconds, total, min)` is arithmetic on `Span` fractions — no canvas, no element. The column, the seconds control and the timeline band are `ui/`. |
| III. Every rule has a test beside it | A rule in `domain/` is proved by a unit test in node; a refactor's proof is the old tests passing unmodified | PASS | Tests for `withDuration` (start kept, end clamped to the clip, a too-short value refused, a zero-length clip refused, every kind's other fields kept) and the duration descriptor. `propertiesOf`'s signature is untouched, so its tests and the kind tests pass unmodified. |
| IV. What is drawn, played or encoded is proved in a browser | A committed check in the `e2e/` suite, run in a real browser | PASS | `quickstart.md` names a committed `e2e/` check for the column, placing both ways, the seconds control in playback and export, the timeline band and the one undo. The recorder is untouched and stated as a gap. |
| V. The words come first | A new concept is written into `GLOSSARY.md` before it appears in code | PASS | Step 1 is a docs-only change. |
| VI. One change per pull request, and CI owns the version | A plan's step gets its own branch and pull request; `package.json` is never bumped by hand | PASS | Six steps, each its own branch and pull request. No step edits `package.json`. |

No violations. The Complexity Tracking table stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/010-annotation-duration/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1 entities and the rule
├── quickstart.md        # Phase 1 verification guide
├── contracts/
│   └── annotation-duration.md   # The duration rule, the descriptor, the column seam
├── checklists/
│   └── requirements.md  # Specification quality checklist
└── spec.md              # Feature specification
```

### Source Code (target layout)

```text
src/
├── domain/
│   └── annotation/
│       ├── Annotation.ts     # NEW: withDuration, DEFAULT_ANNOTATION_S, MIN_ANNOTATION_S
│       └── Annotation.test.ts # NEW: the withDuration tests (or beside the kinds)
├── ui/
│   ├── annotating/
│   │   ├── annotation-plugin.ts     # PropertyControl gains 'duration'
│   │   ├── annotate-options.ts      # NEW — the vertical column, built from plugins()
│   │   ├── annotation-lane.ts       # draws the picked annotation's stretch (the active one)
│   │   ├── properties-inspector.ts  # a 'duration' row: a seconds value with steps
│   │   ├── annotation-canvas.ts     # the settings control now shows for every non-watermark
│   │   ├── duration-property.ts     # NEW — the shared descriptor, built from the clip
│   │   └── plugins.ts               # unchanged
│   ├── cutting/
│   │   └── marks.ts                 # the section's kind buttons are removed
│   ├── clip/
│   │   └── clip.ts                  # NEW: stretchLayout(span) — one layout for every stretch
│   └── agent/
│       └── edit.ts                  # setProperty reads propertiesFor (duration included)
├── web/
│   ├── index.html                   # the column's element
│   └── styles.css                   # the column, the duration row, the active stretch
└── FEATURES.md, README.md, GLOSSARY.md, web/help.html
```

**Structure Decision**: the duration rule lives on the annotation class
(`domain/annotation/`); the descriptor and every control live in the view under
`ui/annotating/`, shared by all kinds. The annotate column is one view module that names no
kind — it asks `plugins()`. The timeline band reuses one `stretchLayout` helper in
`ui/clip/clip.ts`, so the cut section and the picked annotation's stretch are laid out by
the same arithmetic. The clip's settings control keeps its place and the column hangs below
it, so no new region of the page is invented.

## Implementation Sequence

Each step is its own branch and pull request. A step leaves the app working and its tests
green.

| Step | Change | Proof | Pull request |
|---|---|---|---|
| 1 | **Words.** Add **annotation duration**, **annotate options** and **active stretch** to `GLOSSARY.md`; note the new modules in the Domain model skill. No code. | Docs review. | `docs/annotation-duration-words` |
| 2 | **The duration rule.** `Annotation.withDuration(seconds, total, min?)` — keeps the start, clamps the end inside the clip, refuses a value below the minimum or a zero-length clip; `DEFAULT_ANNOTATION_S` and `MIN_ANNOTATION_S`. | Unit tests: the start held, the end clamped to `1`, a too-short value `null`, `total = 0` `null`, and the colour/geometry/words kept on every kind. | `feat/annotation-duration-rule` |
| 3 | **The annotate options on the picture.** A new `ui/annotating/annotate-options.ts` renders the vertical column below `#props-btn` from `plugins()`; `marks.ts` stops drawing kind buttons on the section; a press places over the selected stretch, or over the playhead with the default. | A committed `e2e/` check: the column shows one row per kind in review and none outside it; a press with a stretch selected places over it, and with none places at the playhead with the default; the timeline section is clear of kind buttons. | `feat/annotate-options` |
| 4 | **The duration in the inspector.** `PropertyControl` gains `'duration'`; `duration-property.ts` and `propertiesFor(annotation, clip)` add the shared descriptor (the watermark excluded); the inspector renders a seconds value with − / +; `edit.ts` reads `propertiesFor`. | Unit tests for the descriptor (`value`/`with`) and `propertiesFor` (kind properties plus duration; the watermark none). A committed `e2e/` check: the image now has a settings control; the seconds value changes the annotation in playback and export; the one undo reverts it; a refused value says why. | `feat/annotation-duration-property` |
| 5 | **The picked annotation's stretch on the timeline.** `stretchLayout(span)` in `ui/clip/clip.ts`; `annotation-lane.ts` draws the picked annotation's band in kept time as the active stretch, beside the cut section, the other annotations keeping their finder marks. | A committed `e2e/` check: picking an annotation draws its stretch as the active one; with a cut section selected both are shown; letting it go leaves the cut's; a cut closes the band up. | `feat/annotation-stretch-lane` |
| 6 | **Docs and final verification.** The help modal, `FEATURES.md` and the README say where the kinds are and that a duration is a value; the full suite and the committed checks; a real reload by the user. | The three levels of the Verification skill; the existing tests unmodified. | `docs/annotation-duration-final` |

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. The change adds no layer, no dependency and no change to recording or
publishing. It adds one domain method, one shared descriptor and one shared layout helper,
and grows the kind contract by one control name.

## Post-Design Constitution Check

Re-checked after the Phase 1 design artifacts were written.

| Principle | Result | Evidence |
|---|---|---|
| I. The skills are the constitution | PASS | The plan follows the Domain model skill (the rule in the class, drawing in the view, one id) and the Verification skill (a committed `e2e/` check in place of the retired harness). Step 1 updates the glossary and the skill first. |
| II. `src/domain/` is pure | PASS | `contracts/annotation-duration.md` keeps the rule on `Annotation` and the descriptor in the view; `data-model.md` gives `withDuration` plain numbers and fractions. |
| III. Every rule has a test beside it | PASS | `data-model.md` names the `withDuration` tests and the descriptor tests; `quickstart.md` runs them; `propertiesOf` is unchanged so the existing seam tests pass unmodified. |
| IV. What is drawn, played or encoded is proved in a browser | PASS | `quickstart.md` names the committed `e2e/` checks for the column, the placement, the seconds control, the timeline band and undo; the real reload is stated as the user's. |
| V. The words come first | PASS | Step 1 is docs-only. |
| VI. One change per pull request, and CI owns the version | PASS | Six steps, each its own branch and pull request; no step edits `package.json`. |

No new violations. The design is ready for `/speckit.tasks`.
