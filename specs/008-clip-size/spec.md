# Feature Specification: Clip Size

**Feature Branch**: `record-size`

**Created**: 2026-11-22

**Status**: Draft

**Input**: User description: "when recording several takes with different sizes we need to unify them to the final exporting size, the clip size. We need to consolidate the different recording sizes to the clip size, which could be a property"

## Clarifications

### Session 2026-11-22

- Q: When a take's picture has a different shape from the clip size, how should it be consolidated — fitted whole and centred, filled by cropping, or stretched? → A: **Fit whole and centred.** The whole picture is kept, scaled to fit the clip size; the space around a picture of another shape shows the clip's background. Nothing is cropped or stretched.
- Q: When a later take is larger or smaller than the first, should the clip size stay at the first take's size, or grow to the largest take's size? → A: **Grow to the largest take.** The clip size starts at the first take's size and grows when a larger take arrives; a smaller take is fitted into it.
- Q: Should the clip size always be even, so every export writes exactly the clip size, or may it be odd with the MP4 path taking it down to even? → A: **Even only.** The clip size is always even on both edges; an odd take is fitted into the next even size.
- Q: Should the person be able to change the clip size, or is it derived from the takes alone? → A: **Derived only, shown read-only.** The size is the largest width and height among the takes, both even. The clip properties panel shows it and offers no control to change it, and an agent cannot set it — a person cannot hold a clip to a shape its own takes do not have.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One size for every take (Priority: P1)

A person records a clip in several takes, and the takes do not all have the same picture size — a crop changed between takes, a webcam take is a different shape from a screen take, or an imported file is a different size. The clip has one size, its **clip size**, which is the largest width and the largest height among its takes. Every take is shown at that size in the review and written at that size in the export. The person sees the whole of each take, fitted and centred in the same frame, so the finished file never jumps from one picture size to another.

**Why this priority**: This is the whole point. Without it, a clip made of different-sized takes exports as a file whose picture changes size partway, which looks broken and is not the clip the person watched.

**Independent Test**: Record a clip with two takes of different picture sizes — for example, a full-screen take and a cropped take — review it and export it. The review shows both takes in the same frame, and the exported file's picture is one size throughout.

**Acceptance Scenarios**:

1. **Given** a clip whose first take is 1920×1080 and whose second take is 1280×720, **When** the review opens, **Then** both takes are shown in the same 1920×1080 frame, each fitted whole and centred.
2. **Given** the same clip, **When** the person exports it, **Then** the file's picture is 1920×1080 throughout and no take changes the frame's size.
3. **Given** a take whose picture is smaller than the clip size, **When** it is shown or exported, **Then** its whole picture is scaled up to fit the clip size and no part of it is cut off.
4. **Given** a take whose picture is larger than the clip size, **When** it arrives, **Then** the clip size grows to hold the take's picture, rounded up to even, and the earlier smaller takes are scaled up to fit the new clip size.
5. **Given** a take whose picture has a different shape from the clip size, **When** it is shown or exported, **Then** the whole picture is fitted inside the clip size and the space around it shows the clip's background.

---

### User Story 2 - See the clip's size (Priority: P2)

The person opens the clip's properties and sees the size the clip will be written at — its width and height, the largest among the takes, both even. There is nothing to type into: the size follows the takes, so the person cannot hold the clip to a shape its own takes do not have, and neither can an agent. The size comes back after a reload, with the takes it is derived from.

**Why this priority**: Knowing the size is useful — it is what the file will be — but letting it be set is what would break the clip: a size smaller than a take would throw picture away, and a size of another shape would letterbox every take.

**Independent Test**: Open a clip's properties and confirm the clip size is shown with its width and height and that the row has nothing to change it; a reload shows the same size.

**Acceptance Scenarios**:

1. **Given** a clip in the review, **When** the person opens the clip's properties, **Then** the clip size is shown with its width and height.
2. **Given** the clip size shown, **When** the person looks for a way to change it, **Then** there is none — the row is a value, not a field.
3. **Given** the clip size shown, **When** an agent asks to change it, **Then** the app refuses and the size is unchanged.
4. **Given** a clip, **When** the page is reloaded and the clip comes back, **Then** the size is the same one the takes derive.

