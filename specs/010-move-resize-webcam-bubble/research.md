# Phase 0 — Research: Move and Resize the Webcam Bubble

All decisions the spec left open are resolved here. There are no `NEEDS CLARIFICATION`
items: the feature description fixed the shape (a circle), the lifetime (per sitting) and
the boundary (the live preview only), and each remaining choice below has a clear answer
with a rejected alternative.

## R1 — Where the placement lives (state ownership)

**Decision**: The placement is **view state owned by the webcam view** — held in
`src/ui/recording/webcam.ts`, exported as that module's object, and reset when the
session ends. It never enters `src/domain/`'s collaborators, `src/application/` or the
`Clip`.

**Rationale**: The placement changes only *what is drawn*, never the recording's size and
never the clip's data. The compositor already receives the bubble's drawing by injection
(`drawBubble` in `CompositorPort`, wired in `ui/recording/record-flow.ts`), so the drawing
can read the placement from the view without the domain or the application knowing it
exists. The domain-model skill is explicit: *view state belongs to the view module that
owns the widget, and that module exports the instance its state lives on.*

**Alternatives considered**:
- **On the `capture` adapter, beside `region`.** `region` (`CropRegion`) sits on the
  adapter because the **record use case** reads it to size the compositor canvas — the
  crop changes the recording's dimensions. The bubble placement changes no dimension, so
  putting it on the adapter would make an adapter hold view state that no use case reads.
  Rejected.
- **On the `Clip`.** The placement is the sitting's, not the clip's, is never persisted,
  and must not alter a take already recorded. Rejected.

## R2 — The rules are a value object, not free functions

**Decision**: A new **`WebcamBubble`** class in `src/domain/capture/WebcamBubble.ts`,
with its unit test beside it.

**Rationale**: A circle that is always inside the region, with a bounded diameter, a
hit test, and the same geometry in the preview and in the recording, is a concept that
needs rules — so it is a **class named after the word**, in `domain/`, tested in node
(constitution II and III; the domain-model skill). Stating the geometry once is what makes
*what you see* and *what is recorded* agree: the preview and the compositor call the same
`drawWebcamOverlay`, which asks the same value object.

**Alternatives considered**:
- **Free functions in the view** (`clampBubble`, `hitBubble`). A rule outside a class is
  one every caller has to remember; it would drift between the preview and the recorder.
  Rejected.

## R3 — How the placement survives a change of picture size

**Decision**: Held in **fractions of the recorded region** — the centre as fractions of
the region's width and height, the diameter as a fraction of the region's **shorter
side** — exactly as `CropRegion` is held in fractions of the capture. In pixels the
placement is derived at draw time from the rectangle it is handed.

**Rationale**: The preview draws the bubble inside the region rectangle in preview
pixels; the recorder draws it on the compositor canvas at the recording's resolution.
These two rectangles differ in size but are the same shape, so one placement in fractions
puts the bubble in the same place in both — the whole point of the feature (FR-006,
FR-012). A window resize, or a tab recorded at a different resolution, keeps the bubble in
the same relative place, as the crop does.

**Alternatives considered**:
- **Pixels.** The preview's size and the recording's resolution differ, so pixel values
  would put the bubble in different places in the two. Rejected.
- **Diameter as a fraction of width (or of height).** A circle has one diameter; tying it
  to the shorter side is the rule the app already uses (`Math.min(width, height) * 0.28`)
  and keeps it inside the region on any shape. Rejected.

## R4 — The gesture that moves, and the gesture that crops

**Decision**: The preview's pointer routing asks the **bubble first**. A press that lands
on the circle (inside it, to move; on its rim, to resize) moves or resizes the bubble; a
press that lands anywhere else begins the crop, exactly as today. The two gestures are
read by the same three pointer handlers on the canvas (`pointerdown` / `pointermove` /
`pointerup`), which already live in `src/ui/recording/region.ts`; that module routes each
press to one gesture or the other.

**Rationale**: One press must do exactly one thing, and the crop and the bubble share the
same canvas. Routing in one place keeps the "bubble wins" rule explicit and testable, and
leaves the crop's behaviour untouched for every press that is not on the bubble (FR-009).

**Alternatives considered**:
- **A second `pointerdown` listener in `webcam.ts`, registered before the crop's, calling
  `stopImmediatePropagation()` when it hits.** A capture-phase listener does **not** run
  before a bubble-phase listener on the *same* element — at the target, listeners run in
  registration order — so this depends on the wiring order in `main.ts` and is fragile.
  Rejected.
- **Capture-phase `stopPropagation`.** Does not stop the sibling listener on the same
  node (`stopImmediatePropagation` would), and is a subtler contract than an explicit
  routing call. Rejected.

## R5 — Move versus resize, and the handle

