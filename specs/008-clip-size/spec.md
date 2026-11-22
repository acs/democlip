# Feature Specification: Clip Size

**Feature Branch**: `record-size`

**Created**: 2026-11-22

**Status**: Draft

**Input**: User description: "when recording several takes with different sizes we need to unify them to the final exporting size, the clip size. We need to consolidate the different recording sizes to the clip size, which could be a property"

## Clarifications

### Session 2026-11-22

- Q: When a take's picture has a different shape from the clip size, how should it be consolidated — fitted whole and centred, filled by cropping, or stretched? → A: **Fit whole and centred.** The whole picture is kept, scaled to fit the clip size; the space around a picture of another shape shows the clip's background. Nothing is cropped or stretched.
- Q: When a later take is larger or smaller than the first, should the clip size stay at the first take's size, or grow to the largest take's size? → A: **Grow to the largest take.** The clip size starts at the first take's size and grows when a larger take arrives; a smaller take is fitted into it. The person can set the clip size in the clip's properties, and once set, their size is kept and later takes are fitted into it.
- Q: Should the clip size always be even, so every export writes exactly the clip size, or may it be odd with the MP4 path taking it down to even? → A: **Even only.** The clip size is always even on both edges; an odd take is fitted into the next even size, and the person can only set even sizes.

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

### User Story 2 - Choose the clip's size (Priority: P2)

The clip size is a property of the clip, like its title and description. The person opens the clip's properties, sees the clip size, and changes its width and height. The review shows the new size, every take re-fits into it, and the next export writes exactly that size. Once the person has set the size, it is kept: a later take — larger or smaller — is fitted into the person's size and does not grow or shrink it. The clip size is kept with the clip, so it comes back after a reload, and the one undo takes a change back.

**Why this priority**: A clip's size is not always the size the first take happened to have. A person may want a 1080p file from a clip whose first take was a smaller crop, or a smaller file for sharing. Without this, the only way to change the size is to re-record.

**Independent Test**: Open a clip's properties, change the clip size to a different width and height, and export. The exported file's picture is the new size. Reload the page and the clip size is still the new one; change it again and press undo and the previous size is back.

**Acceptance Scenarios**:

1. **Given** a clip in the review, **When** the person opens the clip's properties, **Then** the clip size is shown there with its width and height.
2. **Given** the clip size shown, **When** the person changes the width and height and confirms, **Then** the review shows the new size and every take is re-fitted into it.
3. **Given** a changed clip size, **When** the person exports, **Then** the file's picture is exactly the new size.
4. **Given** a changed clip size, **When** the page is reloaded and the clip comes back, **Then** the clip size is the changed one.
5. **Given** a changed clip size, **When** the person presses the one undo, **Then** the clip size is the previous one and the review and next export follow it.
6. **Given** a clip size the app cannot write — empty, zero, negative, or beyond what the app can encode — **When** the person tries to set it, **Then** the change is refused and the previous size stays.
7. **Given** a clip size the person has set, **When** a later take of a different size arrives, **Then** the clip size stays at the person's size and the later take is fitted into it.
8. **Given** the clip size controls, **When** the person enters an odd width or height, **Then** the app uses the next even size above it.

---

### User Story 3 - A clip's size follows the largest take (Priority: P3)

When a later take arrives with a larger picture, the clip size grows to the take's size, so no take is scaled down below its own picture. The earlier takes are scaled up to fit the new size. A smaller take does not shrink the clip size; it is fitted into it. The person's frame stays the same size throughout, and the file's size stays the same. Once the person has set the clip size in the clip's properties, their size is kept and later takes are fitted into it.

**Why this priority**: A clip whose size is smaller than its largest take would throw away picture the person recorded. Growing to the largest take keeps every take at its best, while the person can still set a smaller size when they want a smaller file.

**Independent Test**: Record a clip with a first take of 1280×720 and add a second take of 1920×1080. The clip size grows to 1920×1080, the first take is scaled up to fit, and the exported file's picture is 1920×1080 throughout. Add a third take of 1280×720 and the clip size stays 1920×1080.

**Acceptance Scenarios**:

1. **Given** a clip with a first take of 1280×720, **When** a second take of 1920×1080 arrives, **Then** the clip size grows to 1920×1080 and the first take is scaled up to fit it.
2. **Given** the same clip, **When** the person exports it, **Then** the file's picture is 1920×1080 throughout.
3. **Given** a clip whose first take is a cropped 800×600 picture, **When** a later take is a full 1920×1080 picture, **Then** the clip size grows to 1920×1080 and the earlier take is scaled up to fit it.
4. **Given** a clip whose clip size is 1920×1080, **When** a later take of 1280×720 arrives, **Then** the clip size stays 1920×1080 and the later take is fitted into it.
5. **Given** a clip size the person has set, **When** a later larger take arrives, **Then** the clip size stays at the person's size and the later take is fitted into it.

---

### Edge Cases

