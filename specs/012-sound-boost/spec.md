# Feature Specification: Sound Boost

**Feature Branch**: `feat/sound-boost`

**Created**: 2026-11-25

**Status**: Draft

**Input**: User description: "add an audio boost option to improve the audio after it is recorded. The goal is to cover what it is done in the AI agent improve audio recipe based on ffmpeg, but inside DemoClip so it is always available. By default, this option must be activated by default and it is defined in the Profile."

## Clarifications

### Session 2026-11-25

- Q: Which of the *improve the sound* recipe's steps does the boost perform? → A: **Loudness with peak safety alone.** The sound is brought to the app's target and held below its peak ceiling; the recording's channels, its low end and its dynamics are left exactly as they were. The recipe's mono fold-down, rumble high-pass and presence lift are not performed.
- Q: Is the boosted sound what the person hears in the review, or only what the exported file carries? → A: **Review and export alike.** What the review plays and what the file carries are the same boosted sound, produced the same way.
- Q: One target, a choice of targets, or the destination's own? → A: **One speech target**, fixed for the build — about **−16 LUFS** integrated, with a true-peak ceiling near **−1.5 dBFS**. Not a choice, and not chosen per destination.
- Q: Is the switch set — and so in force — before the recording starts? → A: **Yes, before the first take.** The value is applied to the **empty clip**: at start-up, at **New**, and when a profile is chosen, which is possible until capture begins. A recording therefore starts already boosted, or already un-boosted under a profile that fixes it **off**. "On by default" is the **property's own default**, not a declaration in the built-in **Empty** profile, which declares nothing by design. The switch is drawn in the clip's settings, which the app shows in the **review** — so a person decides it before recording **through a profile**, and while the item is free may still move it in the review. It never changes what a take captures: the boost is applied to the sound *after it is recorded*.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A recording that plays at the loudness players expect, without being asked (Priority: P1)

A person records a take of their voice — a demo, a note, a screencast — and the
microphone was a little far, so the take is quiet against what a player
delivers. The app has **boosted the sound** for them: in the review the voice plays at a
confident loudness, and the file they export carries the same. They asked for
nothing and set nothing: **Boost the sound** is on for a clip from the moment it is made.

**Why this priority**: This is the whole feature. It is what the *improve the sound*
recipe used to need a machine with ffmpeg for, made part of the app so it is always
available. Without it there is nothing.

**Independent Test**: Record a quiet voice take, listen in the review, export the clip,
and measure the exported sound's loudness: it is near the app's target and below the peak
ceiling. Compare it with the same clip with the boost off: the two are not the same, and
the boosted one is at the app's target loudness.

**Acceptance Scenarios**:

1. **Given** a clip holding a quiet voice take and no profile active, **When** the person presses ▶ in the review, **Then** the sound plays boosted, at the app's target loudness rather than the recorded one.
2. **Given** the same clip, **When** the person exports it, **Then** the file's sound is the boosted sound, measured near the target and never above the peak ceiling.
3. **Given** a clip the person has not opened the settings of, **When** it is made, **Then** **Boost the sound** is on and has been applied — nothing had to be pressed.
4. **Given** a clip whose sound is already at the target, **When** the boost applies, **Then** the sound is left essentially as it was: the boost lifts a quiet recording instead of riding a correct one higher.

---

### User Story 2 - The recording is kept, and the boost is the person's to turn off (Priority: P2)

Not every recording wants a studio voice. A person who captured music, a room tone or a
sound they want exactly as it was turns **Boost the sound** off: the review plays, and the
export writes, the take's own sound, as it was recorded — and turning it back on returns
the boosted sound.

**Why this priority**: A boost applied to everything, with no way back, would be a lie
about what was recorded. The switch is what makes it safe to have on by default.

**Independent Test**: Record a take, turn **Boost the sound** off, and confirm the review
plays the recorded sound and the exported file carries it; turn it on and confirm both
change to the boosted sound. Confirm the take itself was never altered.

**Acceptance Scenarios**:

1. **Given** a clip with **Boost the sound** on, **When** the person turns it off in the clip's settings, **Then** the review plays the take's own recorded sound, unchanged.
2. **Given** the same clip with the boost off, **When** the person exports it, **Then** the file carries the recorded sound, not the boosted one.
3. **Given** a clip whose boost was turned off and on again, **When** it is exported, **Then** the sound is the boosted sound — the takes were never modified in between.
4. **Given** any clip, **When** the boost applies, **Then** the picture is untouched: only the sound changes.

---

### User Story 3 - A profile fixes the boost, so a way of working cannot get it wrong (Priority: P2)

