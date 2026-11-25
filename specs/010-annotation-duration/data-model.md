# Phase 1 — Data Model

The entities this feature adds or changes, their fields, the rules they enforce, and how
they move. Field names are the ones the code will use; the words are the ones
`GLOSSARY.md` gains first (step 1 of the plan).

## Changed entity — `Annotation`, the base class

`src/domain/annotation/Annotation.ts`

```ts
/** The length a new annotation is given when nothing is selected, in seconds. */
export const DEFAULT_ANNOTATION_S = 2;

/** The shortest stretch worth keeping an annotation over, in seconds. */
export const MIN_ANNOTATION_S = 0.1;

export abstract class Annotation {
  // … existing: id, span, kind, handles, withHandle, movedBy, withSpan,
  //   duplicated, hitTest, stored …

  /**
   * The same annotation over a new duration, in seconds of the clip. The start is
   * kept and the end is clamped inside the clip; null when the clip has no length
   * or the duration is below `min`.
   */
  withDuration(seconds: number, total: number, min: number = MIN_ANNOTATION_S): Annotation | null;
}
```

**Rules**

- the **start is kept**: `withDuration` never moves an annotation, only changes how long it
  shows (spec FR-007; the inspector's seconds value is a length, not a position);
- the end is `min(1, span.s + seconds / total)`, so the annotation never runs past the clip
  (FR-010); the value itself may exceed what remains — the *shown* end is what clamps, and
  the export's kept-time mapping already drops the part a cut took;
- `total <= 0` returns `null` (a clip with nothing in it has no duration to speak of);
- a result shorter than `min` returns `null`, so the shortest worth keeping is a rule and
  not a UI convention (FR-013);
- it delegates to the kind's own `withSpan`, so the colour, the geometry, the words and the
  id are kept by construction — no kind is touched and no kind's test changes;
- `stored()`/`restore()` are unchanged: the span already is the duration, so a clip written
  before this change reads back with the stretch it had.

## Changed entity — `PropertyControl`, the shared controls

`src/ui/annotating/annotation-plugin.ts`

```ts
/** Which shared control edits a property. */
export type PropertyControl = 'colour' | 'text' | 'duration';
```

**Rules**

- one more control name, nothing else in `AnnotationPlugin` changes;
- `propertiesOf(annotation)` keeps its signature and its meaning — the properties a *kind*
  declares — so its tests and every kind's tests pass unmodified.

## New entity — the duration descriptor, and `propertiesFor`

`src/ui/annotating/duration-property.ts` and `src/ui/annotating/annotation-plugin.ts`

```ts
/** The one shared duration property, over the clip's own length. */
export function durationProperty(clip: Clip): AnnotationProperty;

/** The properties of an annotation: its kind's, plus the shared duration unless it is the clip's watermark. */
export function propertiesFor(annotation: Annotation, clip: Clip): readonly AnnotationProperty[];
```

`durationProperty(clip)` returns an `AnnotationProperty`:

| Field | Value |
|---|---|
| `id` | `'duration'` |
| `label` | `'Duration'` |
| `control` | `'duration'` |
| `value(annotation)` | the seconds, as a string: `(annotation.span.length * clip.total()).toFixed(2)` |
| `with(annotation, value)` | parse to a number, then `annotation.withDuration(seconds, clip.total())`; `null` when it will not parse or the annotation refuses it |

**Rules**

- one descriptor, shared by every kind (FR-016), so a kind is added without touching it;
- `propertiesFor(annotation, clip)` is `propertiesOf(annotation)` plus the duration
  descriptor, and the descriptor is omitted for an annotation in `clip.watermarks()`
  (D8, FR-008's assumption);
- `propertiesFor` is a **new** function: `propertiesOf` is not changed, so the existing seam
  tests stay unmodified (Principle III);
- a value the annotation refuses gives `null`, and the inspector leaves the annotation
  unchanged and says why (FR-014).

## New view entity — the annotate options

`src/ui/annotating/annotate-options.ts`, `web/index.html` (`#annotate-bar`),
`web/styles.css`

| Entity | What it is | Lifetime |
|---|---|---|
| `AnnotateOptions` (the module's `init`) | The vertical column below `#props-btn`, one row per `plugins()` entry (the kind's `action.icon` and `action.label`). A press computes the span — `selection.section()`, else the playhead plus `DEFAULT_ANNOTATION_S` — and calls `canvas.add(kind, span)`. | The clip's; shown only in review with a clip |

**Rules**

- it names no kind: it asks `plugins()` (FR-015);
- shown only when an annotation could be made — `currentPhase() === 'review'` and
  `session.clip.total() > 0` (FR-003);
- one row per kind, in a column, so a kind never crowds another (FR-002);
- it re-renders on the clip's `onChange` and on a phase change, and holds no state of its
  own.

## New view helper — `stretchLayout`

`src/ui/clip/clip.ts`

```ts
/** Where a span (fractions of the clip) sits on the timeline, in kept time: left, width. */
export function stretchLayout(span: Span): { left: string; width: string };
```

**Rules**

- converts through `keptOf`/`keptLengthNow` exactly as the marks do today, so one span lands
  in one place whether it is the cut section or an annotation's band (FR-020);
- returns CSS percentages, so both callers drop it into a `style`.

## Changed entity — the annotation lane, and the active stretch

`src/ui/annotating/annotation-lane.ts`

| Member | Change |
|---|---|
| `renderLane()` | the picked annotation is drawn as a **band** over its whole stretch, in kept time, marked as the active stretch; the others keep their start marks |
| the active stretch | `canvas.selectedId` names it; a pick (from the picture or a lane mark) makes that annotation's band active |

**Rules**

- the band sits on `#tl-annots`, beside the cut section, not in place of it (FR-016, D7);
- letting the annotation go, or picking another, moves the band with the pick (FR-018);
- a cut closes the band up through `stretchLayout`; the clip's `take-added`/`cut-approved`
  events already re-render the lane (FR-019);
- an annotation entirely inside a cut draws no band, as its mark draws none today.

## Changed entity — the timeline marks

`src/ui/cutting/marks.ts`

| Piece | Change |
|---|---|
| the section's action row | the kind buttons (`plugins().map(...)`) are **removed**; the scissors and the keep/undo stay |
| the section's position | computed through `stretchLayout` rather than the module's own `at`/`pctWidth` |
| `import { plugins }` | dropped |

**Rules**

- the section no longer offers kinds, so there is exactly one place to add one
  (FR-001, FR-015);
- cutting is untouched: the same marks, the same scissors, the same undo.

## Changed entity — the properties inspector and the canvas

`src/ui/annotating/properties-inspector.ts`, `src/ui/annotating/annotation-canvas.ts`

| Piece | Change |
|---|---|
| the inspector's `render()` / `open()` | use `propertiesFor(annotation, session.clip)` instead of `propertiesOf(annotation)` |
| the inspector's `row()` | a third control: `'duration'` draws the seconds value with − / + (`DURATION_STEP_S = 0.1`) |
| the canvas's settings-control check | `propertiesFor(picked, session.clip).length > 0`, so the image — which now has the duration — also draws a control, and the watermark does not |

**Rules**

- a duration change goes through `clip.changeAnnotation`, so it is announced, undone once
  and kept, with no second path (FR-009, FR-010 of the properties feature);
- the stepper's − stops at the minimum and + at what remains of the clip (FR-013);
- an out-of-range or unparsable value is refused and explained (FR-014);
- the cycle of opening and closing is unchanged: the control toggles the popover, and the
  popover closes on a new pick, a removal, Escape, an outside click and a resize.

## Changed entity — the agent's editing surface

`src/ui/agent/edit.ts`

| Piece | Change |
|---|---|
| `setProperty` | reads `propertiesFor(annotation, clip)` so `duration` is settable, with the same refusal shape |
| `annotate` | unchanged: a named `span` becomes the `withSpan` the maker builds, and its length is the duration (D9) |

**Rules**

- the tool list in `surface.ts` does not change — no new operation (D9);
- an agent's duration change is a person's change: announced, undone, kept.

## Changed entity — the stored shape

No change. The span (`s`, `e`) already is the duration:

```ts
// every kind, as today
{ id, kind, s, e, geometry }
```

**Rules**

- a clip stored before this change reads back with the stretch it had (no migration);
- the recording and the pictures are untouched.

## State transitions

| From | Event | Effect |
|---|---|---|
| review, a stretch selected | a kind is pressed in the column | the annotation is made over that stretch; its duration is the stretch's length |
| review, nothing selected | a kind is pressed in the column | the annotation is made at the playhead; its duration is `DEFAULT_ANNOTATION_S` |
| a picked annotation | its settings control is pressed | the popover opens with the kind's properties and the duration |
| a picked annotation | the duration is stepped up or down | `withDuration` → `changeAnnotation` → `annotation-changed`; the picture, playback and the export show the new length, the lane band follows, and one undo holds the previous annotation |
| a picked annotation | a duration below the minimum or past the clip is asked | it is clamped to what remains, or refused with a message; the annotation is unchanged |
| a picked annotation | the clip has no length | the duration is refused |
| a picked annotation | it is picked (from the picture or a lane mark) | its stretch is drawn on the timeline as the active stretch |
| a picked annotation and a cut section | both are set | both stretches are shown; the annotation's is active |
| a picked annotation | it is let go, or another is picked | its band leaves the timeline; the other's becomes active |
| the clip's watermark | it is picked | no duration; it keeps spanning the clip |
| the picked annotation | the page reloads | the clip store carries the span; the annotation comes back the same length |
| an agent | places over a named span, or sets `duration` | the same change a person's is |