- **A clip with no takes**: there is no picture yet, so there is no clip size. The clip size appears when the first take arrives and is set from that take's picture, rounded up to even.
- **A take with an odd edge**: a crop or an imported file can have an odd width or height. The clip size is always even on both edges, so an odd take is fitted into the next even size above it; every export then writes exactly the clip size.
- **A clip with takes of different shapes**: the clip size is the largest width and the largest height among them, rounded up to even, so every take fits whole; a portrait take and a landscape take in one clip make a frame that holds both.
- **A clip size changed while an export is running**: the export uses the size it started with; the change applies to the next export. The person is not left with a half-sized file.
- **A clip size changed to a much larger size**: the takes are scaled up and the export writes the larger size. The app may say the file will be larger, but it does not refuse a size it can encode.
- **A clip size changed to a much smaller size**: the takes are scaled down and the export writes the smaller size. No take is cropped.
- **A clip size changed after annotations are placed**: annotations are fractions of the picture, so they stay in the same relative place and are not lost. A title card and the intro are drawn at the new size too.
- **A clip size changed when the clip has no takes**: the property is not shown; there is nothing to fit.
- **A clip restored from a saved copy**: the saved size is used. A saved clip with no size — one written before the clip size existed — takes its size from the largest take's picture.
- **A publish**: the published video uses the clip size, and the aspect ratio the post shows is derived from it.
- **A clip size set to a size the app cannot encode**: refused, with the reason said plainly; the previous size stays.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Once a clip has a take, it MUST have a size — a width and a height in pixels — that is the picture the review shows and every export and publish writes.
- **FR-002**: The clip size MUST be the largest width and the largest height among the clip's takes: it starts at the first take's picture and grows when a larger take arrives. A smaller take MUST NOT shrink it.
- **FR-003**: Every take MUST be consolidated into the clip size: its whole picture is shown at the clip size, without distortion. A take whose picture has a different shape is fitted whole and centred; the space around it shows the clip's background.
- **FR-004**: The review preview MUST show the clip size, not the size of whichever take is playing. Every take MUST be shown in the same frame, the clip size.
- **FR-005**: Every export and publish MUST write the clip size. The file's picture MUST NOT change size between takes.
- **FR-006**: The clip size MUST be a clip property shown in the clip properties panel, with its width and height. The person MUST be able to change it. Once the person changes it, their size MUST be kept: a later take MUST be fitted into it and MUST NOT grow or shrink it.
- **FR-007**: Changing the clip size MUST re-fit every take and every annotation. The review MUST show the new size and the next export MUST use it.
- **FR-008**: The clip size MUST be saved with the clip and MUST come back after a reload.
- **FR-009**: Changing the clip size MUST be a change the one undo takes back.
- **FR-010**: A clip size the app cannot encode MUST be refused, with the reason said plainly, and the previous size MUST stay.
- **FR-011**: A clip with no takes MUST have no clip size; the size MUST appear when the first take arrives.
- **FR-012**: Annotations MUST stay in the same relative place when the clip size changes, because they are fractions of the picture.
- **FR-013**: A title card and the intro MUST be drawn at the clip size.
- **FR-014**: A published video's aspect ratio MUST be derived from the clip size.
- **FR-015**: A clip restored from a saved copy MUST use the saved clip size; a saved clip with no size MUST take its size from the largest take's picture.
- **FR-016**: The clip size MUST NOT change by itself once the person has set it; a later take MUST be fitted into the person's size.
- **FR-017**: The clip size MUST be even on both edges. An odd take MUST be fitted into the next even size above it, and a size the person sets MUST be even — an odd value is rounded up to the next even size.

### Key Entities

- **Clip**: the aggregate — its takes, its cuts, its annotations, and what it says about itself. Its size is one of the things it says about itself.
- **Clip size**: a width and a height in pixels, both even; the picture the clip is shown and exported at. It starts at the first take's picture and grows to the largest width and height among its takes, rounded up to even, kept with the clip, and changeable by the person. It is not a fraction and is not scaled when the clip grows.
- **Take**: one recording with its own picture size. A take is consolidated into the clip size when it is shown or exported; its own size is not the clip's size.
- **Clip properties**: the values the clip says about itself — its title, its description, and its clip size. They are kept with the clip and taken back by the one undo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A clip made of takes of different picture sizes exports as a file whose picture is one size throughout — the clip size — with no frame changing size partway. (100% of takes in the file.)
- **SC-002**: The whole of every take's picture is visible in the review and in the export: no take is cropped and no part of a take is lost. (100% of takes.)
- **SC-003**: A person can change the clip size and the next export writes exactly the new size, without re-recording, in under a minute.
- **SC-004**: The clip size survives a reload and is taken back by the one undo, in 100% of cases.
- **SC-005**: A clip of two takes of different sizes exports with no visible jump in picture size; the person sees the same frame size throughout.
- **SC-006**: Every take in a clip is shown at the clip size; no take is shown at its own size after the clip size is set. (100% of takes.)
- **SC-007**: A clip size the app cannot encode is refused in 100% of cases and the previous size stays.
- **SC-008**: A clip whose first take is smaller than a later take exports at the later, larger size; no take is scaled down below its own picture. (100% of takes.)
- **SC-009**: Once the person sets the clip size, a later take of any size does not change it; the file stays at the person's size. (100% of cases.)
- **SC-010**: Every exported file's width and height equal the clip size exactly, on every target. (100% of targets.)

## Assumptions

- The clip size starts at the first take's picture size and grows to the largest width and the largest height among its takes as takes arrive, rounded up to even. A smaller take is fitted into it. Once the person sets the clip size in the clip's properties, their size is kept and later takes are fitted into it.
- The whole picture of each take is kept and fitted into the clip size, centred, rather than cropped or stretched. The space around a picture of another shape shows the clip's background.
- The clip size is kept with the clip, like the title and description, and is a clip property edited in the clip properties panel.
- The clip size is the picture the review preview shows, so the person sees what the export will write.
- The clip size is not a fraction and is not scaled when the clip grows; only the takes are fitted into it.
- A clip with no takes has no size; the size is set when the first take arrives.
- The app's existing export targets and their codec rules are unchanged; the clip size is the picture they are given. The clip size is even on both edges, so no codec needs to take an edge down.
- The clip size is the final exporting size; a publish uses the same size.
- The clip size is a whole, even number of pixels on each edge, at least 2×2. A size the app cannot encode is refused.
- The title card and the intro are drawn at the clip size, so a card is the same shape as the file.
