# Feature Specification: Magnifier Annotation

**Feature Branch**: `focus-annotation`

**Created**: 2026-11-25

**Status**: Draft

**Input**: User description: "Add a new annotation in which you select (resizable) a circle region of the video which is zoomed to show the details (magnifying glass) and put the focus of the viewer over it during the duration of the annotation."

## Clarifications

### Session 2026-11-25

- Q: Where is the enlarged view shown — inside the selected circle itself, or in a separate lens placed elsewhere on the picture? → A: **In the circle itself.** The dragged circle becomes the lens in place: it shows its own central region enlarged, and the rest of the picture keeps its normal scale.
- Q: Besides the enlarged detail, should the rest of the picture be dimmed to put the viewer's focus on the region? → A: **Dim the rest.** While the magnifier shows, everything outside the circle darkens, easing in and out with the annotation's dissolve; the dim is one level the app chooses in this version.
- Q: Is the zoom level adjustable per annotation, and what is its default? → A: **Adjustable, default 2×.** Each magnifier starts at 2× and its zoom is changed in its own preferences, like its colour and duration.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A magnifier over a detail (Priority: P1)

A person is reviewing a finished clip. A moment turns on a detail too small to read — a
tiny button, a line of code, a far-away switch. They select the stretch where it matters,
choose **Magnifier** from the annotate options, and drag a circle over the detail. For that
stretch the circle shows that part of the video enlarged and the rest of the picture dims, so
the viewer's eye goes to the detail the person is talking about instead of squinting at it;
outside the stretch the picture is exactly as it was. The file they export carries the same
enlarged detail, and the same focus, at the same moment.

**Why this priority**: This is the feature. Selecting a region and having it enlarged, with
the rest dimmed, for a stretch — in the review and in every output — is the smallest thing
worth shipping, and it is what every later refinement — moving it, resizing it, changing the
zoom — stands on.

**Independent Test**: With a finished clip in review, select a stretch, add a **Magnifier**,
drag a circle over a detail, then play the clip and export it — the detail is enlarged inside
the circle, the rest of the picture is dimmed, and both are confined to that stretch, in both
the review and the file.

**Acceptance Scenarios**:

1. **Given** a clip in review, **When** the person selects a stretch, chooses **Magnifier**
   and drags a circle over a region of the picture, **Then** that region is shown enlarged
   inside that circle for that stretch.
2. **Given** a clip with a magnifier, **When** the magnifier is shown, **Then** the rest of
   the picture is dimmed for the whole stretch, easing in and out with the annotation.
3. **Given** a clip with a magnifier, **When** the playhead moves outside its stretch,
   **Then** the picture is exactly as it would be without the magnifier.
4. **Given** a clip with a magnifier, **When** the clip is exported (a downloaded file or a
   published post), **Then** the same region is enlarged at the same moment, in the same
   place, by the same amount, with the same dim, as in the review.
5. **Given** a clip with a magnifier, **When** the person drags its resize handle, **Then**
   the circle grows or shrinks and the region stays enlarged by the same zoom level.
6. **Given** a magnifier being placed or resized near an edge, **When** it would cross the
   edge of the picture, **Then** the whole circle is kept inside the picture and stays round.
7. **Given** a clip with a magnifier, **When** the page is reloaded or the trip to publish
   sign-in is taken, **Then** the magnifier comes back in the same place, size and zoom.

---

### User Story 2 - Make the magnifier say the right thing (Priority: P2)

The circle was drawn slightly off the detail, or the zoom is too weak or too strong, or it
should stay up longer so the viewer has time to read it, or it is in the wrong colour for the
picture behind it. The person picks the magnifier and fixes each of those: moves it, resizes
it, changes its zoom, changes its duration, chooses another rim colour. They can also copy it
to another moment, delete it, and take any of it back with the one undo — the same gestures
every other kind already has.

**Why this priority**: A magnifier that cannot be corrected is a mistake that cannot be
undone. It is below the first story because one correct placement already delivers the value,
and above the third because the circle and the zoom are what the person came for.

**Independent Test**: Add a magnifier, pick it, and in turn move it, resize it, change its
zoom, change its duration and change its rim colour — each is shown in the review and in the
export at once — then copy it, delete it and undo, and reload the page to find every value
kept.

**Acceptance Scenarios**:

1. **Given** a clip with a picked magnifier, **When** the person drags it, **Then** it moves
   whole, showing the same region enlarged at the new place, and stays wholly inside the
   picture.
