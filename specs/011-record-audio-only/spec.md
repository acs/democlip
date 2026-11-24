# Feature Specification: Recording Audio Only

**Feature Branch**: `feat/audio-only`

**Created**: 2026-11-24

**Status**: Draft

**Input**: User description: "Add support for recording only audio"

## Clarifications

### Session 2026-11-24

- Q: Which sound can a sound-only take be made from? → A: The microphone alone. The screen and webcam remain picture sources; a sound-only take is the microphone with neither of them on.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record a take of sound alone (Priority: P1)

A person wants to record a spoken note, a podcast segment or a voice-over without sharing a screen or a camera. With only the **microphone** on, they press **Record** and the app makes a **take** of sound alone. While it runs the app says the take is **sound-only** and the preview says the same, rather than showing a picture that belongs to something else. They stop, and the **review** opens on the take: the **waveform** where the thumbnails would be, the length and the playhead, and the recorded sound plays.

**Why this priority**: Without this nothing else exists. Today **Record** refuses when no picture source is on, so a person cannot make a sound-only recording at all.

**Independent Test**: With the screen and webcam off, turn the microphone on, press **Record** for a few seconds, stop, and confirm that a take arrived, that the review shows a waveform and no picture, and that **▶** plays the recorded sound.

**Acceptance Scenarios**:

1. **Given** every source off, **When** the person presses **Record**, **Then** no take starts and the app says a source must be on, naming the screen, the webcam and the microphone.
2. **Given** only the microphone on, **When** the person presses **Record**, **Then** a take starts, the app says the take is sound-only, and the recording indicator and timer show it is running.
3. **Given** a sound-only take running, **When** the person presses **Record** again, **Then** the take is added to the clip with its real length and the review opens on it.
4. **Given** a sound-only clip in the review, **When** the person presses **▶**, **Then** the recorded sound plays and the playhead travels over the waveform; no picture is shown.
5. **Given** a sound-only clip in the review, **When** the person marks a stretch and cuts it out, **Then** the cut leaves the timeline and the remaining sound closes up, exactly as a picture clip's cuts do.
6. **Given** a microphone that provides no sound track at all, **When** the person presses **Record**, **Then** no take is added and the app says nothing came from the source.

---

### User Story 2 - The sound leaves as a file, and comes back (Priority: P2)

A person exports a sound-only clip and gets a **sound file**: WebM or MP4, holding the kept sound and no picture. The file plays in an ordinary player, it can be **imported** back as a take, and a reload or an update brings the clip back still sound-only.

**Why this priority**: A recording that cannot leave the app is not finished. The export is why the person recorded.

**Independent Test**: Record a sound-only clip, export WebM and MP4, and confirm that each file plays the recorded sound, presents no picture, and can be imported back as a take. Then reload and confirm the clip comes back in the review.

**Acceptance Scenarios**:

1. **Given** a sound-only clip in the review, **When** the person exports WebM, **Then** the downloaded file holds the kept sound and no picture.
2. **Given** the same clip, **When** the person exports MP4, **Then** the downloaded file holds the kept sound and no picture.
3. **Given** an exported sound-only file, **When** the person imports it, **Then** it becomes a sound-only take, is appended to the clip and the review opens on it.
4. **Given** a sound-only clip, **When** the page is reloaded, **Then** the clip comes back in the review as sound-only, with its cuts and its length.
5. **Given** a sound-only clip, **When** the person exports it, **Then** the file carries no title card and no watermark, and the app has not silently ignored a request for one: the control says why it cannot apply.
6. **Given** a sound-only clip in the review, **When** the timeline header shows the estimated size, **Then** it is an estimate for the audio alone rather than for a video.

---

### User Story 3 - A clip that holds sound and picture (Priority: P3)

A person records a sound-only take and later turns the screen on and records a picture take into the same clip, or starts with a picture and adds a voice note. The clip holds both. In the review the picture take shows its picture and the sound-only take shows a plain black stretch. The exported file is a video, with black over the sound-only stretch, so its sound and picture stay in step. A clip whose kept stretches have no picture at all exports as sound only, and a video service is not offered for it.

**Why this priority**: A take is a take, and the app already lets a clip grow by appending. Refusing to mix the two would make a person start over. It is P3 because the basic sound-only recording and its file do not depend on it.

**Independent Test**: Start a clip with a sound-only take, add a picture take, review and export. The file is a video whose picture is black over the sound-only stretch and the picture take's own over the rest. Cut the picture take away entirely and export: the file is sound only.

**Acceptance Scenarios**:

