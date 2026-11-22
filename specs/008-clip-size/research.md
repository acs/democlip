# Research: Clip Size

Phase 0 decisions. Each one is the rule the spec asked for, placed where it belongs.

## The size is a value object, both edges even

**Decision**: a **`ClipSize`** class in `src/domain/clip/`, holding a width and a
height, both even, at least 2×2. `of(width, height)` rounds an odd edge **up** to the
next even size. `largest(pictures)` gives the largest width and largest height among a
list and rolls both up to even.

**Why**: an odd edge is refused by H.264 (`avc1.*`), so making the clip size even once,
at the top, is what lets **every** target write exactly the clip size — and it lets the
plan drop the "one pixel down" adjustment from the promise the app makes (FR-017,
SC-010). Rounding **up** rather than down means no take is ever scaled below its own
picture, which is the point of growing to the largest (SC-008).

**Alternatives considered**: keep the clip size odd and let the encoder's
`evenPicture` take it down (what the code does today) — rejected: then the WebM file
keeps the odd size and the MP4 file loses a pixel, so "the final exporting size, the
clip size" would be false for one of the two. A minimum edge of 2 matches the
compositor's own floor.

## The size grows to the largest take, and is not the person's to set

**Decision**: `Clip.size()` returns **the largest take picture rounded up to even**, or
null when no take has a measured picture. Nothing else: the size is **derived**, never a
field, and never the person's to set. The panel draws it and offers no control, and the
automation surface refuses to change it.

**Why**: the size is the shape every take must fit into, so a size smaller than a take
would throw picture away and a size of another shape would letterbox every take — the
person could hold the clip to a shape its own takes do not have. Deriving it from the
takes alone is the only answer that cannot be wrong (FR-002, FR-006, FR-009, FR-016).
And the clip still knows the size to show without keeping anything: it asks its takes.

**Alternatives considered**: store the person's size as a `size` clip property and keep
it once set (the first design) — rejected: it let the person break the clip, which is
what this change removes. A separate `sizeLocked` flag — rejected: more state for a
behaviour the app no longer wants. A field on the `Clip` — rejected: it would duplicate
the properties seam for a value the takes already give.

## Each take carries the size of its own picture

**Decision**: `Take` gains a **picture**: its width and height. The size is measured
where the take arrives — `TakeProbeAdapter.measure` reads the video's
`videoWidth`/`videoHeight` for a recorded blob, and the file inspector reads the video
track's display size for an imported one — and is passed to
`clip.addTake(blob, duration, picture)`. A stored take keeps its picture size with its
blob.

**Why**: the clip's derived size is the largest among the takes, so the clip has to
know each take's picture. Measuring at arrival is the one moment the blob is already in
hand, and both adapters already load it (the probe for the duration, the inspector for
the length and the sound). The e2e fixture already knows the shape it encoded, so a
seeded clip passes the same picture a recording would.

**Alternatives considered**: derive the size only when the review opens, from the
element holding the first take — rejected: a later take's size would never be known, so
the size could not grow to the largest. Probe the blob inside the domain — rejected:
`domain/` may not touch the browser. A global "current recording size" on `state.ts` —
rejected: it would be a second owner of a fact the take already owns.

## The size is shown as a read-only clip property; a take of another shape is fitted

**Decision**: the size is registered in the app's clip-property register
(`ui/clip/clip-properties.ts`) under id **`size`**, marked **read-only** — the panel
draws its value and offers no control, and the surface refuses to set it.
`ClipSize.frameFor(picture)` gives the rectangle a take is drawn into: the picture
scaled to **fit** inside the clip size (whichever edge runs out first), centred, with
the clip's background around it. The review's `drawFrame`/`drawClipFrame`/`dissolve`
and the export's encoder all draw through that rectangle.

**Why**: showing the size in the one panel that says what a clip is keeps a person
informed without handing them a control they could break the clip with; the read-only
flag is the whole of the rule, and the panel and the surface both read it. The fit rule
is a rule about the size, so it lives in the `ClipSize` class and every place that
draws asks it, rather than each re-implementing "scale and centre" — the drift the
domain skill warns about.

**Alternatives considered**: leave the size out of the panel and the surface entirely —
rejected by the clarification: the size is useful to see. Letterbox with the review's
CSS rather than the canvas — rejected: the export would then need its own copy of the
rule and could disagree. Draw the take stretched to fill — rejected: the spec asks for
the whole picture without distortion. Crop to fill — rejected by the clarification (fit
whole).

## The clip's background

**Decision**: the letterbox around a take is the app's picture background, which is
already `#000` (the preview canvas) — the review fills the canvas with it before
drawing, and the encoder fills its canvas with it before each frame.

**Why**: there is one background the app already shows the picture on, and the spec
says "the clip's background", not a new setting. Using the same value in the review and
the export is what keeps the file looking like the preview.

**Alternatives considered**: a background chosen as a clip property — out of scope; the
spec asks for a size, not a theme. Leaving the area transparent in the export — a
WebM's transparent pixels become black by accident and the review shows the previous
frame, so a fill is the honest version of what already happens.