2. **Given** a clip with a picked magnifier, **When** the person changes its zoom level in
   its preferences, **Then** the region is enlarged by the new amount in the review and in
   every output, and the circle itself keeps its place and size.
3. **Given** a clip with a picked magnifier, **When** the person changes its duration in its
   preferences, **Then** it is shown for the new length and no longer.
4. **Given** a clip with a picked magnifier, **When** the person chooses another colour for
   its rim, **Then** the rim is that colour in the review and in every output.
5. **Given** a clip with a magnifier, **When** the person copies it and pastes, **Then** a new
   magnifier of the same region, size and zoom appears at the playhead, editable on its own
   without touching the first.
6. **Given** a clip with a magnifier, **When** the person deletes it, **Then** it is no longer
   shown, and the one undo brings it back.
7. **Given** any change to a magnifier, **When** the person presses the one undo, **Then**
   the previous value or place is back in one action.
8. **Given** a clip whose magnifier was changed, **When** the page is reloaded, **Then** every
   change comes back.

---

### User Story 3 - A kind among the kinds, and it fits the whole clip (Priority: P3)

The magnifier is not a special case bolted beside the annotations: it is a kind of
annotation, added in the one place the kinds are added, found on the timeline lane, kept
with the clip, cut and exported with everything else — and adding it changes nothing about
the arrow, the image, the text, the sound or a cut. It also behaves on any picture shape: the
circle stays round, and on a clip with no picture it is simply not offered.

**Why this priority**: It delivers no new user-visible value on its own, but it is what
makes the magnifier safe to add: the family keeps its promises, and the feature is not a
private drawing mode that surprises the next kind or the next change.

**Independent Test**: Confirm every arrow, image, text, sound and cut behaves exactly as
before with the magnifier kind present; place a magnifier on a non-16:9 clip and confirm the
circle is round; cut through a magnifier's stretch and confirm only the kept part shows; add
a magnifier through the automation surface.

**Acceptance Scenarios**:

1. **Given** the magnifier kind in place, **When** any arrow, image, text, sound or cut is
   used, **Then** its behaviour and its outcome are unchanged.
2. **Given** a clip whose picture is not 16:9, **When** a magnifier is placed, **Then** the
   lens is a circle on the screen, not an ellipse.
3. **Given** a cut through part of a magnifier's stretch, **When** the clip is played or
   exported, **Then** the magnifier is shown only over the kept part, and putting the cut
   back brings the rest back.
4. **Given** a clip written down by a later version that carries a magnifier shape this build
   does not know, **When** the clip is opened, **Then** that annotation is left out and the
   rest of the clip opens and plays.
5. **Given** a **sound-only** clip, **When** the annotate options are opened, **Then**
   **Magnifier** is not offered and **Sound** still is.
6. **Given** an agent driving the app's **automation surface**, **When** it places, reads,
   changes, deletes and undoes a magnifier, **Then** it can do so as it can for the clip's
   other annotations.
7. **Given** a clip with any number of magnifiers, **When** it is exported, **Then** the
   recording is not re-encoded.

---

### Edge Cases

- **A stray click, not a drag**: nothing is added, the person is told to drag a circle, and
  the kind stays ready for the next try rather than making a guess.
- **A circle drawn too small to be a lens**: the magnifier is refused and the person is told
  the smallest size, rather than a speck that cannot be picked or read.
- **A circle dragged or resized past the edge of the picture**: it is pulled inside, like an
  image's rect today, so the whole lens is shown and nothing is lost; it never becomes an
  ellipse to fit.
- **A zoom set beyond what the app allows**: the change is refused, the magnifier keeps its
  previous zoom, and the person is told the range.
- **A region that includes the picture's own background** (a take that does not fill the clip
  size): the lens enlarges the clip's picture exactly as it is, background included; it never
  invents content and never stretches the take to fill the lens.
- **The detail moves under a static lens**: the lens is a window, so the enlarged content
  follows the picture from moment to moment; it does not freeze the frame.
- **A detail at the edge of the circle**: the lens enlarges its centre — at 2× the middle half
  — to fill the circle, as a magnifying glass does, so the rim shows the edge of the enlarged
  view; the person centres the circle on the detail rather than relying on the rim.
