# Data Model: Magnifier Annotation

The feature adds one **annotation kind** with a shape made of numbers, one generic capability on
the annotation layer (a renderer that reads the picture), and one generic property control (a
number). It adds no aggregate, no stored record of its own and no schema version; it grows the
shapes the app already has. Nothing about the takes, the cuts, the export plan, the clip
properties, the profiles, the store or the sidecar changes.

## `Magnifier` — `src/domain/annotation/Magnifier.ts` (new)

The fifth kind. An id, a `Span`, a geometry of numbers in fractions of the picture, and the rim
colour.

| member | rule |
|---|---|
| `static id` | `'magnifier'` — the id both registries key on |
| `static DEFAULT_COLOUR` | the app's red (`DEFAULT_ANNOTATION_COLOUR`) — what one stored before colours existed reads back as |
| `DEFAULT_ZOOM` | `2` — what a new magnifier starts at |
| `MIN_ZOOM` / `MAX_ZOOM` | `1.5` / `8` — what the kind accepts; a value outside is refused |
| `ZOOM_STEP` | `0.5` — what the preferences' − / + move by |
| `MIN_RADIUS` | `0.04` — the smallest lens, as a fraction of the shorter side; smaller is not a lens to keep |
| `MAX_RADIUS` | `0.5` — a lens never fills more than the shorter side |
| `geometry` | `{ readonly x: number; readonly y: number; readonly radius: number; readonly zoom: number }` — the centre and the radius as fractions of the picture, the radius against the **shorter side**; zoom a factor |
| `colour` | `AnnotationColour` — the rim colour, kept beside the geometry as the arrow keeps its own |
| `create(span, geometry, id?, colour?): Magnifier \| null` | clamps the centre to `[MIN_RADIUS, 1 − MIN_RADIUS]`, caps the radius to `min(MAX_RADIUS, x, 1 − x, y, 1 − y)`, refuses a radius below `MIN_RADIUS`, a zoom outside `[MIN_ZOOM, MAX_ZOOM]` or a non-number; builds the geometry |
| `restore(stored): Magnifier \| null` | the same normalisation from `StoredAnnotation`; null when it is not a usable lens (it is then left out, as an unknown kind is) |
| `isUsable` | a finite centre, `MIN_RADIUS ≤ radius ≤ MAX_RADIUS`, `MIN_ZOOM ≤ zoom ≤ MAX_ZOOM` |
| `handles(picture?): readonly AnnotationHandle[]` | two grips on the horizontal rim: `{ x ± R / w, y, end: 'left' | 'right' }`, where `R = radius × min(w, h)`; the first is the left, the last the right. Without a picture, a square approximation (`x ± radius`) so a caller that only asks how many handles there are still works |
| `withHandle(end, to, options?): Magnifier \| null` | null unless `options.picture` is given and the end is a grip; the new radius is the pixel distance from the centre to `to` over the shorter side; clamped to `[MIN_RADIUS, min(MAX_RADIUS, x, 1 − x, y, 1 − y)]`; the **centre does not move** |
| `movedBy(dx, dy): Magnifier \| null` | the centre shifted, clamped to `[radius, 1 − radius]` so the lens stays wholly inside; the radius, zoom and colour kept |
| `withZoom(zoom): Magnifier \| null` | the same lens at another zoom, refused unless finite and inside the range — the **Zoom** property's `with` |
| `withColour(colour): Magnifier` | the same lens with another rim colour — the **Colour** property's `with` |
| `withSpan(span): Magnifier` | the same lens over another stretch |
| `duplicated(span): Magnifier` | a new id, the same geometry and colour — what copy/paste makes |
| `hitTest(x, y, w, h, tolerancePx): boolean` | `hypot((x − centre.x) × w, (y − centre.y) × h) ≤ radius × min(w, h) + tolerance`, so a press inside the lens picks it |
| `stored()` | `{ id, kind: 'magnifier', s, e, geometry: { x, y, radius, zoom, colour } }` |

**Rules**

- The radius is measured against the **shorter side** and the renderer draws with
  `min(w, h)`: a lens is a true circle at every picture shape, and a circle of diameter at most
  the short side always fits. No picture aspect is stored, so a clip that grows cannot leave a
  stale ratio behind.
- A drag or resize past the edge is **pulled inside** — the centre is clamped, or the radius is
  capped at the room the centre leaves — never lost and never turned into an ellipse.