---

### User Story 3 - A clip's size follows the largest take (Priority: P3)

When a later take arrives with a larger picture, the clip size grows to the take's size, so no take is scaled down below its own picture. The earlier takes are scaled up to fit the new size. A smaller take does not shrink the clip size; it is fitted into it. The frame stays the same size throughout, and the file's size stays the same. The size is not the person's to set: it follows the takes alone.

**Why this priority**: A clip whose size is smaller than its largest take would throw away picture the person recorded. Growing to the largest take keeps every take at its best, and nothing can hold the clip to a shape its own takes do not have.

**Independent Test**: Record a clip with a first take of 1280×720 and add a second take of 1920×1080. The clip size grows to 1920×1080, the first take is scaled up to fit, and the exported file's picture is 1920×1080 throughout. Add a third take of 1280×720 and the clip size stays 1920×1080.

**Acceptance Scenarios**:

1. **Given** a clip with a first take of 1280×720, **When** a second take of 1920×1080 arrives, **Then** the clip size grows to 1920×1080 and the first take is scaled up to fit it.
2. **Given** the same clip, **When** the person exports it, **Then** the file's picture is 1920×1080 throughout.
3. **Given** a clip whose first take is a cropped 800×600 picture, **When** a later take is a full 1920×1080 picture, **Then** the clip size grows to 1920×1080 and the earlier take is scaled up to fit it.
4. **Given** a clip whose clip size is 1920×1080, **When** a later take of 1280×720 arrives, **Then** the clip size stays 1920×1080 and the later take is fitted into it.
5. **Given** a clip, **When** a size is written into the clip's properties, **Then** the clip size is unmoved — it follows the takes, not the properties.

---

### Edge Cases

- **A clip with no takes**: there is no picture yet, so there is no clip size. The size appears with the first take, from that take's picture, rounded up to even.
- **A take with an odd edge**: a crop or an imported file can have an odd width or height. The clip size is always even on both edges, so an odd take is fitted into the next even size above it; every export then writes exactly the clip size.
- **A clip with takes of different shapes**: the clip size is the largest width and the largest height among them, rounded up to even, so every take fits whole; a portrait take and a landscape take in one clip make a frame that holds both.
- **A larger take arriving while an export is running**: the export uses the size it started with; the new size applies to the next export. The person is not left with a half-sized file.
- **A larger take arriving after annotations are placed**: annotations are fractions of the picture, so they stay in the same relative place and are not lost. A title card and the intro are drawn at the new size too.
- **A take whose picture cannot be measured**: the clip size ignores it. A clip whose takes have no measured picture has no size; one measured take is enough.
- **A clip restored from a saved copy**: the takes carry their own picture sizes, so the same size comes back. A clip written before the size existed is measured from its takes on load.
- **A publish**: the published video uses the clip size, and the aspect ratio the post shows is derived from it.
- **A person or an agent trying to change the clip size**: refused. The panel draws the size and offers no control, and the automation surface refuses the operation; the size keeps following the takes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Once a clip has a take, it MUST have a size — a width and a height in pixels — that is the picture the review shows and every export and publish writes.
- **FR-002**: The clip size MUST be the largest width and the largest height among the clip's takes: it starts at the first take's picture and grows when a larger take arrives. A smaller take MUST NOT shrink it.
- **FR-003**: Every take MUST be consolidated into the clip size: its whole picture is shown at the clip size, without distortion. A take whose picture has a different shape is fitted whole and centred; the space around it shows the clip's background.
- **FR-004**: The review preview MUST show the clip size, not the size of whichever take is playing. Every take MUST be shown in the same frame, the clip size.
- **FR-005**: Every export and publish MUST write the clip size. The file's picture MUST NOT change size between takes.
- **FR-006**: The clip size MUST be shown in the clip properties panel, with its width and height. It MUST NOT be changeable by the person or by an agent.
- **FR-007**: When a larger take grows the clip size, the review MUST show the new size and the next export MUST use it, and every annotation MUST stay in the same relative place.
- **FR-008**: Each take's picture size MUST be saved with the take, so the derived clip size MUST come back after a reload.
- **FR-009**: The clip size MUST follow the takes alone: a larger take MUST grow it and a smaller take MUST NOT shrink it.
- **FR-010**: A browser that cannot encode the clip size MUST be reported by the export, with the reason said plainly, as it is today.
- **FR-011**: A clip with no takes MUST have no clip size; the size MUST appear when the first take arrives.
- **FR-012**: Annotations MUST stay in the same relative place when the clip size grows, because they are fractions of the picture.
- **FR-013**: A title card and the intro MUST be drawn at the clip size.
- **FR-014**: A published video's aspect ratio MUST be derived from the clip size.
- **FR-015**: A clip restored from a saved copy MUST use the size its takes derive; a saved clip whose takes have no stored picture size MUST have it measured from the take.
- **FR-016**: The clip size MUST NOT be settable by the person or by an agent; it follows the takes alone.
- **FR-017**: The clip size MUST be even on both edges. An odd take MUST be fitted into the next even size above it.

