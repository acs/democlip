# Research: Magnifier Annotation

Phase 0 decisions. Each is the rule the spec asks for, placed where the app's layers say it
belongs: the lens's shape and limits in `src/domain/`, the look and the picture it reads in
`src/ui/`, and the surfaces the family already has. The clarification settled three things, and
they are marked: **in the circle itself**, **dim the rest**, **adjustable zoom, default 2×**.

## A kind is a class plus a plugin — the fifth one

**Decision**: `Magnifier` (`src/domain/annotation/Magnifier.ts`) is a fifth subclass of
`Annotation`, beside `Arrow`, `ImageAnnotation`, `TextAnnotation` and `SoundAnnotation`. It holds
the span every annotation holds, its **geometry** (a centre, a radius, a zoom and a rim colour)
and nothing of the browser. Its behaviour in the view is a plugin under the same id,
`src/ui/annotating/magnifier-plugin.ts`: the action, the creation gesture and the renderer.

**Why**: `.agents/skills/domain-model` makes a kind a class in the domain plus a plugin in the
view, under one id. That is what gives the magnifier pick, move, resize, copy, paste, delete,
undo, the lane, the snapshot, the sidecar, the store and the automation surface without writing
any of them again. It also keeps the family's promise that adding a kind changes no existing
kind and no cut: a class, a line in `kinds.ts`, a plugin, a line in `plugins.ts`.

**Alternatives considered**: a clip-wide "lens" effect outside the annotation family — rejected:
it would fork every family feature (one undo, the lane, copy/delete, the sidecar, the agent) into
a second implementation. Reusing an image annotation with a captured picture — rejected: it
freezes a frame, requires bytes, goes stale as the picture moves, and cannot follow the moment.
A special editing mode that draws into the video — rejected: the recording is never re-encoded
and the review/export share one annotation layer.

## Geometry: centre + radius of the shorter side + zoom + rim colour

**Decision**: `MagnifierGeometry` is
`{ x, y, radius, zoom, colour }`: the centre and radius as **fractions of the picture**, the
radius measured against the picture's **shorter side** (so `0.5` fills it), the zoom as a number,
and the rim colour as one of the app's palette. `handles(picture?)` returns two grips on the
horizontal rim; `withHandle(end, to, options)` reads `options.picture` to convert the dragged
point to a radius; `movedBy` clamps the centre; `create` caps the radius to what fits and refuses
one below the smallest; `restore` drops an unusable one. The lens's **pixel radius is
`radius × min(w, h)`**.

**Why**: a circle in fractions of a non-square picture is an ellipse unless the picture's shape
is taken into account. Measuring the radius against the **shorter side** and drawing with
`min(w, h)` keeps the lens round at any picture shape, keeps it wholly inside (a circle of
diameter at most the short side always fits), and needs **no stored aspect that could go stale**
when the clip grows — the failure mode the image kind's stored `pictureAspect` already has. The
grips' positions in fractions do depend on the shape, which is why `handles` and the resize take
the picture: numbers only, no DOM, so the domain stays pure. The conservative clamp
`radius ≤ min(x, 1−x, y, 1−y)` is enough at every aspect.

**Alternatives considered**: a radius as a fraction of the width with a stored aspect — rejected:
the aspect goes stale if a larger take changes the clip's shape, and then the grips leave the
rim. A rect in fractions with a forced square — rejected: it is an ellipse on screen. Pixels —
rejected: the review, the export and a reload run at different sizes. A separate `Picture` port
for handles — rejected: the width and height are already on hand at every call site.

## The picture the lens reads: one copy of the picture, and picture-reading kinds first

**Decision**: `AnnotationRenderer` gains an optional **`readsPicture`** and a fifth `draw`
argument, the picture source. `annotation-layer.ts` also exports:

- **`needsPicture(annotations, draft?)`** — does the shown set (or the draft) hold a renderer that
  reads the picture?
- **`pictureFor(ctx, annotations, draft?)`** — one copy of `ctx.canvas` before anything is
  drawn, into a reused scratch canvas, when `needsPicture` says so; null otherwise. The copy
  itself is a DOM helper beside the layer.
- **`drawOrder(annotations)`** — the picture-reading ones first, then the rest in the family's
  stable order.

The callers — the playback loop, the editing canvas and the frame renderer — take
`pictureFor(ctx, shown, draft)` **before** `drawAnnotations`, and `drawAnnotations`:

1. draws the shown annotations in **draw order**, handing the copy to every renderer (the others
   ignore it);