1. **Given** a sound-only take in the clip, **When** a picture take is appended, **Then** both play in order and the clip remains exportable.
2. **Given** a clip with both kinds of take, **When** the person exports, **Then** the file is a video whose picture is black over the sound-only stretch and the picture take's own over the rest, and every stretch keeps its sound.
3. **Given** a clip with both kinds of take, **When** every picture stretch is cut away, **Then** the export is a sound file with no picture.
4. **Given** a clip whose kept stretches have no picture, **When** the person opens the **Export** menu, **Then** the file destinations are offered and the two video-service destinations are not.
5. **Given** a clip with a picture, **When** the person records, reviews and exports, **Then** its picture, sound, cuts, annotations, title card and publish behave exactly as they do today.

---

### Edge Cases

- **Every source off**: **Record** refuses and names the three sources; nothing is captured.
- **Microphone on, no picture source**: the take is sound-only; pressing **Screen** still shares, and the next take is a picture take.
- **A shared screen whose sound is wanted without its picture**: not a sound-only take. The screen is a picture source; turning it on records its picture with its sound. To record sound without a picture, the person uses the microphone alone.
- **Microphone goes away while armed**: the source turns off as it does today, and **Record** says a source is needed rather than starting a take with no sound.
- **A sound-only take whose source provides no audio track at all**: it is refused with a reason rather than added as an empty take. Silence is not this case: a quiet stretch of a microphone that is working is recorded like any other sound.
- **Sources are locked while a take runs**: switching one does not change what the running take is.
- **All picture stretches cut away**: the kept clip has no picture, so the export is sound only, even though the recording held picture takes.
- **A clip with a picture and a sound-only stretch**: the picture is unchanged over the picture stretches and black over the sound-only one; no stretch loses its sound.
- **Annotations on a sound-only clip**: there is no picture to draw on, so the annotation actions are not offered; cutting and the clip's properties remain. On a mixed clip, annotations remain as they are, including over a black sound-only stretch.
- **A title card, a logo or a watermark on a sound-only clip**: there is no picture to draw one on, so the sound file holds none, and the app says why the card is not available rather than ignoring the request.
- **A profile that fixes a logo or "add to export"** while a sound-only clip is made: the values are kept with the clip as usual, and the sound file carries no card or watermark because it has no picture.
- **A clip's size**: it follows picture takes only. A sound-only clip has no size, and the app does not invent one; this does not block recording, reviewing or exporting.
- **Cuts and the one undo** on a sound-only clip: a cut, a change to the clip's words and the undo behave exactly as they do for a picture clip.
- **Reload, a new version or a Bluesky sign-in trip**: a sound-only clip is written down and read back like a picture clip, and its sound and sound-only nature survive.
- **Importing a sound file from another app**: a sound file in WebM or MP4 is taken like the app's own; another container is refused as it is today.
- **A sound file with no measurable length**: refused as today, because a take cannot be built without a length.
- **A video service**: a clip whose kept stretches have no picture is refused before anything is encoded or uploaded, with a reason, and its entries are not offered in the menu.
- **A browser that cannot write the sound**: the export reports the refusal in the app's own words, as it does for video today.
- **An agent**: a take starts with only the microphone on, an export writes the sound file, and a publish is refused for a sound-only clip; with every source off, the refusal names the three sources.
- **New with the microphone still on**: the next clip starts fresh and is still armed for sound-only.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: **Record** MUST start a take when only the microphone is on. It MUST be refused only when none of the three sources is on, and the refusal MUST name the screen, the webcam and the microphone.
- **FR-002**: While a sound-only take is armed or recording, the app MUST say that the take is sound-only, in the status and on the preview, instead of showing a picture that is not part of the take.
- **FR-003**: A sound-only take MUST have a measured length and MUST be added to the clip like any other take; the clip's length remains the sum of its takes.
- **FR-004**: A sound-only take MUST carry no picture, and MUST NOT contribute to the clip's picture size.
- **FR-005**: The review of a sound-only clip MUST show the waveform where the thumbnail strip would be, with the length, the playhead and the cut marks; playback MUST play the recorded sound; marks, cuts, the one undo and the clip's properties MUST work as they do for a picture clip.
- **FR-006**: The export of a clip whose kept stretches have no picture MUST write the sound alone, in the same two containers the app already writes, with no picture in the file.
- **FR-007**: The export of a clip with at least one kept picture MUST write a video: every kept stretch of a sound-only take MUST be presented as a plain black picture with its sound, and every stretch of a picture take MUST be presented with its picture exactly as today.
- **FR-008**: Whether the file is sound-only or a video MUST be decided from the stretches the export keeps, not from takes that were cut away.
- **FR-009**: A sound-only file MUST keep the app's download naming and one of the two existing containers; no new container is introduced.
- **FR-010**: A sound file in WebM or MP4 MUST be importable as a sound-only take; every other container remains refused exactly as today.
- **FR-011**: A sound-only clip MUST be kept and restored across a reload exactly as a picture clip is, with its length, cuts and sound-only nature intact.
- **FR-012**: Publishing MUST be refused for a clip whose kept stretches have no picture, before anything is encoded or uploaded, with a reason a person can act on; the two video-service destinations MUST NOT be offered in the **Export** menu for that clip.
- **FR-013**: A sound-only export MUST NOT carry a title card or a watermark. While the clip has no picture, its **Add to export** control MUST say why the card cannot be drawn, rather than accept a request the file cannot honour; a **logo** the clip wears is kept with the clip and draws nothing on a sound file.
- **FR-014**: On a clip with no picture, the annotation actions MUST NOT be offered. On a mixed clip they remain available, including over a sound-only stretch.
- **FR-015**: The export size estimate in the timeline header MUST be an estimate for the audio alone when the clip has no picture.
- **FR-016**: The app's automation surface MUST offer the same behaviour: a take MAY start with only the microphone on, an export of a sound-only clip MUST write the sound file, and a publish MUST be refused with the reason; the refusal for no source MUST name the three sources.
- **FR-017**: A take with no audio track at all MUST NOT be added as a sound-only take; the app MUST refuse it with a reason rather than keep an empty take. A silent stretch of a working microphone is a normal sound-only take and MUST be kept.
- **FR-018**: Every behaviour of a clip with a picture MUST be unchanged: recording, review, playback, cuts, annotations, the clip's properties, the title card, the export and publishing.
- **FR-019**: A sound-only clip MUST have no picture size, and the clip's size MUST follow picture takes alone. Having no size MUST NOT block recording, reviewing or exporting the clip.
- **FR-020**: A sound-only take MUST be made from the microphone alone. A shared screen's sound MUST NOT be a sound-only mode: while the screen or the webcam is on, a take carries its picture, as it does today.

