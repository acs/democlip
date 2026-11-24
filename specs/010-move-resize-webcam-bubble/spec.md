# Feature Specification: Move and Resize the Webcam Bubble

**Feature Branch**: `resize-webcam-bubble`

**Created**: 2026-11-24

**Status**: Draft

**Input**: User description: "Move and resize the webcam bubble in the live preview. The bubble is drawn into the take at record time, so it's baked into the pixels. The live preview is the only place it can be placed. Making it movable after recording would need the webcam recorded as a second track and composited at review/export — a pipeline change, explicitly not this. Shape chosen: a circle (a resize changes the diameter only) and per sitting (not persisted — like the crop and the chosen camera; a reload is the bottom-right corner again)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Move the bubble to a chosen place (Priority: P1)

With the screen shared and the webcam on, the camera shows as a small circle in the bottom-right corner of the recorded region. The person wants it out of the way of what matters (a slide, a terminal, a face-cam spot in another corner), so they drag the circle to the place they want it, and the next take records it there.

**Why this priority**: The default corner covers something for almost every screen, and the person is the only one who knows what it covers. Being able to move the bubble is the whole value of the feature; without it the camera is either in the corner or off.

**Independent Test**: Turn the screen and the webcam on, drag the bubble from the bottom-right to another corner of the live preview, record a take, and confirm the recorded picture holds the bubble in the new place.

**Acceptance Scenarios**:

1. **Given** the screen and the webcam are on and the live preview is showing, **When** the person drags the bubble to a new place inside the recorded region, **Then** the bubble moves with the pointer and stays where it is released.
2. **Given** the bubble has been moved, **When** the person records a take, **Then** the bubble in the recorded picture sits in the place it was moved to, the same place the live preview showed.
3. **Given** the bubble has been moved, **When** the person records a later take, **Then** that take shows the bubble in the same moved place (the choice lasts for the sitting).

---

### User Story 2 - Make the bubble the size they want (Priority: P2)

The person wants their face smaller so it intrudes less, or bigger so it reads on a small screen at the other end. They change the bubble's diameter, and the next take records it at that size. The bubble stays a circle — only its diameter changes.

**Why this priority**: Size is a real correction (a bubble that hides too much, or one too small to see), but moving it out of the way already solves the most common problem, so this follows.

**Independent Test**: With the bubble shown, drag its edge to grow and then shrink it, record a take, and confirm the recorded picture holds the bubble at the chosen diameter and still circular.

**Acceptance Scenarios**:

1. **Given** the bubble is shown in the live preview, **When** the person drags the bubble's edge outward or inward, **Then** the bubble grows or shrinks as a circle (its diameter changes; it is never stretched into another shape).
2. **Given** the bubble's diameter has been changed, **When** the person records a take, **Then** the recorded picture holds the bubble at that diameter.
3. **Given** the person drags the edge past the smallest or largest allowed diameter, **When** it reaches the limit, **Then** the bubble stops changing size and stays usable.

---

### User Story 3 - The placement lasts the sitting and then is forgotten (Priority: P3)

The person moves and sizes the bubble, records several takes, and for all of them the bubble stays where they put it. When they press New or reload the page, the bubble is back in the bottom-right corner at its default size — the placement belonged to the sitting, like the crop and the chosen camera, and is not kept.

**Why this priority**: This pins the lifetime the person decided on. It matters, but it is a boundary of the feature rather than its everyday use.

**Independent Test**: Move and resize the bubble, record a take, start another take, and confirm the bubble keeps its place; then reload and confirm the bubble is back in the bottom-right corner at the default diameter.

**Acceptance Scenarios**:

1. **Given** the bubble has been moved and resized, **When** the person records another take in the same sitting, **Then** the bubble keeps the same place and diameter without being set again.
2. **Given** the bubble has been moved and resized, **When** the person reloads the page, **Then** the bubble is back in the bottom-right corner at its default diameter.
3. **Given** the bubble has been moved and resized, **When** the person presses New and starts a new sitting, **Then** the bubble is back in the bottom-right corner at its default diameter.

---

### Edge Cases