- A **cut** is not the kind's business: `AnnotationSet.shownAt` gives the kept stretches the same
  answer for every kind, and a cut through the lens's stretch shows it only over the kept part.
- The **lens's own centre** is what it magnifies (see the renderer): the region it samples is
  inside itself, so it never samples off the picture.
- The kind holds no picture, no bytes and no canvas: the colour is one of the palette, and the
  rest is numbers.

## `Annotation` — `src/domain/annotation/Annotation.ts` (changed)

| member | rule |
|---|---|
| `PictureSize` | `{ readonly w: number; readonly h: number }` — the picture a handle's fraction is measured against, as numbers (no DOM) |
| `handles(picture?: PictureSize)` | **optional** — a kind whose grips depend on the picture's shape asks for it. The arrow, image, text and sound ignore it and their existing tests and call sites stay valid |
| `HandleOptions.picture?: PictureSize` | what a resize may be told about the picture, beside `free`; a kind that resizes a shape (the magnifier) reads it, a kind whose ends are its resize ignores it |

**Rules**

- The signature change is **additive**: every existing kind keeps its implementation and its
  tests pass unmodified; the layer, the canvas and the inspector pass the picture where they have
  it, so the magnifier's grips sit on its rim.
- The domain still touches no canvas: the picture is two numbers handed in.

## The picture pass — `src/ui/annotating/annotation-layer.ts` (changed)

| member | rule |
|---|---|
| `AnnotationRenderer.readsPicture?` | **new, optional** — true for a renderer that needs the picture beneath it. The magnifier's is the first; the layer names no kind |
| `AnnotationRenderer.draw(ctx, annotation, w, h, picture?)` | the fifth argument is the picture source, handed to every renderer; the ones that do not read it ignore it |
| `needsPicture(annotations, draft?)` | **new** — true when a shown annotation, or the draft, has a renderer that says it reads the picture; false otherwise |
| `pictureFor(ctx, annotations, draft?)` | **new** — one copy of `ctx.canvas` into a reused scratch canvas when `needsPicture` is true, taken **before any annotation is drawn**; null otherwise. `copyPicture(ctx)` is the DOM helper; `ctx.canvas` is 0×0 → null |
| `drawOrder(annotations)` | **new** — the annotations that read the picture first, then the rest, each group in the family's stable order. The same order is used for drawing, hit-testing and grips |
| `drawAnnotations(ctx, w, h, annotations, selectedId?, dissolve?, hasSettings?, picture?)` | **new optional `picture`** — the copy the caller took; it is handed to every renderer, and the gripped/dissolved drawing is unchanged |
| the callers | the playback loop, the editing canvas and the frame renderer call `pictureFor` before `drawAnnotations` (the canvas with its draft); the canvas draws its draft last with the same picture |
| the scratch canvas | one module-level canvas, resized to the context when needed; the copy is taken and used inside one synchronous call, so it is never observed half-drawn |
| the grips and controls | unchanged: drawn after the annotations, from `handles({ w, h })`, so a magnifier's grips sit on its rim and the remove/copy/settings controls hang off the middle as for every kind |

**Rules**

- The copy is the **clip's picture alone**: it is taken before any annotation, so a lens magnifies
  the picture and not the app's marks; the marks are drawn after the picture-reading kinds, so
  they keep their brightness and their own size over the dim and the lens.
- One copy per rendered frame, only while a reader is shown; a clip with no lens pays nothing.
- The drawing function itself touches no DOM: the copy is one helper, so the order and the
  picture argument are provable in node with a fake, and the copy is the browser check's.
- The review's loop, the editing canvas and the offline export all call this one function, so the
  review and the file cannot disagree about the lens.

## `Magnifier` in the view — `src/ui/annotating/magnifier-plugin.ts` (new)

| member | rule |
|---|---|
| `id` | `Magnifier.id` (`'magnifier'`) |
| `action` | `label: 'Magnifier'`, a title, a magnifying-glass icon — the annotate row's and the lane's mark |
| `readsPicture` | **true** — the callers copy the picture for it and the layer draws it first |
| `renderer` | itself: the dim, the lens and the rim, below |
| `properties` | **Colour** (`control: 'colour'`), **Zoom** (`control: 'number'`, `min: MIN_ZOOM`, `max: MAX_ZOOM`, `step: ZOOM_STEP`, `suffix: '×'`); the shared **Duration** is added by `propertiesFor` |
| `begin(ctx)` | arm the drag: press at the detail's centre, drag outward. The draft is built from `from` (the centre) and the distance to `to` converted to the shorter side; a stray or shorter-than-`MIN_RADIUS` drag adds nothing and says the smallest size; a valid one is committed and picked, and its grips show (its preferences are opened from its settings control, as for every drawn kind) |

