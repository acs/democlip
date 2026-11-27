# Feature Specification: Export Resolution

**Feature Branch**: `output-resolution`

**Created**: 2026-11-25

**Status**: Draft

**Input**: User description: "let's control the export resolution to control the export size and to share a common production config for our videos"

## Clarifications

### Session 2026-11-25

- Q: Is the export resolution the same thing as the **clip size**, or a second size of its own? → A: **A second size of its own.** The **clip size** stays what the person works in — the frame the review shows and every take is fitted into — and the **export resolution** is the size the file is finally written at. The two are told apart, and the export resolution is **optional**: with none set, the clip size is used, exactly as today.
- Q: What does the export resolution change? → A: The size the **file** is written at — an export and a publish alike — and so the size of that file, because the encoder's bitrate follows its picture. It does not change the clip, the review, the takes' fit, the cuts or the annotations.
- Q: May the export resolution's shape differ from the clip size's, so the picture is letterboxed in the file, or must it keep the clip size's aspect ratio? → A: **It must keep the clip size's aspect ratio.** The export resolution is the clip size **scaled** — both edges changed by one factor and made even — so a smaller resolution is the same picture at fewer pixels: nothing cropped, nothing stretched, no bars, and the review and the file show the same frame.
- Q: Which written files use the export resolution — the plain downloads only, or also the file kept for further editing and the MP4 a publish uploads? → A: **Every export and publish.** The WebM/MP4 downloads, the file for editing and a publish are all written at the export resolution, so a production's published videos are the same size as the files it keeps.
- Q: When the chosen resolution is larger than the clip size — a 720p clip under a profile that fixes 1080p — should the file be enlarged, kept at the clip size, or should that size not be offered at all? → A: **Enlarge to the chosen size.** The file is exactly the export resolution, the picture scaled up with its aspect kept, so a production's output is uniform whatever the source.
- Q: The app clamps the encoder's bitrate **up** to a flat 4 Mbps floor, which sits above its own bits-per-pixel rule for every picture under about 1.1 megapixels — so 720p, 480p and 360p all wrote the same size, and the export resolution could not shrink a file at all (a 10s clip: 1641×1410 → 4.7 MB, 560×480 → 4.8 MB). Should a smaller resolution write a smaller file? → A: **Yes — the bitrate follows the picture.** The floor becomes a **share** of what the picture asks, never a flat rate, so a smaller resolution writes a smaller file, which is the one thing the control is for; a file whose destination budget cannot afford even that share is still refused rather than written below the picture. Deliberate and stated: this is shared policy that a **publish** also reads.
- (from the prompt) A profile is how "our videos" share one resolution: a production profile **fixes** the export resolution, as it already fixes the logo, add to export, annotation colour and sound boost.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Write the file at a size of my choosing (Priority: P1)

A person is happy with a clip whose takes are large — a 4K screen recording, a phone video — and the saved file is enormous. In the clip's own settings they set an **export resolution** from the app's list, and the next export is written at that size instead: the picture they watched, at fewer pixels, so the file is smaller. Left alone, nothing changes — the file is the clip size, exactly as today. The clip, the review and the editing are untouched; only the size the file is written at moves.

**Why this priority**: This is the whole point — the size of the file the person gets, in their own hands, without changing the clip they made.

**Independent Test**: Take a clip larger than 1080p, set the export resolution to 1080p, export it, and confirm the file's picture is 1920×1080 throughout, in the clip's own aspect ratio, and smaller than the same clip exported with no export resolution set.

**Acceptance Scenarios**:

1. **Given** a clip and no export resolution set, **When** the person exports it, **Then** the file is the clip size, exactly as today.
2. **Given** a clip, **When** the person sets the export resolution to 1080p, **Then** the file is 1080p throughout, in the clip's own aspect ratio, and every take of the clip is in it whole.
3. **Given** the same clip exported twice, at 1080p and at 720p, **When** the two files are compared, **Then** the 720p file is smaller.
4. **Given** an export resolution set, **When** the person looks at the review, **Then** the clip and its takes are shown exactly as before — the export resolution changes nothing about the clip.
5. **Given** a clip too large to publish, **When** the person lowers the export resolution, **Then** the published file is smaller and the publish can go ahead.