A way of working needs one answer. **DemoClipTV** fixes **Boost the sound** on, so a clip
made under it carries the boost with nothing to press and nothing to forget. Another
profile fixes it **off**, for a channel that publishes the recording as it was captured.
Under a profile that fixes it, the clip's settings show the value with the lock naming the
profile and offer nothing to press — the same guardrail the app already gives **Add to
export** and the **logo**.

**Why this priority**: The user's own words put this option *in the profile*. It is how a
production environment guarantees its sound, which is why the item must be one a profile
may control rather than a setting buried in the clip.

**Independent Test**: Define a profile that fixes **Boost the sound** off, make a clip
under it, and confirm the row reads as fixed by the profile with no control and that the
export carries the recorded sound; switch to a profile that fixes it on and confirm the
opposite. With the built-in **Empty** active, the same row is an ordinary switch.

**Acceptance Scenarios**:

1. **Given** a profile that fixes **Boost the sound** on, **When** a clip is made under it, **Then** the clip's settings show the boost as a value naming the profile, with no control, and the clip is boosted.
2. **Given** a profile that fixes **Boost the sound** off, **When** a clip is made under it, **Then** the clip is not boosted and the row names the profile.
3. **Given** the built-in **Empty** active, **When** the person opens the clip's settings, **Then** **Boost the sound** is an ordinary switch, on by the app's own default.
4. **Given** a clip whose boost a profile fixes, **When** an agent asks the app to change it, **Then** the app refuses and says which profile fixes it.
5. **Given** a profile's own sheet, **When** the person sets **Boost the sound** to **Free**, **On** or **Off**, **Then** the profile does exactly that — the three are told apart, as they are for **Add to export**.

---

### Edge Cases

- **A clip with no sound at all**: the boost has nothing to do and changes nothing; the export writes no sound, exactly as before.
- **A sound-only clip** (the microphone alone, no picture): the boost applies to its sound file the same way it applies to a video's sound.
- **An imported take**: it is boosted like a recorded one — the boost works on whatever sound the take carries, and does not care where it came from.
- **Silence, or a stretch quieter than the room**: boosting must not raise a quiet floor into audibility; a stretch with no voice stays where it is.
- **A single sudden peak** louder than the rest of the take: the peak ceiling holds, so the peak does not clip even when the body of the sound is lifted to the target.
- **Two channels or one, low end present or not**: the boost changes the loudness only — the recording's channels, low end and dynamics are left as they were, whether it is a mono microphone or a two-channel capture.
- **A clip already at or above the target**: it lands at the target, not above it — the boost does not make a loud recording louder than the ceiling.
- **Turning the boost off and on while editing**: it changes what is heard and exported and never the takes, and it is not what the app's one **undo** takes back.
- **A profile that fixes the boost once capture has begun**: it is frozen with the profile, like the app's other controlled items.
- **A clip that comes back after a reload**: the switch comes back with it, at the value it held.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST have a clip property — **Boost the sound** — that turns the sound boost on or off for one clip.
- **FR-002**: The switch MUST be **on** by default: a clip made with no profile and no change by the person is boosted.
- **FR-003**: The property MUST be one a **profile** may control — fixed **on** or **off** — so that a controlled value reads as a value naming the profile, with no control, is refused by the clip's panel and by the agent with the profile named, and is frozen for the session once capture has begun, exactly as **Add to export** and the **logo** are.
- **FR-004**: The property MUST be written with the clip, so the switch survives a reload and a clip that comes back comes back with the value it held.
- **FR-005**: When on, the app MUST bring the clip's sound to the app's target loudness and hold it below the peak ceiling, and MUST leave everything else about the recording as it is: its channels, its low end and its dynamics are untouched. The boost is **loudness with peak safety alone** — it neither folds the sound to one channel, nor removes its low end, nor lifts its presence.
- **FR-006**: The treatment MUST NOT touch the recorded takes: the sound a take carries is preserved, and turning the switch off gives back the recorded sound in the review and in the export.
- **FR-007**: The treatment MUST NOT change the picture: a boosted export differs from the same export without the boost in its sound alone.
- **FR-008**: The boosted sound MUST be both what the person hears in the review and what the exported file carries, produced the same way for both: the review must not play a different sound from the one the file gets.
- **FR-009**: The treatment MUST apply to every export that carries sound — the WebM download, the MP4 for Bluesky, the YouTube upload, and a **sound-only** clip's sound file alike.
- **FR-010**: The treatment MUST NOT raise silence or a quiet floor into audibility: a stretch with no voice stays where it is.
- **FR-011**: The app's target MUST be a single **speech target**, fixed for the build and the same for every boosted clip — about **−16 LUFS** integrated, with a true-peak ceiling near **−1.5 dBFS** — and MUST NOT vary by clip, by profile or by destination.
- **FR-012**: A boosted sound MUST never clip: no sample exceeds the peak ceiling in any export.
- **FR-013**: The boost MUST NOT compress the dynamics or remove noise — the recipe's own rule is that a recording whose loudness is already even, and whose floor is already far below the voice, is left alone.
- **FR-014**: An agent MUST be offered the switch exactly as the app's other clip properties are — able to read and set it, and refused with the profile named when one fixes it.
- **FR-015**: Applying the boost MUST NOT be what the app's one **undo** takes back: the undo takes back the person's own last edit, and a boost applied from a profile is not an edit at all.
- **FR-016**: A clip whose sound is already at the target MUST be left essentially unchanged: the boost corrects a quiet recording rather than riding a correct one higher.
- **FR-017**: The feature MUST leave the recorder's flow — what a take captures, and the live preview — exactly as it is today: the boost is applied to the sound *after it is recorded*, never to the capture.