2. draws the picked annotation's grips and controls, as today.

The canvas draws its **draft last with the same picture**. `drawOrder` is also what the canvas
**hit-tests and grabs in** (reverse of it), so what a press picks is what is on top.

**Why**: in the review, the editing canvas and the export alike, the frame is drawn onto the
canvas before the annotations. A copy of that canvas is therefore the clip's picture exactly as
it appears, in the same pixels and at the same size, with no video element, no port and no second
decode — and it works identically in the offline export, where there is no element to read.
Taking it **before any annotation** is what lets the lens magnify the picture and not the app's
marks; drawing the picture-reading kinds **first** is what keeps every other annotation at full
brightness and at its own size over the dim and the lens, which is the spec's FR-016/FR-017. One
copy per frame only while a lens shows is the least that keeps the rules; a clip with no lens
pays nothing. Keeping the copy out of the drawing function leaves the layer's rules testable in
node against a fake picture, and names the one browser boundary — `document.createElement` — in
one helper.

**Alternatives considered**: read the `<video>` element in the renderer — rejected: the export
has no element, and the review and the file would diverge. Hand the renderer the frame from the
encoder — rejected: it needs a new port threaded through the export, the review and the canvas.
`getImageData` and a pixel blit — rejected: slower and no larger a picture. Draw the lens in its
insertion order and let it sample annotations — rejected by the spec (annotations are not
magnified or dimmed) and it would flicker as the stack changed. A second DOM/canvas layer over
the picture — rejected: the export has one canvas. Copying inside `drawAnnotations` — workable,
but it would put the DOM into the drawing function the node tests exercise; the helper keeps the
same one-copy rule and the same order without it.

## The lens magnifies **its own centre** (the clarification: in the circle)

**Decision**: inside the lens, the region sampled is the **central square of side `2R/zoom`**
around the lens's centre, drawn into the lens (side `2R`) through a circular clip. A 2× lens of
radius `R` therefore shows the middle half of what it covers, enlarged to fill it.

**Why**: an in-place magnifying glass maps a smaller area below the glass to the glass's aperture.
Taking the source from the **centre** instead of the whole circle is what keeps every sampled
pixel inside the picture (the source is `R/zoom < R`, and `R` already fits), so the lens never
samples off-frame or invents content, and the detail is what the person centres the circle on.
It also makes the zoom's meaning exact: a larger zoom shows a smaller, more enlarged centre. The
rim is the edge of the enlarged view, as on a real glass.

**Alternatives considered**: draw the whole circle's contents scaled and clipped — rejected: at
2× it would sample a region `√2·R` across (outside the circle, and possibly off-frame), and the
rim would show content that is not what is magnified. A separate lens placed elsewhere —
rejected by the clarification. A full-frame camera zoom — rejected by the clarification (the
circle stays visible). Sampling a square outside the lens and letterboxing it — rejected: the
lens would show content the person never circled.

## The spotlight dim is one fixed level, and the app's marks stay bright

**Decision**: while a magnifier shows, the region **outside its circle** is darkened by one
level the build chooses (`DIM_ALPHA`, a view constant, about 55% black), drawn as a full-canvas
rectangle with the circle cut out (even-odd fill). The dim and the lens are drawn under the
annotation's own dissolve alpha, so both ease on and off with the stretch. The dim darkens the
**clip's picture**; the app's annotations are drawn after it and keep their brightness and
place. Its strength is not a property.

**Why**: the clarification chose "dim the rest". One level keeps the effect legible, consistent
between the review and every file (the same renderer), and one fewer control on a kind whose
job is to point. Drawing it as part of the magnifier means it moves, resizes, copies, deletes and
undoes with the annotation, and it is on screen only for the stretch — no clip-wide setting, no
second thing to find on the lane. Applying the annotation's alpha makes the dim arrive and leave
with the lens rather than snapping, as every annotation does at its edges.

**Alternatives considered**: a blur or a vignette — the spec puts them out of scope and the
clarification said dim. An adjustable dim — the spec's out-of-scope list; a later property, like
a sound's volume. Dimming the annotations too — rejected: it would make the very marks that
explain the picture unreadable, and would depend on whether a mark was placed before or after
the magnifier. A dim drawn per frame as a separate pass before all annotations — workable, but
more machinery than the layer's order already provides.

## The zoom is a property on a generic number control (clarification: adjustable, default 2×)

