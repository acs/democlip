# Feature Specification: Annotation Duration, Placement and Stretch

**Feature Branch**: `010-annotation-duration`

**Created**: 2026-11-25

**Status**: Draft

**Input**: User description: "Adding annotate icons to the selected region on the timeline does not scale. Let's try to add the annotate options just below the edit clip icon, in vertical. And the annotation duration is defined as a value for the annotation that is defined in its preferences. We need to find the best approach for defining the duration of the annotation. Ideally we should do it based on the timeline (maybe including a microtimeline in the annotate preferences dialog just showing some seconds after the addition of the annotation)."

## Clarifications

### Session 2026-11-25

- Q: Where does a new annotation's initial duration come from, and is a selected stretch still required before annotating? → A: A selected stretch, when there is one, gives the new annotation both where it starts and how long it lasts — it spans the selected stretch; with nothing selected, it starts at the playhead with a default length. Annotating is offered in both cases, and the duration stays editable afterward. (Amended 2026-11-25: the selected stretch sets the duration and not only the start — the annotation spans the stretch.)
- Q: How is an annotation's duration set in its preferences? → A: As a seconds value — a numeric field with step controls and the one undo. No time strip against the timeline in this version.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Annotate from a control that does not crowd (Priority: P1)

A person reviewing a clip wants to point at something with an arrow. The annotate options live in one place on the picture — a vertical column of rows just below the clip's own settings control — instead of sitting on the selected stretch of the timeline. They press the arrow, make it over the picture, and it appears over the moment they are on — or, when they have a stretch selected, over exactly that stretch. As later versions add an image, a text, a highlight, each is one more row that stays reachable, and no row is crowded out by the ones already there.

**Why this priority**: The selected-stretch row on the timeline does not scale — every new kind widens it until the controls overlap and the section itself is unreadable. Moving the kinds to a control that grows downward is what makes the annotation family able to keep growing, and it is the change the person sees first.

**Independent Test**: With a finished clip in review, add an arrow from the new vertical control, and confirm it can be made and seen in playback and in the export; then confirm the timeline section is clear of kind buttons.

**Acceptance Scenarios**:

1. **Given** a clip in review, **When** the person looks at the picture, **Then** the annotation kinds are offered as a vertical column of controls below the clip's settings control, one row per kind, none overlapping.
2. **Given** the annotate column, **When** a kind is pressed and the person makes the annotation over the picture, **Then** the annotation is placed and shown over the picture.
3. **Given** a clip with an annotation, **When** a new kind is added in a later version, **Then** it appears as one more row in the column and no existing row moves off screen or overlaps another.

---

### User Story 2 - Say how long an annotation lasts (Priority: P1)

A person has placed an arrow and, watching it back, wants it on screen for a shorter or longer moment than it first got. They pick the arrow and open its preferences, which show the annotation's duration as a seconds value with controls to make it longer or shorter a step at a time. They set the new length and the arrow is shown for exactly that long in playback and in the file they export. One undo takes the change back.

**Why this priority**: The stretch an annotation is shown over is half of what an annotation is, and today it can only be chosen *before* the annotation exists (from a timeline selection) and never changed after. Making duration a value the person can set on the annotation is what makes an annotation fully editable, and it is what lets the annotation be placed without first framing a stretch.

**Independent Test**: Place an annotation, pick it, open its preferences, change its duration, and confirm the annotation is shown for the new length in playback and in the export, is kept across a reload, and is returned by the one undo.

**Acceptance Scenarios**:

1. **Given** a picked annotation, **When** its preferences are opened, **Then** its duration is shown as a seconds value with controls that make it longer and shorter.
2. **Given** an annotation and its duration control, **When** the person sets a new length, **Then** the annotation is shown for the new length in the picture, in playback and in the export.
3. **Given** a changed duration, **When** the person presses the one undo, **Then** the previous duration is back in a single action.
4. **Given** an annotation with a duration, **When** the page is reloaded, **Then** the annotation comes back shown for that same length.

---

### User Story 3 - See the stretch of the annotation being edited (Priority: P2)