**Decision**: A press in the **middle** of the circle moves it — the bubble keeps the point
the pointer took hold of, so it does not jump under the hand, and the placement is clamped
inside the region. A press on its **edge** — a little inside or a little outside the line a
person sees — resizes it: the drag's distance from the circle's (fixed) centre sets the new
diameter, and only the diameter changes, so the bubble is never stretched off-round. In the
live phase the rim carries a small handle so the resize is discoverable; the handle is not
drawn in the recording and not drawn outside the live phase.

**Why the edge needs a band on both sides of the line**: a person aims at the visible rim,
and a pointer lands a hair *inside* it as often as outside. Reading a press just inside the
line as the middle made a hand aiming at the rim move the bubble instead — the circle
shunted sideways as the press point became its new centre. So the rim is a band straddling
the edge (`RIM_IN` of the radius inside it, `RIM_OUT` of the shorter side outside it), and
only the inner disc moves.

**Rationale**: These are the gestures the spec fixes as assumptions. The rim is the natural
handle for a circle; growing the diameter from the centre keeps the shape a circle at every
step; keeping the grabbed point is what a drag is expected to do.

**Alternatives considered**:
- **A corner handle on the circle's bounding box.** Implies a box and a two-axis resize,
  which would stretch the circle. Rejected.
- **A pinch gesture.** No existing pinch handling on the preview, and desktop pointers
  would get nothing. Rejected.
- **Resize only from outside the circle.** The zone a hand must hit is then a thin band
  beyond the line, and a press on the line itself moves the bubble. Rejected — it is the
  bug this band fixes.
- **The press point as the new centre (no grab offset).** The circle jumps under the
  pointer by up to its own radius. Rejected.

## R6 — Bounds and containment

**Decision**: The diameter is bounded between `MIN_SIZE` (0.12) and `MAX_SIZE` (0.6) of
the region's shorter side, and the **whole circle is always kept inside the recorded
region**: moving or resizing past a limit stops at the limit; a press that would take any
part of the circle outside is clamped. The bounds are constants on `WebcamBubble`.

**Rationale**: FR-004 (wholly inside) and FR-005 (never vanishing, never swallowing the
picture). The default diameter (0.28) sits comfortably inside the range, so nothing
changes for a person who does not touch the bubble.

**Alternatives considered**:
- **No lower bound.** A bubble dragged to nothing is a lost bubble with no way back.
  Rejected.
- **No upper bound.** A bubble that covers the whole recording defeats the feature.
  Rejected.

## R7 — The default placement, and its lifetime

**Decision**: Until a placement is chosen in this sitting, the bubble is the **default**:
the bottom-right corner at the default diameter — the app's current drawing (centre a
margin of `0.7 × diameter` in from the corner, diameter `0.28 × min(width, height)`). The
first move or resize fixes a concrete placement. Both are forgotten at **New** and at a
**reload**: nothing is written to `localStorage` or IndexedDB.

**Rationale**: FR-001 and FR-008, and the feature description ("a reload is the bottom-right
corner again"). The default is aspect-dependent (the corner margin is a multiple of the
diameter, and the diameter is a fraction of the shorter side), so it is produced by
`WebcamBubble.default(width, height)` rather than held as a constant; "no placement yet"
is the view's `null`, in the same spirit as the webcam's `selectedId = null` meaning the
browser's default camera.

**Alternatives considered**:
- **A constant `DEFAULT`.** Cannot express both the corner *and* the diameter on a region
  of any shape without the region's size. Rejected.
- **Persisting the placement.** The spec puts it per sitting, and the app keeps no other
  recording preference. Rejected.

## R8 — Verification, and what it cannot reach

**Decision**: Three levels, matching the verification skill.
- The circle's rules are proved by a **unit test** in node beside `WebcamBubble.ts`.
- The drawing and the gesture are proved by one **committed check** folded into the
  existing bubble check in `e2e/checks/capture.spec.ts`: move the bubble, resize it,
  record a take, and read the recorded picture back; assert the crop still crops from a
  drag that is not on the bubble.
- The recorder's flow — a real screen share — remains the **user's**: no check can open
  the picker, and this gap is stated in the pull request.

**Rationale**: The verification skill's three-level table. Folding into the existing check
follows "one feature, one or two checks" — the preview bubble already has a check there,
and this change extends the same story.

**Alternatives considered**:
- **A new `bubble.spec.ts`.** A new file is a new *area*; the bubble already lives in the
  capture area. Rejected.

## R9 — Out of scope (stated, not implied)

- **Repositioning the bubble in a recorded take.** The bubble is drawn into the take's
  pixels at record time; moving it afterwards would need the webcam as a second track and
  compositing at review or export — a pipeline change this feature does not make.
- **The automation surface** (`ui/agent/`). Placing the bubble is not one of the app's
  operations the surface publishes, and this change does not add it.
- **The camera as the whole picture.** With the screen off the camera fills the frame and
  carries no bubble, so there is nothing to place.