**The look**, drawn from the annotation's geometry in the picture's pixels:

| part | rule |
|---|---|
| `DIM_ALPHA` | about `0.55` — one level for the build; the picture outside the circle, filled as the whole canvas with the circle cut out (even-odd), in black at that alpha |
| the lens | clipped to the circle of pixel radius `R = radius × min(w, h)`; the source is the central square of side `2R / zoom` around the centre, drawn to the circle's `2R × 2R`; the source is inside the lens and so inside the picture |
| the rim | a ring on the circle in the annotation's colour, over a thin dark edge, widths scaled from the picture's width as the arrow's are, so it reads on light and dark pictures |
| the dissolve | the layer's own: the dim, the lens and the rim are drawn under the annotation's alpha at the edges of its stretch, so neither pops in or out |
| no picture | if no picture was handed (a direct call in a test), the dim and the rim are still drawn; the lens has nothing to sample and leaves the picture untouched |

## `AnnotationProperty` and the inspector — `src/ui/annotating/annotation-plugin.ts`, `properties-inspector.ts` (changed)

| member | rule |
|---|---|
| `PropertyControl` | gains **`'number'`** — a numeric value with − / + and a readout |
| `AnnotationProperty.min?`, `max?`, `step?`, `suffix?` | **new optional** facts a number control shows and clamps by; ignored by the other controls |
| the inspector's `number` row | a `prop-row` with the label, a `prop-step` either side and a readout of the value with the suffix (e.g. `2×`); a step is applied through `property.with`, an out-of-range value is refused by the kind and reported by the inspector as today |
| the inspector's `place()` | passes `{ w: el.cv.width, h: el.cv.height }` to `handles`, so a magnifier's panel sits beside its rim rather than a square approximation |

**Rule**: the inspector still names no kind; the magnifier's **Zoom** is a declaration, and the
next numeric property is a declaration too.

## The canvas — `src/ui/annotating/annotation-canvas.ts` (changed)

| change | rule |
|---|---|
| the draft | `repaint` takes one picture with `pictureFor(ctx, shown, this.preview())`, calls `drawAnnotations(..., picture)`, and then draws the draft itself with the same picture |
| hit and grip | `hitAnnotation` and `gripAt` use the layer's `drawOrder` reversed, so the annotation a press picks is the one on top (a lens is under the other marks, so a press where a mark covers it picks the mark) |
| resize | `withHandle` is passed `{ free: e.shiftKey, picture: { w: el.cv.width, h: el.cv.height } }` |
| remove/copy/settings | unchanged: they hang off `handles({ w, h })` and the settings control exists because the kind has properties |

## Keeping, the file and the automation surface

