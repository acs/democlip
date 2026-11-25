# Phase 0 — Research

The decisions the plan rests on, each with what was chosen, why, and what else was
considered. Grounded in the code as it stands after the plugin seam
(`specs/003-annotation-plugins/`), the properties inspector
(`specs/004-annotation-properties/`), the watermark and the annotation lane.

## D1 — A duration is the annotation's own span, not a new field

**Decision**: an annotation's duration is `span.length × clip.total()`, and setting it is
`annotation.withSpan(Span.of(span.s, span.s + seconds / total))`. No new stored field is
added: `StoredAnnotation.s`/`e` already are the stretch, `stored()` already writes them and
`restore()` already reads them.

**Rationale**: the spec's FR-005 wants the duration to be a value the annotation *holds*;
the span is already exactly that value — the only change is that it is no longer frozen at
creation. Reusing it satisfies FR-004's "kept with the clip" and "survives a reload" for
free, keeps the clip store's small half unchanged, and means an annotation that is copied,
moved or resized carries its duration without any of those operations learning a new field.

**Alternatives considered**: a `duration` field beside the span — rejected, it duplicates
the span and gives two owners of where an annotation shows, the thing the aggregate exists
to prevent; a side table keyed by id — rejected for the same reason.

## D2 — The clamp is a rule on `Annotation`, with the default and the minimum in the domain

**Decision**: `Annotation.withDuration(seconds, total, min = MIN_ANNOTATION_S): Annotation | null`
is a concrete method on the base class. It keeps the start fraction, sets the end to
`min(1, s + seconds / total)`, and returns `null` when `total <= 0` or the result is shorter
than `min`. `DEFAULT_ANNOTATION_S = 2` and `MIN_ANNOTATION_S = 0.1` are exported constants
beside the class.

**Rationale**: "keep the start, stay inside the clip, not below the shortest worth keeping"
is a rule about an annotation, so Principle III puts it on the class with a test beside it.
It is concrete on the base because every kind shares it and each kind's `withSpan` already
knows how to return itself over a new stretch, so no kind has to be touched. Two seconds is
the ordinary callout length and matches the title card's own two seconds; a tenth of a
second is a few frames at 30 fps — long enough to be seen, short enough not to be refused.