A person picks an arrow to change how long it lasts, and the timeline marks out the stretch it covers — the same way a cut's section is marked — so they can see the moments it will run over, not only a number. If a cut section is selected at the same time, both stretches are shown; the arrow's is the active one, because that is the one being edited. Letting the arrow go takes its stretch off the timeline and leaves the cut's where it was.

**Why this priority**: A duration on its own is a number; seeing it as a stretch of the clip is what tells the person which moments they are changing, and it is what makes the picked annotation the thing the timeline is about. It is below the two stories it serves — placing and duration — because the value can be set without it.

**Independent Test**: Pick an annotation and confirm its stretch is drawn on the timeline as the active stretch; select a cut section too and confirm both are shown and the annotation's is active; let the annotation go and confirm only the cut's remains.

**Acceptance Scenarios**:

1. **Given** a clip with an annotation, **When** the person picks it, **Then** the stretch it covers is shown on the timeline and is the active stretch.
2. **Given** a picked annotation and a selected cut section, **When** both are set, **Then** both stretches are shown at once and the picked annotation's is the active one.
3. **Given** a picked annotation, **When** the person changes its duration, **Then** the stretch shown on the timeline follows the change.
4. **Given** a picked annotation, **When** the person lets it go or picks another, **Then** its stretch leaves the timeline and the other annotation's becomes active.

---

### User Story 4 - The next kind fits the same control (Priority: P3)

Someone adds a kind of annotation later. It is offered as one more row in the vertical annotate column, and its duration is set by the same control as every other kind, with no change to the control or to the kinds already there.

**Why this priority**: It is the promise that keeps the annotate control from being reworked for every kind, and the duration from being re-implemented per kind. It delivers no user-visible value on its own, so it is last.

**Independent Test**: Add a kind of annotation and confirm it appears as one more row in the column, its duration is set by the same control, and every existing kind and cut behaves exactly as before.

**Acceptance Scenarios**:

1. **Given** the annotate column and the duration control, **When** a kind is added, **Then** it takes a row and its duration is set by the same control without edits to either.
2. **Given** a new kind, **When** it is used, **Then** no existing annotation or cut changes outcome, and its duration is set the same way as any other kind's.

---

### Edge Cases

- The clip is shorter than a chosen duration — the annotation is shown only for the part of its duration that falls inside the clip; it never runs past the clip's end.
- A duration at or below zero is refused, the annotation is left as it was, and the person is told why.
- The clip is paused on a still frame, or playing, when the duration is changed — both work, and the annotation is shown for the new length from that moment on, without re-encoding the recording.
- A cut removes part of the annotation's duration — the annotation is shown only over the part that survives on the timeline, exactly as a cut takes its part of the picture.
- A cut removes the whole of an annotation's duration — nothing is drawn, and the annotation is not lost; putting the cut back brings it back.
- A duration is changed and then undone after a new take was recorded.
- The annotation is copied and pasted — the copy keeps the same duration, and a paste near the end of a longer clip keeps its whole duration inside the clip rather than running past the end.
- The clip grows because a new take was recorded — an annotation keeps the moment it was placed on and its length in seconds, so it does not stretch to fill a longer clip.
- The watermark the clip wears (its logo and title) spans the whole clip — it is not a hand-placed annotation, and it is not made to follow a duration.
- A kind is pressed with a stretch selected on the timeline — the new annotation spans that stretch: it starts at the stretch's start and lasts its length.
- A kind is pressed with nothing selected — the new annotation starts at the moment the playhead holds with the default duration, and its duration can be changed afterward like any other.
- An annotation is picked while a cut section is selected — its stretch is shown beside the cut section, and it is the active stretch.
- A cut removes part of the picked annotation's stretch — the stretch shown closes up over the cut, so it never lies over moments that are gone.
- The clip grows while an annotation is picked — the stretch shown keeps its length in seconds and stays over the moments it was placed on.
- The picked annotation's duration is changed at the end of the clip — the stretch shown stays inside the clip, and any part beyond the end is not drawn.
- The person picks a different annotation while one is picked — the first stretch leaves the timeline and the new annotation's becomes the active one; no cut section's stretch is disturbed.
- The page is reloaded with an annotation picked — the clip comes back, and the picked annotation's stretch is shown again when it is picked.
- The annotate control is not offered while a take records, with no clip, or outside review.
- A clip with a very short duration and many annotations — each is shown on its own, and none is dropped.
- An agent places an annotation over a stretch it names: the duration of what it placed is the length of that stretch, and it can be changed afterward like any other.