---

### User Story 2 - A production writes every video at one resolution (Priority: P2)

A production works under **DemoClipTV**, and its profile **fixes** the export resolution to 1080p. Every clip made under it is written at that size, whatever the takes' own size, with nothing to press and nothing to remember — and the setting is not the person's to move while that profile is active: the clip's settings show it as a value naming the profile, with no control. A profile that fixes none leaves the export resolution to the person, and to the clip size by default.

**Why this priority**: This is the "common production config" — one resolution across everything the production makes, so it cannot be forgotten or got wrong.

**Independent Test**: Store a profile that fixes the export resolution to 1080p, load the app, make a clip from a 4K take, export it, and confirm the file is 1080p in the clip's aspect ratio and the clip's settings show the resolution naming the profile, with no control.

**Acceptance Scenarios**:

1. **Given** a profile that fixes the export resolution to 1080p, **When** a clip is made under it, **Then** the clip's settings show 1080p as a value naming the profile, with no control.
2. **Given** that clip, **When** the person exports it, **Then** the file's picture is 1080p in the clip's aspect ratio, whatever the takes' own sizes.
3. **Given** the built-in **Empty** active, **When** the person opens the clip's settings, **Then** the export resolution is an ordinary list they can set, on **the clip size** by default.
4. **Given** a profile that fixes the export resolution, **When** an agent asks the app to change it, **Then** the app refuses and names the profile.
5. **Given** a profile that fixes the export resolution, **When** it is removed, **Then** the clip keeps the size it last had and the export resolution is the person's to change from then on.

---

### User Story 3 - The size the file will be, told plainly (Priority: P3)

The person opens the clip's settings and sees, beside the clip size, the size the file will be written at — the export resolution, or the clip size when none is set — so what they will get is readable without exporting to find out. It comes back after a reload with the clip, and the one undo takes back the person's own choice of it.

**Why this priority**: Knowing the size the file will be is what makes the control usable, but the control itself is what has to work first.

**Independent Test**: Set an export resolution, reload the app, open the clip's settings, and confirm the export resolution is shown and still set; undo the choice and confirm it returns to the clip size.

**Acceptance Scenarios**:

1. **Given** a clip in the review, **When** the person opens its settings, **Then** the export resolution is shown beside the clip size, with the size the file will be.
2. **Given** an export resolution set, **When** the page is reloaded and the clip comes back, **Then** the export resolution is still set.
3. **Given** the person's own change to the export resolution, **When** they press undo, **Then** it is taken back, exactly as the clip's other properties are.

---

### Edge Cases

- **A clip with no takes**: there is no picture and nothing to write, so there is no export resolution to set.
- **A sound-only clip**: an export writes the sound alone, with no picture, so the export resolution does not apply.
- **An export resolution larger than the clip size**: the picture is scaled up, aspect kept, and the file is larger; the app allows it.
- **The clip size's aspect ratio is one an offered size cannot hit exactly**: each edge is made even, so the aspect is kept to the nearest whole pixel — never by cropping, stretching or adding bars.
- **An export resolution the same as the clip size**: the file is unchanged.
- **The export resolution removed**: the next export is the clip size again.
- **A later, larger take arrives**: the clip size may grow; an export resolution the person or a profile set is unchanged, while one left at the clip size follows the new clip size.
- **A larger take arriving while an export runs**: the running export is written at the resolution it started with.
- **A hand-written profile or snapshot holds a size the app does not offer**: it is refused or ignored rather than kept.
- **A size the browser cannot encode**: the export is refused with the reason said, as the clip size is today.
- **A profile fixes the export resolution**: the person and an agent cannot change it, and the refusal names the profile.
- **A profile that fixed the export resolution is removed**: the value it applied stays on the clip and is the person's from then on.
- **The clip store refuses or cannot be read**: the clip opens with the export resolution at the clip size.
- **A publish**: the aspect ratio the post shows is derived from the export resolution, and the file the service is handed is written at it.