**Alternatives considered**: the arithmetic in the inspector — rejected, it is a rule and
would drift from the export's answer; a `Span` method — rejected, the operation is about an
annotation (it keeps the annotation's start and its other fields), which a bare range does
not know; per-kind methods — rejected, it is the same rule three times.

## D3 — A new annotation starts at the selected stretch, or at the playhead with the default

**Decision**: the annotate-options module computes the span: `selection.section()` when the
user has a stretch selected (so the annotation spans that stretch), otherwise
`Span.of(f, f + DEFAULT_ANNOTATION_S / total)` from the playhead (`f = player.time() / total`),
clamped inside the clip. It then calls `canvas.add(kind, span)`, which already takes a span.

**Rationale**: this is the clarified answer (Q1). `canvas.add(kind, span)` and the
`CreationContext` already carry a span to every kind, so nothing in the canvas or the kinds
changes; only *where the span comes from* moves out of the timeline marks and into the new
module. The playhead is where the person is looking, and the default is the fallback the
answer names.

**Alternatives considered**: keeping the kinds on the section and only adding duration —
rejected, it is the crowding the spec exists to fix; making the annotate control require a
selection — rejected by the clarified answer; reading the playhead from the canvas — rejected,
the view module that draws the button is where the person's press happens.

## D4 — The annotate column is built from `plugins()` and lives on the picture

**Decision**: a new `ui/annotating/annotate-options.ts` renders `#annotate-bar` inside
`.preview-wrap`, directly below the clip's `#props-btn`, with one row per `plugins()` entry —
the kind's `action.icon` and `action.label`. It shows only in review with a clip
(`currentPhase() === 'review' && session.clip.total() > 0`), and re-renders on the clip's
`onChange` and on the phase. `marks.ts` stops drawing the kind buttons on the section,
keeping the scissors and the keep/undo.

**Rationale**: the plugin register is already "the kinds the section offers an action for";
pointing it at a column instead of a row needs no new seam, and FR-002's "grows downward,
crowds nothing" is then a CSS column rather than a per-kind layout. Removing the kind
buttons from the section keeps one place to add a kind, satisfying FR-015.

**Alternatives considered**: a per-kind button registered separately — rejected, two
registers for one fact; a horizontal bar elsewhere on the picture — rejected, it has the same
crowding problem as the section; a menu that opens from one button — rejected, it hides the
kinds behind a second press and the spec asks for the options to be visible below the pencil.

## D5 — The duration is a shared descriptor, added by `propertiesFor`, not declared by a kind

**Decision**: `PropertyControl` gains `'duration'`. A new `ui/annotating/duration-property.ts`
exports `durationProperty(clip): AnnotationProperty` — `value` reads the seconds, `with`
parses and calls `annotation.withDuration(...)`. A new `propertiesFor(annotation, clip)`
returns `[...propertiesOf(annotation), ...(watermark ? [] : [durationProperty(clip)])]`.
`propertiesOf(annotation)` is **unchanged**; the inspector, the canvas's "has properties?"
check and the agent's `setProperty` are moved to `propertiesFor`.

**Rationale**: the duration is one property every hand-placed kind has, so declaring it in
each plugin would be three copies of one rule (FR-016) and would put it on kinds that only
happen to be watermarks. A shared descriptor built by the view keeps the rule in one place,
and a **new** function — rather than a changed signature — keeps `propertiesOf`'s tests and
every kind test passing unmodified (Principle III). `propertiesFor` needs the clip because
the duration is seconds of the clip's length and because only the clip knows which
annotations are its watermark.

**Alternatives considered**: the duration in each plugin's `properties` — rejected, three
copies and the watermark would take it; adding it inside `propertiesOf` — rejected, it would
change a tested signature and needs the clip anyway; a whole separate "duration panel" —
rejected, the spec puts the duration beside the other properties in the one inspector.

## D6 — The duration control is a seconds value with steps, in the existing popover

**Decision**: the inspector renders a `'duration'` row as a read-out of seconds with a − and
a + button stepping by `DURATION_STEP_S = 0.1`, applying through the existing
`clip.changeAnnotation`. An unusable value is refused with a message, as the colour and words
rows already refuse one.

**Rationale**: this is the clarified answer (Q2) — a seconds value, not a strip against the
timeline. It reuses the popover's existing row and the clip's existing change path (FR-009's
one undo, FR-006's keeping), and it needs no new element on the picture. The step is the same
tenth of a second as the minimum, so the control can always reach the shortest value.

**Alternatives considered**: a mini-timeline strip — deferred; the answer was "seconds value
only", and the spec records the strip as a possible later refinement; a free-text field —
rejected, a stepper is fewer failure modes and the value needs no typing; dragging the
timeline band — deferred, the band is a view of the value and the answer made the value the
control.

## D7 — One layout helper draws every stretch; the lane draws the picked annotation's

**Decision**: `ui/clip/clip.ts` gains `stretchLayout(span, total?): { left: string; width: string }`
in kept time. `marks.ts` uses it for the cut section and the lane uses it for the picked
annotation's band. `annotation-lane.ts` draws the picked annotation's **whole stretch** as a
band on `#tl-annots`, marked as the active stretch; the other annotations keep their start
marks.

**Rationale**: the spec (FR-015, FR-020) wants more than one stretch, all in kept time. The
cut section and the annotation band are two stretches drawn by two layers that must agree on
where a fraction lands, so the arithmetic is factored into one helper rather than copied —
the same reason `fractionAtX` lives in `clip.ts`. The lane is where annotations already live
in time, so the picked one's band belongs there, beside the cut section rather than in place
of it.

**Alternatives considered**: drawing the band in `marks.ts` with the section — rejected, that
module owns cutting and holds no annotation; a third layer for stretches — rejected, one
helper and two existing layers suffice; showing every annotation's whole stretch at once —
rejected, overlapping bands would lie on top of each other, which is why the lane uses start
marks today.

## D8 — The watermark takes no duration

**Decision**: `propertiesFor` returns no duration descriptor for an annotation the clip
lists in `clip.watermarks()`. The watermark keeps spanning the whole clip.

**Rationale**: the spec's assumption — the watermark is the clip's branding, placed by a
clip property, not by hand, and it spans the whole clip by construction (`Clip.addTake`
keeps it at `Span.of(0, 1)`). A duration stepper on it would fight that rule and could shrink
the logo off the clip.

**Alternatives considered**: letting the watermark take a duration — rejected, it is the
thing the rule exists to keep whole; hiding its settings control entirely — already the
effect, since the duration is the only property it would offer.

## D9 — The agent's path keeps working, and gains the duration

**Decision**: the agent's `annotate` still takes a named `span` and the annotation it makes
spans that stretch (its duration is the stretch's length). `setProperty` reads
`propertiesFor(annotation, clip)`, so an agent may set `duration` on a placed annotation the
same way a person does. Nothing in `surface.ts`'s tool list changes.

**Rationale**: the spec's assumption — an agent naming a stretch keeps working — and the
agent's operations are the app's own (the Domain model skill). Reaching the duration through
the same descriptor keeps the agent's change a person's change: announced, undone, kept.

**Alternatives considered**: a new `set_duration` tool — rejected, the property seam already
carries it and a second name for one change is what the glossary warns against; leaving the
agent unable to set duration — rejected, it is the same descriptor and the seam is already
there.

## D10 — What is proved how

**Decision** (the Verification skill):
- the rules — `withDuration` (start kept, end clamped, too-short refused, zero-length clip
  refused), the constants, the duration descriptor's `value`/`with`, and `propertiesFor`
  (kind properties plus duration; the watermark none) — by **unit tests in node**;
- the annotate column, placing with and without a selected stretch, the seconds control
  changing the annotation in playback and in the export, the picked annotation's band on the
  timeline beside a cut section, and the one undo — by a **committed `e2e/` check**;
- the real reload with real IndexedDB — by the **user**, and stated as a gap.

**Rationale**: the skill's three levels. The throwaway `verify-*.html` harness is retired in
favour of a committed check, so the browser proof lives in `e2e/checks/`. The existing kind,
clip and inspector tests are the regression proof, which is why `propertiesOf` keeps its
signature and the duration is a new function rather than a changed one.

**Alternatives considered**: a unit test of the popover with a fake DOM — rejected, the skill
asserts what a person sees in a real browser and the project has no DOM test environment;
one check per behaviour — rejected, the skill folds a feature into one or two checks.
