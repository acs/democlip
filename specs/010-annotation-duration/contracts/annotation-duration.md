# Contract — annotation duration and the annotate options

The seams this feature adds or changes. Each is what its neighbours may rely on, written so
a caller can be changed without reading the other side.

## 1. The duration rule — `Annotation.withDuration` (domain)

```ts
withDuration(seconds: number, total: number, min: number = MIN_ANNOTATION_S): Annotation | null;
```

**Preconditions**: `seconds` is a finite number; `total` is the clip's length in seconds,
`>= 0`.

**Postconditions**

- when it answers an annotation: the same kind and id, the **same start fraction**
  (`span.s`), the end at `min(1, span.s + seconds / total)`, and every other field the kind
  carries (colour, geometry, words) unchanged;
- when it answers `null`: nothing is changed, and the caller leaves the annotation as it was
  — the reasons are `total <= 0`, or a resulting length below `min`;
- it never throws.

**Consumers**: the duration descriptor's `with`; tests. **Nothing else** computes a new
duration.

**Constants**: `DEFAULT_ANNOTATION_S = 2` (a new annotation with nothing selected),
`MIN_ANNOTATION_S = 0.1` (the shortest worth keeping), exported from the same module.

## 2. The property seam — `AnnotationProperty`, `PropertyControl`, `propertiesFor` (view)

```ts
export type PropertyControl = 'colour' | 'text' | 'duration';

/** What can be changed after it is placed. A kind with none gets no settings control. */
export interface AnnotationProperty {
  readonly id: string;
  readonly label: string;
  readonly control: PropertyControl;
  value(annotation: Annotation): string;
  with(annotation: Annotation, value: string): Annotation | null;
}

/** The kind's own properties, unchanged. */
export function propertiesOf(annotation: Annotation | null): readonly AnnotationProperty[];

/** The kind's properties plus the shared duration, except for the clip's watermark. */
export function propertiesFor(annotation: Annotation, clip: Clip): readonly AnnotationProperty[];

/** The one shared duration property, over the clip's own length. */
export function durationProperty(clip: Clip): AnnotationProperty;
```

**Guarantees**

- `propertiesOf` keeps its signature and answers only what a **kind** declares — a caller
  that wants the duration asks `propertiesFor`;
- `propertiesFor` answers `propertiesOf(annotation)` followed by the duration descriptor,
  and omits the duration when `clip.watermarks()` includes the annotation;
- the duration descriptor's `value` answers seconds with two decimals; its `with` parses a
  number and calls `withDuration`, answering `null` when it will not parse or the rule
  refuses it;
- a caller applies a changed property through `clip.changeAnnotation` and nothing else, so
  announcing, the one undo and keeping stay the clip's.

**Consumers**: the properties inspector, the annotation canvas (the "has a settings control?"
check), the agent's `setProperty`.

## 3. The annotate-options seam (view)

The column is built from the existing plugin register; it adds no register of its own.

```ts
/** The kinds the column offers, in the order they were registered. */
export function plugins(): readonly AnnotationPlugin[];

/** Begin making one of `kindId` over `span`. */
AnnotationCanvas.add(kindId: string, span: Span): void;
```

**Guarantees**

- one row per `plugins()` entry, with the kind's `action.icon` and `action.label` — adding a
  kind adds a row and changes nothing here;
- a press computes the span as `selection.section()`, else `Span.of(f, f + DEFAULT_ANNOTATION_S / total)`
  from the playhead (`f = player.time() / total`), and calls `canvas.add(kind, span)`;
- the column is shown only in review with a clip, and holds no state;
- the timeline section no longer draws kind buttons — the column is the one place a kind is
  offered.

## 4. The timeline stretch seam (view)

```ts
/** Where a span (fractions of the clip) sits on the timeline, in kept time. */
export function stretchLayout(span: Span): { left: string; width: string };
```

**Guarantees**

- a span that is entirely cut away answers a zero width;
- the cut section (`ui/cutting/marks.ts`) and the picked annotation's band
  (`ui/annotating/annotation-lane.ts`) both use it, so the two stretches land by the same
  arithmetic;
- values are CSS percentages, ready for a `style`.