- **Another annotation lies under or over the lens**: the magnifier enlarges and dims the
  clip's picture, not the app's other annotations; they keep their own size, place and
  brightness, so they stay readable, and they are drawn in the family's stable order.
- **The dim at the edges of the stretch**: it eases in and out with the annotation's own
  dissolve, so the picture never flashes dark and back in a single frame.
- **The dim's strength**: it is one level the app chooses; the person cannot make it lighter
  or heavier in this version, and it is the same in the review and in every output.
- **A still frame and a playing clip**: the lens and the dim are the same whether the clip is
  playing or paused, and follow the picture from moment to moment.
- **Two magnifiers overlap in time and on the picture**: each is drawn and picked on its own,
  in a stable order that does not flicker.
- **A cut removes part of a magnifier's stretch**: the magnifier is shown only over the kept
  part; a cut that removes the whole stretch leaves it with nowhere to show, and putting the
  cut back brings it back.
- **The clip grows** with a new take after a magnifier was placed: it stays over the same
  moments it was placed on, and does not stretch.
- **The clip's picture grows** (a larger take arrives): the circle keeps its fraction of the
  picture and stays round; the region it shows grows with the picture.
- **A magnifier is added with no stretch selected**: it takes the default stretch at the
  playhead, exactly as a new annotation of any other kind does, and its duration can then be
  changed.
- **No clip, or the app is not in review**: the magnifier cannot be added, and the person is
  told to open a clip in review and select a stretch.
- **A paste at the very end of the clip**: the copy's stretch is pulled back inside the clip,
  as for any annotation, rather than left hanging past the end.
- **A very large zoom on a large picture**: playback does not stall; the lens is drawn every
  frame like any annotation, and the app does not freeze while it is shown.
- **A magnifier in a file for editing** (the export that carries its annotations beside it
  rather than drawing them in): the magnifier is carried beside the file and read back in
  place, the way the other kinds are.
- **A magnifier's rim over a light or dark picture**: the rim keeps the family's thin dark
  edge, so the circle is visible at every colour in the palette.
- **A magnifier unselected / selected**: it is picked and let go like any other kind, with
  the same handles and the same settings control.
- **A magnifier and the clip's watermark**: the two coexist; neither is a special case inside
  the other, and the watermark follows the clip's own properties as before.
- **A magnifier changed while the clip plays, or while paused on a still frame**: both work,
  and the change shows from that moment on.
- **The magnifier's stretch is shorter than the family's minimum duration**: the duration
  change is refused and the magnifier keeps its stretch, as for any annotation.

## Requirements *(mandatory)*

### Functional Requirements

**The magnifier kind**

- **FR-001**: The app MUST offer a new kind of annotation — a **magnifier** — in the
  **annotate options** beside the drawn kinds, added the same way as every other annotation:
  over the selected stretch, or the default stretch at the playhead when none is selected.
- **FR-002**: Users MUST be able to add a magnifier by selecting a circular region of the
  picture with a drag, and MUST be told how when a stray click adds nothing.
- **FR-003**: A magnifier MUST be shown only during its own stretch, and MUST be invisible
  outside it.
- **FR-004**: During its stretch, the region MUST be shown enlarged **inside the selected
  circle itself**: the circle is the lens, showing its own central part magnified, while the
  picture outside it keeps its normal scale.
- **FR-005**: The lens MUST be a true circle on the screen, never an ellipse, whatever the
  shape of the clip's picture.
- **FR-006**: While a magnifier is shown, the app MUST dim the clip's picture outside the
  circle by one level the app chooses, so the lens is the viewer's focus; the dim MUST ease
  onto and off the picture with the annotation's own dissolve, and MUST NOT be adjustable in
  this version.
- **FR-007**: The zoom level MUST be adjustable for each magnifier in its **preferences**,
  starting at **2×** for a new one, and MUST accept only values inside the range the app
  allows, refusing one outside it with a message and leaving the magnifier unchanged.
- **FR-008**: The circle MUST have a visible rim in the clip's **annotation colour** (unless
  the person chooses another), with a thin dark edge so it reads over both light and dark
  pictures, as the family's marks do.
- **FR-009**: Users MUST be able to move a magnifier whole and resize it by its handle, using
  the family's shared gestures; resizing changes the region and keeps the zoom level.
- **FR-010**: A magnifier MUST stay wholly inside the picture: a drag or resize that would
  take it past the edge is pulled inside rather than lost.