- **A drag on the bubble versus a drag on the picture.** In the live preview a drag on the picture sets the crop. A drag that begins on the bubble must move the bubble and must not set a crop; a drag that begins anywhere else must crop as it does today. The two gestures never both happen from one press.
- **Moving toward an edge.** A bubble dragged toward the edge of the recorded region stops when it would leave the region; the whole circle stays inside the recorded picture.
- **Resizing toward a limit.** A bubble dragged smaller than the minimum, or larger than the maximum, stops at the limit rather than vanishing or swallowing the picture.
- **The crop changes after the bubble was placed.** Because the placement is a place in the recorded picture, the bubble keeps its place relative to the recorded region; if the region becomes too small for that place, the bubble is kept inside it.
- **The camera is the whole picture.** With the screen off, the camera fills the picture and there is no bubble over it — so there is nothing to move or resize, and no control for it is shown.
- **The webcam is turned off and on again within the sitting.** The bubble comes back in the place and at the diameter the person chose for that sitting.
- **A placement gesture during a take or in review.** Moving and resizing belong to the live preview; a drag during a take or in review changes nothing.
- **The preview and the recording differ in size.** The bubble sits at the same place and the same relative size in the live preview and in the recorded picture, whatever the preview's size and the recording's resolution.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When the screen is shared and the webcam is on, the live preview MUST show the webcam as a circular bubble over the recorded region, in the bottom-right corner of that region at a default diameter.
- **FR-002**: The person MUST be able to move the bubble in the live preview by dragging it, and the bubble MUST follow the pointer and stay where it is released.
- **FR-003**: The person MUST be able to change the bubble's diameter in the live preview by dragging its edge, and the bubble MUST remain a circle — only its diameter changes.
- **FR-004**: The bubble MUST be kept wholly inside the recorded region: neither moving nor resizing may take any part of the circle outside it.
- **FR-005**: The bubble's diameter MUST be bounded by a smallest and a largest allowed value, so it can never be made to vanish or to swallow the picture.
- **FR-006**: The place and diameter the person sets MUST be what the next take is recorded with — the recorded picture holds the bubble in the same place and at the same relative size the person saw in the live preview.
- **FR-007**: A change to the bubble's place or diameter MUST NOT change any take already recorded; it applies to takes recorded after it.
- **FR-008**: The bubble's place and diameter MUST last for the sitting — across takes, and across turning the webcam off and on — and MUST NOT be persisted: a reload or New returns the bubble to the bottom-right corner at the default diameter.
- **FR-009**: A drag that begins on the bubble MUST move (or, on its edge, resize) the bubble and MUST NOT set the crop; a drag that begins elsewhere in the live preview MUST set the crop as it does today.
- **FR-010**: Moving and resizing MUST be available only in the live preview; a drag during a take or in review MUST change nothing.
- **FR-011**: When there is no bubble — the webcam is off, or the screen is off so the camera is the whole picture — no bubble MUST be drawn over the picture and no moving or resizing control MUST be shown.
- **FR-012**: The bubble's place MUST be held relative to the recorded region, so that changing the crop keeps the bubble at the same place in the recorded picture and inside it.

### Key Entities *(include if feature involves data)*

- **Webcam bubble placement**: where the camera circle sits and how big it is — a place within the recorded region and a diameter. It belongs to the sitting, not to the clip, and it is not written down anywhere that outlives the page.
- **Recorded region (the crop)**: the rectangle of the source that is recorded. The bubble lives inside it, and its place is understood relative to it.
- **Take**: one arrival of a recording. Once a take is made the bubble is part of its pixels, so a placement never reaches back into a take that already exists.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person can move the bubble to the place they want and see it there in under 5 seconds, in one gesture.
- **SC-002**: A person can change the bubble's diameter to the size they want in under 5 seconds.
- **SC-003**: In 100% of takes after a placement change, the bubble in the recorded picture sits in the same place and at the same relative size the live preview showed — the picture matches what was seen.
- **SC-004**: In 100% of cases a reload or New returns the bubble to the bottom-right corner at the default diameter, confirming the placement is not persisted.
- **SC-005**: 0% of bubble-moving or bubble-resizing gestures set a crop, and 0% of crop gestures move the bubble — the two gestures never interfere.
- **SC-006**: In 100% of placements the bubble stays wholly inside the recorded region, at every allowed size.

## Assumptions

- A bubble exists only when the screen is shared **and** the webcam is on. With the screen off the camera is the whole picture, which is croppable but carries no bubble.
- The bubble is always a circle. Resizing changes its diameter only and never its shape, aspect or position relative to its own centre.
- The default place is the bottom-right corner of the recorded region and the default diameter is the size the app uses today, so nothing changes for a person who does not touch the bubble.
- Moving is a drag on the circle; resizing is a drag on its edge (a handle on the rim). These are the chosen gestures and are not configurable.
- The placement is set in the live preview only — the same phase in which the crop is set — and not during a take or in review.
- The placement lasts for the sitting and is not persisted, exactly as the crop and the chosen camera are not: a reload or New restores the default.
- A placement applies to the next take and every take after it; it never alters a take already recorded.
- **Out of scope, deliberately**: moving or resizing the bubble in a take that has already been recorded. The bubble is drawn into the take's pixels at record time, so it cannot be repositioned afterwards without recording the webcam as a second track and compositing it at review or export — a pipeline change this feature does not make.
- The words are the project's own: a **take**, the **clip**, a **session** (one sitting), a **record source**, the **crop** and the **webcam bubble**. No new word is introduced; the bubble's place and diameter are its **placement**.