### Key Entities

- **Clip**: the aggregate — its takes, its cuts, its annotations, and what it says about itself. Its size is derived from the takes.
- **Clip size**: a width and a height in pixels, both even; the picture the clip is shown and exported at. It is the largest width and height among its takes, rounded up to even, and it follows them — a larger take grows it, a smaller one does not shrink it. It is shown in the clip properties panel but is not the person's to set, and it is not a fraction of the clip.
- **Take**: one recording with its own picture size. A take is consolidated into the clip size when it is shown or exported; its own size is not the clip's size.
- **Clip properties**: the values the clip says about itself — its title and its description. They are kept with the clip and taken back by the one undo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A clip made of takes of different picture sizes exports as a file whose picture is one size throughout — the clip size — with no frame changing size partway. (100% of takes in the file.)
- **SC-002**: The whole of every take's picture is visible in the review and in the export: no take is cropped and no part of a take is lost. (100% of takes.)
- **SC-003**: The clip size is shown in the clip properties panel and cannot be changed, in 100% of cases.
- **SC-004**: The clip size comes back after a reload, in 100% of cases.
- **SC-005**: A clip of two takes of different sizes exports with no visible jump in picture size; the person sees the same frame size throughout.
- **SC-006**: Every take in a clip is shown at the clip size; no take is shown at its own size once the clip has a size. (100% of takes.)
- **SC-007**: An export the browser cannot encode is refused in 100% of cases, with the reason said.
- **SC-008**: A clip whose first take is smaller than a later take exports at the later, larger size; no take is scaled down below its own picture. (100% of takes.)
- **SC-009**: A larger take grows the clip size and a smaller one does not shrink it; the file follows the takes. (100% of cases.)
- **SC-010**: Every exported file's width and height equal the clip size exactly, on every target. (100% of targets.)

## Assumptions

- The clip size starts at the first take's picture size and grows to the largest width and the largest height among its takes as takes arrive, rounded up to even. A smaller take is fitted into it. It is derived, never stored, and is not the person's to set.
- The whole picture of each take is kept and fitted into the clip size, centred, rather than cropped or stretched. The space around a picture of another shape shows the clip's background.
- The clip size is shown in the clip properties panel like the title and description, but is not the person's to set: the panel draws its value and offers no control.
- The clip size is the picture the review preview shows, so the person sees what the export will write.
- The clip size is not a fraction and is not scaled when the clip grows; only the takes are fitted into it.
- A clip with no takes has no size; the size is set when the first take arrives.
- The app's existing export targets and their codec rules are unchanged; the clip size is the picture they are given. The clip size is even on both edges, so no codec needs to take an edge down.
- The clip size is the final exporting size; a publish uses the same size.
- The clip size is a whole, even number of pixels on each edge, at least 2×2.
- The title card and the intro are drawn at the clip size, so a card is the same shape as the file.