| surface | rule |
|---|---|
| `ClipSnapshot.annotations` / `clip-store.ts` | the stored annotation, generically — the geometry travels as numbers; no schema change, no migration |
| `AnnotationSidecar` | the same, generically; an imported file's magnifier comes back through `annotationFrom`, an unknown kind is left out |
| `ExportPlan` / `planExport` / the encoder | **no change**: the plan already carries the shown annotations and the encoder already calls `drawAnnotations`, so every drawn output inherits the lens; a carried export carries the numbers beside the file, as for every kind |
| the title card | no magnifier: the card draws only its own words by construction |
| `PROFILES_FORMAT`, `Profile` | untouched: a magnifier is not a clip property and no profile controls it |
| `AnnotationSummary` — `src/ui/agent/surface.ts` | gains **`geometry: unknown`** — the annotation's `stored().geometry`, so an agent can read a magnifier's centre, radius, zoom and colour (and an arrow's points, for the same reason) |
| `describeClip` — `src/ui/agent/describe.ts` | reports that geometry with the kind and the properties, from the same annotation the view reads |
| `makeAnnotation` — `src/ui/agent/make.ts` | `makeMagnifier`: `x`, `y` (the centre), `radius` (shorter-side fraction, default `0.2`) and `zoom` (default `DEFAULT_ZOOM`); refused with the kind's reason when the region or the zoom is not one |
| MCP `annotate` — `mcp/src/tools.ts` | `kind` gains `"magnifier"`, with `x`, `y`, `radius`, `zoom` documented; `set_property` names `"zoom"` (and colour) for a magnifier; `describe_clip` says the geometry is there |
| `edit.annotate('magnifier', …)` / `edit.setProperty(id, 'zoom', …)` / `edit.remove` / `edit.undo` | as for every kind: the maker is data alone, the property goes through the kind's descriptor, the one undo covers placing, changing and removing |

## State transitions

| from | event | to |
|---|---|---|
| a clip in review, a stretch selected | the person adds a **Magnifier** and drags from a detail outward | a magnifier over the stretch, in the clip's annotation colour, at `DEFAULT_ZOOM`, picked with its grips |
| the picture at a moment | the playhead enters the stretch | the lens shows the central `1 / zoom` of its circle enlarged, the surround dims; both ease in with the dissolve |
| the picture at a moment | the playhead leaves the stretch, or a cut takes the moment away | nothing of the magnifier is drawn |
| the preferences, **Zoom** changed | `clip.changeAnnotation` | the same lens enlarges the centre more or less; the circle's place and size stay |
| the preferences, **Colour** changed | `clip.changeAnnotation` | the rim is the new colour in the review and every file |
| the duration changed | the shared duration property | the lens and the dim are shown for the new length |
| the rim dragged | the shared resize | the radius changes around the same centre, and the source stays inside |
| the lens dragged | the shared move | the centre shifts, pulled inside the picture |
| a cut approved through the stretch | the clip announces | the lens is shown only over the kept part; the rest returns when the cut is undone |
| the magnification copied and pasted | the shared canvas | a new magnifier with a new id, the same geometry and colour, at the playhead |
| the magnifier deleted | the shared canvas | gone from the picture, the lane and every file; the one **undo** brings it back |
| the clip exported | the encoder | the same layer draws the lens and the dim into every frame of its stretch; the recording is not re-encoded |
| the page reloaded, or the publishing sign-in returned | the store loads the annotations | the magnifier comes back by its numbers |
| a file imported with a sidecar | `carry` | the magnifiers it holds are taken on; an unknown kind is left out |
| a clip written by a later build with a shape this one does not know | open | that annotation is left out and the rest opens |

## Validation rules

| rule | where | test |
|---|---|---|
| a lens needs a finite centre and radius, at least `MIN_RADIUS`, at most `MAX_RADIUS` | `Magnifier.create` / `isUsable` | `Magnifier.test.ts` |
| a lens is a circle at any picture shape | `Magnifier.handles(picture)`, the renderer | `Magnifier.test.ts` (the grips use `radius × min(w, h)`); the `annotations.spec.ts` check (the drawn rim) |
| a lens is always wholly inside the picture | `create`, `movedBy`, `withHandle` | `Magnifier.test.ts` |
| a zoom outside `[MIN_ZOOM, MAX_ZOOM]` is refused | `Magnifier.withZoom` / `create` | `Magnifier.test.ts`, the property test |
| a resize keeps the centre and the zoom | `Magnifier.withHandle` | `Magnifier.test.ts` |
| a cut takes its part of the lens's stretch | `AnnotationSet.shownAt`, shared | the existing `AnnotationSet`/`Clip` tests, unmodified |
| the kind is rebuilt from what was written, an unknown kind is left out | `restore`, `kinds` | `Magnifier.test.ts`, `kinds.test.ts` |
| the shown set asks for a picture only when a reader is in it | `needsPicture` | `annotation-layer.test.ts` |
| the readers are drawn first and handed the picture | `drawOrder`, `drawAnnotations` | `annotation-layer.test.ts` |
| the draft gets the same picture | the canvas's `repaint` | the `annotations.spec.ts` check |
| a pick matches what is on top | `drawOrder` reversed in the canvas | the canvas/layer tests |
| the zoom is a property, the colour is a property, the shared duration follows | the plugin's `properties`, `propertiesFor` | the plugin/property tests |
| the geometry is reported, and a magnifier is made and edited by an agent | `describe`, `make.ts`, `setProperty`, MCP | `surface.test.ts`, `edit.test.ts`, `tools.test.ts`, the `agent.spec.ts` check |
| the lens and the dim are in the file, and the recording is unchanged | the one drawing layer + the encoder | the `annotations.spec.ts` check |
| every existing kind and cut behaves as before | the registries and the shared canvas | the existing `Arrow`/`ImageAnnotation`/`TextAnnotation`/`SoundAnnotation`/`Clip`/`AnnotationSet` tests, unmodified |