### Key Entities

- **Sound boost**: a clip property — a switch that says whether the clip's sound is treated. On by default. A **profile** may fix it **on** or **off**, like **Add to export** and the **logo**.
- **The app's target**: the loudness and the peak ceiling a boosted clip is brought to. Fixed for the build this iteration; stated as numbers in the Success Criteria.
- **The treatment**: what the boost does to the sound — bringing it to the app's target loudness with peak safety, the loudness part of the *improve the sound* recipe — kept off the takes and applied to the sound as it is heard and exported. Not state of its own; named here because the requirements speak of it.
- **Reused, not new**: **profile**, **declaration**, **controlled item**, **clip property** — the boost is a further item over the machinery that already carries **Add to export**, **logo** and **annotation colour**.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A quiet spoken clip exported with the boost on measures within ±1 LU of the app's target integrated loudness, and no sample exceeds the peak ceiling, in 100% of exports.
- **SC-002**: A clip recorded already at the target stays within 1 LU of where it was: the boost corrects rather than riding a correct recording higher.
- **SC-003**: What the person hears in the review and what the exported file carries are the same boosted sound — equal within 1 LU — in 100% of cases.
- **SC-004**: With the boost off, the exported sound is the recorded sound, in 100% of cases, and the takes are unchanged by any use of the boost: turning it off gives the recording back whole.
- **SC-005**: The picture of a boosted export is identical to the picture of the same export without the boost, in 100% of cases.
- **SC-006**: A clip made under a profile that fixes the boost takes the profile's value with no input from the person, in 100% of cases, and any refusal names the profile.
- **SC-007**: A person can turn the boost off and on again in one press each, hearing the change at once, in 100% of cases.
- **SC-008**: A clip's boost value survives a reload, in 100% of cases.
- **SC-009**: A person who never opens the clip's settings gets a boosted sound from every clip that has sound, in 100% of cases.
- **SC-010**: A boosted sound keeps the recording's channel layout and its low end: only its loudness changes, in 100% of cases.

## Assumptions

- **"Audio boost" is the user's word for what this project calls the sound** of a clip — the audio a take carries (`docs/GLOSSARY.md`). The item is a **sound boost**, and the code, the tests and the messages use the project's word.
- **On by default is the property's own default, not a declaration.** The built-in **Empty** profile declares nothing by design, so a clip made under it is boosted because the switch itself defaults on; a profile may still fix the item **on** or **off**.
- **The target is a speech target**, in the recipe's own terms — the web/podcast one, about **−16 LUFS**, with a true-peak ceiling near **−1.5 dBFS** — and it is the app's **one** target: the same for every clip, not a choice and not per destination. It is a speech target because DemoClip's recording is mostly voice and that is where the recipe starts; a clip of music gets the same treatment, and a person who wants it raw turns the switch off.
- **The boost performs the recipe's loudness step and none of its others.** The mono fold-down, the rumble high-pass and the measurement-driven presence lift are not performed, and neither are compression or noise removal (which the recipe itself warns against). What the boost does is bring the sound to the target with peak safety and change nothing else.
- **The picture is kept bit for bit**, as the recipe insists, and the work is done offline as the export already is, so the boost adds no wait the person watches.
- **The switch reuses the app's existing machinery**: a further clip property declared to the app, and therefore a further item a profile may fix. No new kind of item and no new surface.
- **The boost lives on the clip, not in a profile, a file or a sidecar**: a profile only fixes the value on the clip, and nothing about the boost is written into an exported file's metadata or a sidecar.
- **This replaces the loudness step of the *improve the sound* recipe**: the recipe measured with `ffmpeg` and brought a file back as a take; the app now brings its own sound to the target and always has it. The recipe is updated or retired in the same change that ships this feature.
- **The word is written into `docs/GLOSSARY.md`** before it appears in code, as the project's rule requires.