## Requirements *(mandatory)*

### Functional Requirements

**The export resolution**

- **FR-001**: A clip MUST be able to carry an **export resolution** — the width and height its file is written at, in pixels, both even — as a property of the clip.
- **FR-002**: The export resolution MUST be **optional**. When the clip holds none, the export MUST be written at the **clip size**, exactly as it is today.
- **FR-003**: The person MUST be able to set the export resolution from the app's own list of resolutions, including an option that gives it back to the clip size.
- **FR-004**: The export resolution MUST keep the **clip size's aspect ratio**: it MUST be the clip size **scaled** by a single factor, both edges made even, so a smaller resolution is the same picture at fewer pixels — nothing cropped, nothing stretched and nothing added to the sides.
- **FR-005**: The export resolution MUST NOT change the **clip size**, the review, the takes, their fit into the clip size, the cuts, the annotations or the clip's other properties. It decides only the size the file is written at.
- **FR-006**: Every take MUST still be fitted into the **clip size** whole and centred, exactly as today; the export resolution is applied to the clip's whole picture, not to the takes one by one.

**What the file is written at**

- **FR-007**: Every export and publish MUST write the **export resolution**, as the clip's picture **scaled** to it — never cropped, never stretched and never letterboxed.
- **FR-008**: The file's picture MUST NOT change size between takes, exactly as it does not today.
- **FR-009**: The exported file's size MUST follow the export resolution, so a smaller resolution MUST write a smaller file for the same clip and length, and the clip size MUST write today's file.
- **FR-010**: The export resolution MUST be shown in the clip properties panel, with the **clip size** beside it, so the size the file will be written at is readable before exporting.
- **FR-011**: The title card, the intro and the **watermark** MUST be drawn at the export resolution, and every **annotation** MUST keep the same relative place it has in the clip size.

**A profile fixes it**

- **FR-012**: The export resolution MUST be an item a **profile** may control, fixed at one of the app's resolutions — so a production writes every clip at one resolution with nothing pressed.
- **FR-013**: An export resolution a profile fixes MUST NOT be the person's to change while that profile is active: it MUST be shown as a value naming the profile, with no control, and the automation surface MUST refuse it, naming the profile.
- **FR-014**: A profile that fixes no export resolution MUST leave it to the clip size, exactly as an app with no profiles does.
- **FR-015**: The export resolution a profile fixes MUST travel with the profile — outliving the clip, the page and the session — and MUST be frozen for a session from the moment it begins to capture, as every controlled item is.
- **FR-016**: The export resolution MUST use the app's existing profile machinery — declared, applied to a clip made under the profile, and shown with the **lock** that names the profile — and MUST NOT add a second kind of configuration.

**Bounds, keeping and refusal**

- **FR-017**: An export resolution MUST be even on both edges, and a size the app does not offer MUST be refused rather than kept, so a hand-written profile or snapshot cannot leave a clip waiting on a size the app cannot write.
- **FR-018**: An export resolution larger than the clip size MUST be allowed — the picture is scaled up, aspect kept — and one larger than the app's own ceiling MUST be refused, with the reason said.
- **FR-019**: A size the browser cannot encode MUST be reported by the export with the reason said, exactly as the clip size is today.
- **FR-020**: The export resolution MUST be kept with the clip and come back after a reload, and the one **undo** MUST take back the person's own change to it — never a value a profile is holding.
- **FR-021**: A **publish** MUST write its file at the export resolution, and the **aspect ratio** the post shows MUST be derived from it.

### Key Entities *(include if feature involves data)*