- **FR-011**: A magnifier MUST be picked by pressing inside its circle, and MUST show the
  family's picked state — the same handles, controls and settings control as any kind.

**Seeing it and writing it**

- **FR-012**: What the person sees in the review and what every exported output carries MUST
  be the same enlarged region, at the same moment, in the same place, at the same size and by
  the same zoom, with the same dim — the review MUST NOT show a different picture from the
  one written.
- **FR-013**: A magnifier MUST be included in every output the other drawn kinds are — the
  WebM download, the MP4 for Bluesky, the YouTube upload, a published post, and the export
  that carries its annotations beside the file rather than drawing them in — at the same
  moment as in the review.
- **FR-014**: A magnifier MUST NEVER change the recording: placing one never re-encodes a
  take, and with every annotation removed the clip's picture is exactly as recorded.
- **FR-015**: The enlarged view MUST be taken from the clip's picture at that moment, and from
  inside the frame; where the picture's own background (a take that does not fill the clip
  size) is what lies there, the lens shows that background rather than inventing content or
  stretching the take.
- **FR-016**: A magnifier MUST enlarge the clip's picture alone; other annotations MUST NOT be
  magnified inside it, and MUST keep their own size and place.
- **FR-017**: The dim MUST darken the clip's picture alone. The app's own annotations MUST keep
  their brightness and place — so a text or an arrow stays readable while the picture around
  the lens darkens — and MUST NOT be dimmed away.
- **FR-018**: A magnifier and its dim MUST follow the family's dissolve onto and off the
  picture at the edges of its stretch, so neither pops in or out.

**Fitting the family**

- **FR-019**: A magnifier MUST be kept with the clip, informed to every surface the other
  kinds inform, and MUST survive a reload and a return from the publishing sign-in.
- **FR-020**: A kind this version does not know MUST be left out when a clip is opened, rather
  than failing the open — a magnifier written by a later build included.
- **FR-021**: A cut MUST take its part of a magnifier's stretch with it, exactly as it takes
  any annotation's: the magnifier is shown only over the kept stretches, and putting the cut
  back brings the rest back.
- **FR-022**: A magnifier MUST share the family's editing: it can be picked, moved, resized,
  copied and pasted as a new one, deleted, and undone with the one undo that covers a cut and
  every other kind.
- **FR-023**: Adding the magnifier kind MUST NOT change how any existing kind of annotation
  behaves, and MUST NOT change how a cut behaves.
- **FR-024**: A **sound-only** clip MUST NOT offer the magnifier, because it has no picture to
  draw on; the sound kind stays offered there.
- **FR-025**: The fields of an annotation the app's **automation surface** can read and write
  MUST extend to a magnifier, so an agent can place one, read its region, zoom and length,
  change them, delete it and undo, exactly as for the clip's other annotations.
- **FR-026**: A magnifier's **preferences** MUST offer the values that are its own — its zoom
  level, its rim colour and its duration — through the one shared **properties inspector**,
  with no surface of its own.

**Where it is offered, and how it behaves at speed**

- **FR-027**: The magnifier MUST be offered wherever the drawn kinds are offered — a clip in
  review with a picture — and MUST NOT be offered with no clip, outside review, or on a
  **sound-only** clip.
- **FR-028**: A magnifier MUST be drawn with no visible stall to playback: showing one MUST
  NOT take the clip out of smooth playback at the sizes the app records at, and MUST NOT need
  the clip to pause, buffer or re-encode.
- **FR-029**: The new words — **magnifier**, **lens**, **magnified region**, **zoom level**,
  **rim** and **spotlight dim** — MUST be written into `docs/GLOSSARY.md` before they appear
  in code, as the project's rule requires.

### Key Entities *(include if feature involves data)*

- **Magnifier annotation**: a kind of annotation that enlarges part of the picture for its
  stretch. It has an identity, the **span** it is shown over, the circular **region** it
  magnifies (a centre and a radius, held in fractions of the picture), a **zoom level**, and a
  rim colour.
- **Magnified region**: the part of the clip's picture the magnifier enlarges — a circle given
  by its centre and radius, kept in fractions of the picture so it lands in the same place in
  the review, in the export and after a reload.
- **Lens**: the circular window drawn over the picture that shows the magnified region. It is
  round on the screen, wholly inside the picture, and has a **rim**.
- **Spotlight dim**: the darkening of the clip's picture outside the lens while a magnifier
  shows. It is one level the app chooses, eases in and out with the annotation's dissolve, and
  never touches the app's other marks.