### Key Entities

- **Sound-only take**: a take made with the microphone alone. It has a length and sound, and no picture; it has no picture size and contributes none to the clip's size.
- **Sound-only clip**: a clip whose takes carry no picture. Its review is its waveform, its file is the sound alone, and a video service cannot take it.
- **Mixed clip**: a clip holding both picture takes and sound-only takes. Its file is a video; the sound-only stretches are black.
- **Clip size**: the picture the clip is shown and written at. It follows picture takes only; a sound-only clip has none.
- **Sound file**: the file a sound-only clip exports: the kept sound in one of the app's two containers, with no picture.
- **Video service destination**: a place a clip can be published to, which takes a video and therefore cannot take a sound-only clip.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person can record, review and export a sound-only clip without turning on the screen or the webcam, in one pass, with the file arriving in the browser's downloads.
- **SC-002**: Every sound-only file the app writes, in either container, plays its recorded sound and presents no picture in an ordinary player.
- **SC-003**: A sound file the app exported can be imported back and plays as a take, and a sound-only clip comes back unchanged after a reload, cuts included.
- **SC-004**: In a mixed clip, the exported video's picture is black exactly over the sound-only stretches and the picture take's own over the rest, and no stretch loses its sound.
- **SC-005**: A clip with no picture offers zero video-service destinations, and any attempt to publish it is refused with a reason before anything is encoded or uploaded.
- **SC-006**: A clip with a picture behaves exactly as it does today: its exported file still holds its picture and sound, and nothing it accepted before is refused.
- **SC-007**: The export size estimate for a sound-only clip is within the audio file's own order of magnitude, so the header never claims a video-sized file.
- **SC-008**: All acceptance scenarios for the first user story pass in a real browser with a stand-in microphone, and a clip with a picture still passes every check it passed before this feature.

## Assumptions

- **The chosen export shape**: a sound-only recording leaves as a **sound file with no picture**, not as sound over a black picture. This was the person's choice when the feature was first discussed.
- **The containers stay the same**: WebM and MP4 are the two the app writes and reads; no audio-only format such as MP3 or WAV is added.
- **A video service takes a video**: Bluesky and YouTube are not offered for a sound-only clip, and an attempt is refused rather than uploading a sound file that the service would reject.
- **The microphone is the only sound-only source**: there is no system-audio-only mode; a sound-only take is the microphone's.
- **A sound-only clip has no picture, so no annotations and no card**: cuts, the clip's properties, the undo and keeping the clip all remain. The card and watermark return when the clip gains a picture take.
- **Mixing is allowed**: a clip holds sound-only and picture takes together, with black over the sound-only stretches in a video file. This follows the app's existing rule that a take is a take, whatever it was made from.
- **Import follows export**: a sound file in the app's two containers is a take, so a clip that leaves as sound can come back as sound.
- **The recording remains local and offline**: nothing about this feature sends a recording anywhere; publishing stays optional and is refused for a sound-only clip.
- **Existing behaviour and performance are the standard**: a picture clip records, reviews and exports as it does today, at the same speed and with the same files.
- **The words**: **sound-only** names a take or clip of sound and no picture, and **picture** is what a screen or webcam take carries. The glossary will record these words with the feature.