## Requirements *(mandatory)*

### Functional Requirements

**Where the annotate options are offered**

- **FR-001**: The annotation kinds MUST be offered in one place on the picture — a vertical column of controls just below the clip's own settings control — rather than on the selected stretch of the timeline.
- **FR-002**: The column MUST grow downward, one row per kind, so that adding a kind never crowds, overlaps or hides an existing row.
- **FR-003**: The column MUST be offered only when an annotation could be made — during review of a clip that holds at least one take — and MUST state plainly, in place, when nothing can be annotated yet.
- **FR-004**: Pressing a kind MUST begin making that kind, and the annotation MUST first exist once the person has made it over the picture.

**Placing and duration**

- **FR-005**: A new annotation MUST be shown for a **duration** that is a value of that annotation — its start and its starting length may come from a selected stretch, but both are held by the annotation rather than read from the selection and frozen.
- **FR-006**: The duration MUST be kept with the annotation, written down with it, and MUST survive a reload and the return from a publishing sign-in.
- **FR-007**: A new annotation MUST span the selected stretch when one is selected — it starts at the stretch's start and lasts the stretch's length; with nothing selected it MUST start at the playhead with the default duration. A selected stretch MUST NOT be required before annotating, and the duration MUST be changeable after the annotation is placed.
- **FR-008**: Changing a duration MUST change how long the annotation is shown in the picture, in playback and in every output — the downloaded file and the published post — and MUST NOT re-encode the recording.
- **FR-009**: The one undo MUST cover a duration change exactly as it covers adding, moving or removing an annotation — one action, back to the previous duration.
- **FR-010**: An annotation MUST be shown only for the part of its duration that lies inside the clip and outside any cut; its duration MAY exceed what remains, and the annotation is then shown for what remains.

**How the duration is set**

- **FR-011**: The duration of a picked annotation MUST be settable from its preferences, beside its other properties, without leaving the picture.
- **FR-012**: The control that sets a duration MUST be a seconds value with controls that make it longer and shorter by a step, and MUST show the current length.
- **FR-013**: The control MUST make it possible to lengthen the duration up to what remains of the clip and to shorten it to the shortest worth keeping.
- **FR-014**: A duration that cannot be used MUST be refused, the annotation left unchanged, and the person told why.

**Seeing a stretch on the timeline**

- **FR-015**: The timeline MUST be able to show **more than one stretch at a time**, rather than a single selected section.
- **FR-016**: When an annotation is picked, the stretch it covers MUST be shown on the timeline, at the same time as a cut section that is selected.
- **FR-017**: While an annotation is picked, its stretch MUST be the **active stretch** — told apart from any other stretch shown — because it is the one being edited.
- **FR-018**: Letting a picked annotation go, or picking another, MUST take its stretch off the timeline and make the newly picked one's active, leaving a cut section's stretch as it was.
- **FR-019**: A stretch shown on the timeline MUST follow the annotation and the clip: it MUST move when the clip grows, close up over a cut, and change when the annotation's duration changes, so it never shows moments the annotation is not over.
- **FR-020**: Every stretch on the timeline MUST be drawn in **kept time**, exactly as the cut section is, so a cut closes up over all of them alike.

**Fitting the family**

- **FR-021**: Adding a kind of annotation MUST NOT require a change to the annotate column or the duration control, and MUST NOT change how any existing kind or cut behaves.
- **FR-022**: The duration of a kind's annotation MUST be set the same way as every other kind's — one shared control, whatever the kind.
- **FR-023**: Everything a kind is not — selecting, moving, resizing, copying, deleting, undoing, saving and exporting — MUST keep behaving exactly as before.