- **Zoom level**: how much larger the region appears than it does on the picture; a value the
  magnifier holds and the person changes in its preferences.
- **Rim**: the ring that marks the lens, drawn in the clip's annotation colour — or the colour
  the person chose for this magnifier — with a thin dark edge.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person can add a magnifier over a detail in under 15 seconds from selecting a
  stretch, and at the default zoom the detail appears at least twice as large as on the
  picture.
- **SC-002**: In 100% of outputs (the downloaded file, the published post and the file for
  editing), the enlarged region appears at the same moment, place, size and zoom, with the
  same dim, as in the review.
- **SC-003**: Adding the magnifier kind changes the outcome of no existing annotation or cut
  behaviour — every existing check still passes, and the magnifier itself is carried,
  edited, undone and exported by the shared behaviour alone.
- **SC-004**: A magnifier's region, zoom, rim colour and stretch survive a reload and the
  return from the publishing sign-in, 100% of the time.
- **SC-005**: Playback with a magnifier on screen stays within one frame per second of playback
  without one, at every clip size the app records at.
- **SC-006**: The lens remains a circle wholly inside the picture in 100% of placements, sizes
  and clip shapes.
- **SC-007**: The one undo returns a magnifier's previous place, size, zoom, colour or stretch
  in a single action, 100% of the time.
- **SC-008**: A magnifier changes the recording in no way: the recording bytes are identical
  with and without one, and with the magnifier absent or outside its stretch the picture is
  exactly as recorded.
- **SC-009**: While a magnifier shows, the picture outside the circle is measurably darker than
  the same frame without it, for the whole stretch, and returns to its normal brightness with
  the dissolve; the app's own annotations keep their brightness throughout.

## Assumptions

- **The lens is in place.** As chosen, the circle itself is the lens: it shows its own central
  region enlarged, and no second lens is placed elsewhere. The picture outside the circle
  keeps its normal scale, apart from the dim.
- **The lens shows its own centre.** A lens of radius R at zoom z fills itself with the region
  of radius R ÷ z around its centre, drawn enlarged — the classic magnifying glass — so the
  rim marks the edge of the enlarged view and a detail is put in the middle of the circle.
- **The dim is a fixed spotlight.** As chosen, the picture outside the circle darkens by one
  level the app chooses, for the whole stretch, easing in and out with the annotation. Its
  strength is not the person's to change in this version, and it is not a blur or a soft
  vignette.
- **The zoom is adjustable, with 2× as its default.** A magnifier starts at **2×**; the
  smallest useful enlargement is about 1.5× and the largest about 8×, and values outside that
  are refused with a message rather than silently clamped.
- **The dim belongs to the magnifier.** It is not a separate annotation: it has no identity of
  its own, is never picked or edited by itself, and moves, resizes, copies and deletes with
  the magnifier that carries it. It is on screen only while that magnifier is.
- **It is a drawn kind, not a sound-like one.** A magnifier needs a picture, so it is offered
  only where a picture can be drawn on; a sound-only clip keeps its sound kind and gains
  nothing here.
- **The lens is a window on the clip's picture only.** Other annotations are not enlarged and
  are not dimmed; they are drawn at their own size, place and brightness, in the family's
  stable order.
- **The rim is the family's.** It starts in the clip's **annotation colour** and can be
  changed on that one magnifier with the existing colour control; it is not a new kind of
  appearance setting.
- **The region and zoom are numbers, not pictures.** A magnifier is written down as small
  values with the clip, like a cut or an arrow, so it moves with the clip and never carries
  bytes; it writes nothing beside the recording.
- **The existing timeline and duration rules apply.** A magnifier is found on the
  **annotation lane** by the mark at the start of its stretch, its **annotation duration** is
  the family's, and a new take lengthens the clip without stretching the magnifier.
- **A later build may extend the kind; this one leaves unknown ones out.** An older build
  opening a clip with a magnifier it does not know drops that annotation and opens the rest,
  as it already does for any unknown kind.
- **Out of scope for this version**: a separate lens placed elsewhere on the picture, a lens
  that follows the mouse or the subject, an adjustable dim strength, a blurred or vignetted
  surround, an animated zoom or pan within a stretch, a non-circular lens (square, freehand),
  magnifying sound, and changing the recording itself. The zoom is constant for the whole of a
  magnifier's stretch.