- **Clip size**: the frame the clip is worked in and shown at — the largest width and height among its takes, both even — into which every take is fitted whole and centred. It is derived from the takes and is **not** changed by this feature.
- **Export resolution**: the size the clip's file and publish are finally written at — a width and a height, both even — as a property of the clip. It is **optional**; with none, the clip size is used. It is the clip size **scaled** by one factor, so it keeps the clip size's aspect ratio: the file holds the same picture as the review, at fewer (or more) pixels, with nothing cropped, stretched or letterboxed. It decides the file's size, because the encoder's bitrate follows its picture. A **profile** may fix it.
- **Resolution choice**: one of the sizes the app itself offers, so a person chooses rather than types a size the app cannot write; it includes the option that gives the size back to the clip size.
- **Profile declaration**: what a profile says about the export resolution — that it controls it, and the size it is fixed at — which is the same declaration shape the logo, add to export, annotation colour and sound boost already use.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person can make a clip's file smaller by setting the export resolution, in one choice from the clip's settings, without changing the clip or the review.
- **SC-002**: For the same clip and length, a lower export resolution writes a smaller file, in 100% of exports; and with no export resolution set the file is exactly today's — the clip size — in 100% of exports.
- **SC-003**: Every exported file's width and height equal the export resolution exactly, on every target, in 100% of exports and publishes.
- **SC-004**: The whole of every take is still in the file, in the clip size's aspect ratio — nothing cropped, stretched or added — in 100% of takes, whatever the export resolution.
- **SC-005**: The review and the clip size are unchanged by the export resolution: 100% of takes are still fitted into the clip size exactly as before.
- **SC-006**: 100% of clips made under a profile that fixes the export resolution are written at exactly that resolution, with nothing to press.
- **SC-007**: An export resolution a profile fixes cannot be changed by the person or by an agent, in 100% of cases, and the refusal names the profile.
- **SC-008**: A set export resolution comes back after a reload, in 100% of cases, and 100% of clips with none are written at the clip size.
- **SC-009**: Adding the export resolution changes the outcome of no existing check (no regression): the review, the cuts, the annotations, the title card, the watermark, the existing exports and the publish are otherwise untouched.

## Assumptions

- **The clip size is unchanged.** It stays the frame the person works in and every take is fitted into, derived from the takes as it is today (`008-clip-size` stands); controlling the export size is done by a second size, not by making the clip size settable.
- **The export resolution is a new, optional clip property**, told apart from the clip size: the clip size is what the person works in, the export resolution is what the file is written at. Its default is the clip size.
- **"Export resolution" is a new word for `GLOSSARY.md`**, written before it appears in code, beside the existing **clip size**, which does not change meaning.
- **The export resolution keeps the clip size's aspect ratio**, because it is the clip size scaled, both edges even: the file is the same picture as the review at a different number of pixels — never cropped, stretched or letterboxed. A resolution larger than the clip size is allowed, scaling the picture up; the app does not refuse a bigger file for that reason alone.
- **The app offers a list of resolutions** for that shape — the app's own, chosen from rather than typed — with the clip size as the default. The exact ladder (for example 2160p, 1440p, 1080p, 720p, 480p, and the clip size) and how a size names the clip's shorter or longer edge are planning details.
- **The file size is controlled by the resolution alone.** The encoder's bitrate follows the picture — the app's flat 4 Mbps floor, which made every level under about 1080p write the same size, became a **share** of what the picture asks (`videoBitrate`, `src/infra/export-target.ts`) — so a smaller resolution writes a smaller file, and no separate quality or bitrate control is added.
- **The export resolution applies wherever a file is written** — the WebM download, the MP4, the file for editing and a publish — because each writes a file, whatever is then done with it.
- **A profile fixes it as it fixes the clip's other items**, through the same register and the same **lock**; a declaration for it in a profile written by a later version is kept even if a build does not know it, exactly as the other items are.
- **The person's choice is a clip property**: kept with the clip, announced like every other change, and taken back by the one **undo**; when a profile fixes it, it is the profile's and the undo never puts it back.
- **The review does not reframe.** The person sees the size the file will be in the clip's settings, not as a differently-shaped preview — the clip size remains the review's own frame.
- The app stays pure-browser and serverless: the export resolution changes nothing about where a clip goes or what leaves the machine.