**Decision**: the magnifier declares **Colour** (the existing colour control) and **Zoom**
(a generic `'number'` control with `min`, `max`, `step` and a `×` suffix), and inherits the
shared **Duration**. The domain owns `DEFAULT_ZOOM = 2`, `MIN_ZOOM = 1.5`, `MAX_ZOOM = 8`,
`ZOOM_STEP = 0.5`; `withZoom` refuses a value outside, the inspector says why, and the value is
kept with the annotation. A new one starts at 2×.

**Why**: the clarification made the zoom adjustable and the project's pattern puts adjustable
facts in the annotation's **preferences** through the one inspector, as a colour, a text's words
and a duration already are. A generic number control (rather than a "zoom" control) keeps the
inspector naming no kind: the next numeric property is a declaration, not an inspector change.
The domain owns the range because "a zoom of 100× is not this kind" is a rule, not a look; the
same range is what an agent is told and what a stored value is checked against.

**Alternatives considered**: one fixed zoom — rejected by the clarification. A per-clip zoom —
rejected: each magnifier frames a different detail. A slider — the app's only numeric control is
the duration's − / + stepper; matching it keeps one look. A zoom stored as the lens's linear
size instead of a factor — less legible to a person and to an agent.

## Adding and editing are the family's

**Decision**: the **Magnifier** row in the annotate options arms the kind; the person presses at
the **centre of the detail** and drags outward to the rim, the draft showing the lens live; a
stray or too-short drag adds nothing and says the smallest size. The placed lens has **two grips
on the horizontal rim**, both resizing radially from the centre, plus the family's remove, copy
and settings controls and the shared gestures: pick inside the circle, drag to move, drag a grip
to resize, **⌘/Ctrl+C**/**⌘/Ctrl+V**, Delete, the one undo. It is found by its mark on the
**annotation lane**, and its stretch can be changed by the shared duration.

**Why**: "resizable circle" and "during the duration of the annotation" are exactly the family's
selection, move, resize and duration; the plugin seam exists so a kind describes only what is
its own (the drag from a centre, the look) and gets the rest. The drag from the centre outward is
the gesture that puts the detail where the lens magnifies it (the centre), rather than asking a
person to draw a bounding box whose centre is not obvious. Two opposite grips resize the radius
without moving the centre, which is what a lens wants; the layer's control placement already
works from a pair of ends.

**Alternatives considered**: a bounding-box drag (corner to corner) — rejected: the circle's
centre and radius are then a guess from the box, and a different drag on each axis. One grip —
rejected: the shared control placement needs two ends for the remove/copy/settings controls to
sit off the middle. A private gesture or controls — rejected: the spec requires the shared ones,
and the family's learning curve is the point. A separate lane-only editor — rejected: a magnifier
is on the picture and is picked there.

## Kept, restored, carried: numbers, no bytes, no schema change

**Decision**: `stored()` writes `{ id, kind: 'magnifier', s, e, geometry: { x, y, radius, zoom,
colour } }`. The clip snapshot, the clip store and the annotation sidecar already write every
`StoredAnnotation` generically, and `annotationFrom` rebuilds the kind. A clip or a sidecar with
a kind this build does not know is opened with that annotation left out, as for any kind. No
image store, no audio store and no profile format is touched.

**Why**: a magnifier is a window onto the picture that is already in the clip; it needs no bytes
of its own, so it is a few numbers, like a cut or an arrow, and moves with the clip. The family's
keeping and carrying are already generic, so the new kind gets persistence, the reload, the
publishing sign-in return, the "file for editing" sidecar and the unknown-kind rule for free.

**Alternatives considered**: store a captured still of the magnified region — rejected: bytes,
stale from moment to moment, and a second picture to keep. Store the lens as a video filter in
the recording — rejected: the recording is never re-encoded. A new sidecar field — rejected: the
geometry already carries it.

## The automation surface reads geometry and makes one from numbers

**Decision**: `describe()` adds each annotation's **`geometry`** (the `stored()` geometry) to its
summary; `make.ts` grows `makeMagnifier` reading `x`, `y`, `radius` and `zoom` (defaults: centre,
`0.2`, `DEFAULT_ZOOM`), refusing a region or zoom the kind refuses; MCP `annotate` gains
`kind: "magnifier"` with those fields and `set_property` already changes `zoom`, `colour` and
`duration`. The **region** is changed the way an arrow's points are changed by an agent — remove
and add — because the surface has no move/resize operation for any kind. The MCP tool's
description says the centre, the radius in shorter-side fractions and the zoom range.

**Why**: the spec asks an agent to place one, read its region, zoom and length, change them,
delete it and undo. The kind's values are plain data, so exposing the geometry is a data change
on the surface, not a rule; the maker is data alone, like an arrow's points; and the existing
`set_property` already edits every declared property, so the zoom and the rim colour are one
declaration away. Reading the geometry also makes the arrow's and text's data visible, which is
the same kind of improvement rather than a magnifier special case.

**Alternatives considered**: declare the centre and radius as **properties** — rejected: the
inspector would then show four rows a person edits by dragging the circle, and a "resize" would
become a text field. Add a `resize` operation for every kind — a real feature of its own, not
this one. A separate `add_magnifier` tool — rejected: a magnifier is data, like an arrow, so it
belongs in `annotate`.

## Offered where a picture is, and only there

**Decision**: the kind's plugin says nothing about `needsPicture`, so it defaults true; the
annotate options offer it only on a clip in review with a picture. A **sound-only clip does not
offer it**, and the sound kind still does. The lane and the canvas need no change: both are
kind-agnostic.

**Why**: a lens has nothing to magnify without a picture; the existing flag is exactly the rule
the sound kind used in the other direction, and one flag on the plugin keeps `annotate-options`
naming no kind. The clip's turns, reloads and growing take are handled by the family, and a cut
through the stretch is handled by `shownAt`, which the review and the export share.

**Alternatives considered**: draw a placeholder on a sound-only clip — rejected: it would be a
lens over nothing. Special-case the kind in the options row — rejected by the module's "names no
kind" rule. Offer it on an empty clip — rejected: there is no picture, and the app's rule for
every drawn kind is to wait for review with a picture.

## Verification: node for the rules, a browser for the effect, a person for the taste

**Decision**: the rules are unit-tested in node — `Magnifier.test.ts`, `kinds.test.ts`,
`annotation-layer.test.ts`, the plugin/property tests, `surface.test.ts`, `edit.test.ts` and
`tools.test.ts`. One committed check in `e2e/checks/annotations.spec.ts` places a magnifier the
way a person does, asserts the row count and the lane mark, reads the preview's pixels to see
the enlarged white frame number and the darker surround, exports with and without the lens and
reads the frames back to prove the file carries the same effect and that the recording's length
is unchanged; one in `e2e/checks/agent.spec.ts` places one through the automation surface, reads
its geometry and zoom, changes the zoom and takes it away. **What it looks like** — whether the
dim is too heavy, the rim too thick — is a person's judgement, stated in the quickstart.

**Why**: the verification skill asks for a unit test per rule and a committed browser check for
what is drawn, played or encoded, and prefers folding into an existing check over a new one per
behaviour. The lens and the dim are drawn, so a browser check is the proof; the preview and the
file go through the same `drawAnnotations`, so the check reads both and shows they agree. The
frame's own white index is a detail the lens enlarges, which makes the test see magnification
rather than inferring it from a changed pixel. The agent's path is a second, independent story,
so it has its own check as the skill allows.

**Alternatives considered**: one check per behaviour (place, move, resize, zoom, colour, copy,
delete, undo, cut, reload) — rejected by the skill's one-or-two rule; those are the family's
shared gestures, already checked for the other kinds, and the new behaviour is the lens and the
dim. A temporary `verify-*.html` harness — retired by the skill; the e2e suite is the committed
replacement. Recording the preview and watching it — rejected: no suite can judge the look, and
the pixels are the objective part.

## What is deliberately not changed, and where a later refinement goes

**Decision**: the **takes**, the **cuts**, the **export plan**, the **encoder**, the **clip
size**, the **profiles**, the **sound annotations**, the **watermark**, the **title card**, the
**sidecar** and the **store** are untouched. A magnifier is an ordinary drawn annotation; the
card draws only its own words. A later iteration could add a **separate lens** placed elsewhere
(the clarification's rejected option, still a coherent future feature), an **adjustable dim**
(another property of the kind), a **blur** outside the lens, an **animated zoom** or **pan**
within a stretch, or a lens that **follows a subject** — each an addition to this kind, not a
change to the family.

**Why**: the spec bounds this version, and every item above would either change what the recording
is (re-encoding) or add a mechanism where a declaration is enough. The non-destructiveness is
what "removing the annotations gives the recording back whole" rests on, and the family's shared
machinery is what makes the kind cheap to add and safe to keep.

**Alternatives considered**: ship the separate lens and the in-place one together — rejected by
the clarification and the spec's "out of scope"; two lens modes is a second feature. Animate the
zoom — rejected by the spec's out-of-scope list; the zoom is constant for a stretch.