### Key Entities *(include if feature involves data)*

- **Annotation duration**: how long an annotation is shown, held as a value of the annotation beside its kind and its geometry. When a stretch is selected it spans that stretch — starting at the stretch's start for the stretch's length; when none is, it starts at the playhead with a default length — and can be changed afterward from the annotation's preferences.
- **Annotate control**: the one surface that offers every kind of annotation as a vertical row below the clip's settings control, whatever the kinds are.
- **Duration control**: the shared control in an annotation's preferences that sets the annotation's duration as a seconds value, one step at a time.
- **Timeline stretch**: a stretch of the clip drawn on the timeline — the selected cut section, and the stretch covered by a picked annotation. More than one may be shown at once, all in kept time.
- **Active stretch**: the one of the stretches shown on the timeline that the person is working on — the picked annotation's stretch while it is picked.
- **Annotation**: unchanged in what it is — something drawn over the picture — but where it is shown in time is now a value it holds and the person can change, rather than a stretch fixed at the moment it was made, and a picked annotation's stretch is shown on the timeline.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person can add an arrow from the annotate control and see it in playback in under 30 seconds, without first selecting a stretch of the timeline.
- **SC-002**: Adding a kind of annotation leaves every existing annotate row reachable and non-overlapping, at any number of kinds the app offers.
- **SC-003**: A person can change a placed annotation's duration and see it in playback in under 10 seconds from opening its preferences.
- **SC-004**: In 100% of outputs (the downloaded file and the published post), an annotation is shown for exactly its duration, over the same moments as in the review.
- **SC-005**: Changing a duration and then pressing the one undo returns the previous duration in one action, 100% of the time.
- **SC-006**: A clip with annotation durations survives a reload and comes back with every duration in place, 100% of the time.
- **SC-007**: An annotation's duration is never shown to run past the end of the clip, and never past a cut, in 100% of cases.
- **SC-008**: A person can see the stretch a picked annotation covers on the timeline, 100% of the time, without playing the clip.
- **SC-009**: A picked annotation's stretch and a selected cut section are both shown at once, with the annotation's as the active one, 100% of the time.

## Assumptions

- **The "edit clip icon" is the clip's settings control** — the pencil in the corner of the preview that opens what the clip says about itself. The annotate rows sit directly below it, on the picture.
- **A selected stretch is optional and sets both the start and the duration.** If the person has a stretch selected on the timeline when they press a kind, the new annotation **spans that stretch** — it starts at the stretch's start and lasts its length. With nothing selected, it starts at the playhead with a default duration. The selection is not required to annotate, and it stays the one way to point at a stretch for a **cut**.
- **The annotation's preferences are the existing properties surface** — the popover opened from the settings control on a picked annotation — extended with the duration row. This change adds one property; it does not build a second panel.
- **The duration control is a seconds value with step controls** — a number and controls to make it longer or shorter by a step, not a strip against the timeline. A micro-timeline remains a possible later refinement.
- **The picked annotation's stretch is shown on the timeline beside the cut section**, not in place of it: the two are shown together, and the annotation's is the active one while it is picked. The other annotations keep their finder marks on the lane.
- **The timeline stretch is a view of the duration** — it follows the seconds value and the clip, and is drawn in kept time; the duration is set with the seconds value, not by dragging the stretch in this version.
- **The default duration is a value the app fixes** — two seconds unless a later change makes it configurable — applied when a kind is pressed with no stretch selected.
- **Duration is in seconds of the recording**, so it is not scaled when the clip grows: a new take makes the clip longer, and an annotation keeps the moment and the length it had.
- **The watermark the clip wears spans the whole clip** and is placed by the clip, not by hand; it keeps spanning the clip and does not take a duration.
- **A pasted copy keeps the duration of the annotation it copies**, and a paste whose duration would run past the end of the clip is pulled back so its whole duration stays inside the clip.
- **An agent's annotate operation that names a stretch keeps working**: the length of the named stretch becomes the duration of the annotation it places.
- **The annotation family is unchanged in this version** — the arrow, the image and the text; only where the kinds are offered and how long they last change.
