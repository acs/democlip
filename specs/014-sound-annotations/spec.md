# Feature Specification: Sound Annotations

**Feature Branch**: `sounds-annotations`

**Created**: 2026-11-25

**Status**: Draft

**Input**: User description: "Let's add Sound Annotations in the same way we add the visual ones. In the preferences we will select the sound to be added, which must be mixed with the recorded audio. In this MVP we will have some stock sounds (claps, gong) already available and the sound will be selected from them (you can not load sounds)."

## Clarifications

### Session 2026-11-25

- Q: Is the stock sound chosen for each sound annotation separately, or is one sound chosen for the clip and mixed into the recording? → A: **Per annotation.** Each sound annotation names its own stock sound — chosen when it is placed and changed in that annotation's **preferences** — and a clip may hold several, including ones that overlap. There is no single clip-wide "sound to add".
- Q: Since a sound has nothing to draw, how should a sound annotation be found and picked for editing? → A: **On the timeline lane alone.** A sound annotation is found and picked on the **annotation lane**, by the mark at the start of its stretch that every annotation already gets; the picture shows nothing for it, ever, and its preferences open from the picked state.
- Q: When the clip's sound boost is on, should it treat only the recorded sound or the added sounds as well? → A: **The recorded sound alone.** The boost is measured from and applied to the recording exactly as today; an added sound is mixed in at its own level over the boosted recording, so placing one never changes the boost's gain nor the recording's loudness.
- Q: Should an added sound play at one level the app chooses, or should the person set a volume for each sound annotation? → A: **One fixed level.** Every sound annotation plays at a level chosen for the build, loud enough to sit clearly over a voice, with no volume control in this MVP; a **volume** is a property a later iteration can add to the kind.
- Q: Should an added sound start and end abruptly at its stretch, or fade in and out at its edges? → A: **Abruptly, at full level.** The stock sound is played as it is, at full level, for the whole of its stretch, with no fade the app adds — a sound effect's attack is the point, and the app's sounds carry their own shape.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A stock sound over a stretch, heard with the recording (Priority: P1)

A person is reviewing a finished clip. A moment wants a sound: a chime where
the demo lands, a gong where something falls over. They select the stretch where it should
play, choose **Sound** from the annotate options, pick **Chime** from the sounds the app
already has, and the sound is placed over that stretch. In the review the chime plays
*with* the recorded voice — not instead of it — and the file they export carries the same
chime at the same moment.

**Why this priority**: This is the feature. A sound placed over a stretch, mixed with the
recording, heard in the review and in the export, is the smallest thing worth shipping, and
it is what every later refinement — changing the sound, its duration — stands on.

**Independent Test**: With a finished clip in review, select a stretch, add a **Sound**,
choose **Chime**, then play the clip and export it — the chime is heard over that stretch
and nowhere else, together with the recorded sound, in both the review and the file.

**Acceptance Scenarios**:

1. **Given** a clip in review, **When** the person selects a stretch and adds a **Sound**, choosing one of the app's stock sounds, **Then** that sound plays mixed with the recorded sound over that stretch.
2. **Given** a clip with a sound annotation, **When** the playhead moves outside its stretch, **Then** the sound is not heard.
3. **Given** a clip with a sound annotation, **When** the clip is played in the review, **Then** the sound is heard at the same moment as when it was placed, together with the recording.
4. **Given** a clip with a sound annotation, **When** the clip is exported (a downloaded file or a published post), **Then** the sound is heard at the same moment and mixed the same way as in the review.
5. **Given** a clip whose takes carry no sound at all, **When** the person adds a sound annotation, **Then** the export carries sound — the annotation's — where before it carried none.

---

### User Story 2 - Choose which sound, and change everything about it (Priority: P2)

The stock sound chosen was not the one wanted, or the moment is the wrong length, or the
whole thing was a mistake. The person picks the sound annotation on the timeline, opens its
preferences and chooses **Gong** in place of **Chime**, or changes how long it plays, or
copies it to another moment, or deletes it and takes the deletion back with the one undo —
all of it the same gestures every other kind already has.

**Why this priority**: A sound that cannot be corrected is a mistake that cannot be
undone. It is below the first story because one correct placement already delivers the
value, and above the third because choosing the sound is what the user's own words put in
the preferences.

**Independent Test**: Add a sound annotation, pick it, change its sound in the preferences
and hear the change; change its duration; copy it to another moment; delete it and undo —
each change shown in the review and the export.

**Acceptance Scenarios**:

1. **Given** a clip with a sound annotation, **When** the person picks it and chooses another of the app's stock sounds in its preferences, **Then** the review and the export play the new sound over the same stretch.
2. **Given** a picked sound annotation, **When** the person changes its duration in its preferences, **Then** the sound plays for the new length and no longer.
3. **Given** a sound annotation, **When** the person copies it and pastes, **Then** a new sound annotation of the same sound and length appears at the playhead, editable on its own without touching the first.
4. **Given** a sound annotation, **When** the person deletes it, **Then** it is no longer heard, and the deletion can be undone with the one undo that also takes back a cut or any other annotation.
5. **Given** a clip with sound annotations, **When** the page is reloaded or the trip to publish sign-in is taken, **Then** every sound annotation comes back in place with the sound and length it held.

---

### User Story 3 - It is a kind among the kinds, and it fits the whole clip (Priority: P3)

The sound is not a special case bolted beside the annotations: it is a kind of annotation,
so it is added in the one place the kinds are added, found on the timeline lane, kept with
the clip, cut and exported with everything else — and adding it changes nothing about the
arrow, the image, the text or a cut. It also works where a picture does not: a clip of sound
alone, where the visual kinds are not offered at all, still takes a sound.

**Why this priority**: It delivers no new user-visible value on its own, but it is what
makes the sound safe to add: the family keeps its promises, and the feature reaches the
clips the visual kinds cannot touch. It is last because the sound working at all comes
first.

**Independent Test**: Confirm every arrow, image, text and cut behaves exactly as before
with the sound kind present, and add a sound annotation to a sound-only clip and hear it in
the review and the export.

**Acceptance Scenarios**:

1. **Given** the sound kind in place, **When** any arrow, image, text or cut is used, **Then** its behaviour and its outcome are unchanged.
2. **Given** a **sound-only** clip (no picture), **When** the person opens it in review, **Then** the visual kinds are not offered but **Sound** is, and a sound annotation can be added and heard.
3. **Given** a clip written down by a later version that carries a stock sound this build does not know, **When** the clip is opened, **Then** that annotation is left out and the rest of the clip opens and plays.
4. **Given** a clip with a sound annotation, **When** it is exported, **Then** the picture of the export is identical to the same export without the sound annotation.

---

### Edge Cases

- **A sound-only clip** (the microphone alone, no picture): sound annotations can be added, where the visual kinds cannot, and they are heard in the review and in the sound file the export writes.
- **A clip whose recorded sound is silent or absent**: a sound annotation is still heard, and a clip that had no sound carries sound once one is added.
- **Two sound annotations that overlap in time**: both are heard, mixed together with the recording, each over its own stretch.
- **A cut through a sound annotation's stretch**: only the kept part is heard; a cut that removes the whole stretch leaves the sound with nowhere to play, and putting the cut back brings it back.
- **A very short stretch** — a fraction of a second: the sound still plays, and must not become impossible to pick on the lane.
- **A sound annotation is added with no stretch selected**: it is placed over the default stretch at the playhead, exactly as a new annotation of any other kind is, and its duration can then be changed.
- **The clip grows** with a new take after a sound was placed: the sound stays over the same moments it was placed on.
- **A stock sound the app no longer serves**, or one that will not decode: the export must not fail; the annotation is left out of what is heard and written, and the person is told, rather than the whole file failing.
- **A paste at the very end of the clip**: the copy's stretch is pulled back inside the clip, as for any annotation, rather than left hanging past the end.
- **The clip's sound is boosted**: adding a sound annotation changes neither the loudness measure the boost is taken from nor the boost's effect on the recording; the added sound is heard over the boosted recording.
- **A sound annotation and the one undo**: placing or deleting one is the person's own edit and is what the undo takes back.
- **A sound annotation in a file for editing** (the export that carries its annotations beside it rather than drawing them in): the annotation is carried beside the file and read back in place, the way text, image and arrow annotations are.
- **The stock sound is the app's own**: a sound annotation never waits on a download and never asks the person for a file; a clip holds only the name of the sound it uses, so a clip is small and moves like the cuts do.

## Requirements *(mandatory)*

### Functional Requirements

**The sound annotation**

- **FR-001**: The app MUST offer a new kind of annotation — a **sound annotation** — that places a sound over a stretch of the clip, added in the same place and the same way as the visual kinds: over the selected stretch, or the default stretch at the playhead when none is selected.
- **FR-002**: The sound of a sound annotation MUST be chosen from the app's **stock sounds** — a fixed, built-in list of the app's own sounds (a **chime**, a **gong**, a **pluck** and more). The person MUST NOT be able to load, import or record a sound for it.
- **FR-003**: A new sound annotation MUST be made with one of the stock sounds, so it plays at once, and the chosen sound MUST be changeable afterward from the annotation's **preferences**.
- **FR-004**: A sound annotation MUST be **mixed with the recorded sound**: over its stretch the annotation's sound and the recording are heard together, the annotation adding to the recording rather than replacing it.
- **FR-005**: A sound annotation MUST NEVER change the recording: the takes are not re-encoded and their own sound is preserved, so a clip with every annotation removed carries exactly the sound it was recorded with.
- **FR-006**: A sound annotation MUST be heard only during its stretch and for the whole of it, and MUST be silent outside it. Within its stretch it plays the stock sound as it is, at the app's level for it, with no fade the app adds.
- **FR-007**: Several sound annotations MUST be able to exist at once, including sound annotations that overlap in time, and each MUST be heard over its own stretch.

**Hearing it and writing it**

- **FR-008**: What the person hears in the review and what the exported file carries MUST be the same sound, produced the same way — the review MUST NOT play a different sound from the one the file gets.
- **FR-009**: A sound annotation MUST be included in every output that carries sound — the WebM download, the MP4 for Bluesky, the YouTube upload, a **sound-only** file, and the export that carries its annotations beside it rather than drawing them in — at the same moment as in the review.
- **FR-010**: A clip whose recorded sound is silent or absent, and that holds a sound annotation, MUST export with sound: the annotation's.
- **FR-011**: A sound annotation MUST NOT change the picture of any export: a sound annotation alone is audible, and no output's picture differs because of one.
- **FR-012**: The app's **sound boost** MUST continue to treat the recorded sound as it does today; adding a sound annotation MUST NOT change what the boost measures or how it is applied to the recording, and the annotation is heard over the boosted recording.

**Fitting the family**

- **FR-013**: A sound annotation MUST be kept with the clip, informed to every surface the other kinds inform, and MUST survive a reload and a return from the publishing sign-in.
- **FR-014**: A sound annotation MUST be found and reached on the **timeline lane** — marked at the start of its stretch — and picked there, since it is not drawn over the picture; its **preferences** open from that picked state. Nothing about a sound annotation is drawn over the picture.
- **FR-015**: A sound annotation MUST share the family's editing: it can be picked, copied and pasted as a new one, deleted, and undone with the one undo that covers a cut and every other kind. When it is shown over is set when it is made, from the selected stretch, and repeated at another moment with copy and paste; its length is changed from its own **duration** preference.
- **FR-016**: A cut MUST take its part of a sound annotation's stretch with it, exactly as it takes the picture of a visual annotation: no part of the sound is heard over a stretch that was cut away.
- **FR-017**: Adding the sound kind MUST NOT change how any existing kind of annotation behaves, and MUST NOT change how a cut behaves.
- **FR-018**: The fields of an annotation the app's **automation surface** can read and write MUST extend to a sound annotation, so an agent can place one, read its sound and length, change them, delete it and undo, exactly as for the clip's other annotations.

**Where the visual kinds are not**

- **FR-019**: A **sound-only** clip MUST offer the sound kind, where the visual kinds are not offered, and a sound annotation on one MUST be heard in the review and carried by the sound file the export writes.

**The sounds themselves, and a clip from elsewhere**

- **FR-020**: The stock sounds MUST be the app's own — served with the build, needing no network and no file from the person — so a sound is heard and exported without the person supplying anything.
- **FR-021**: The list of stock sounds MUST be declared by the app in one place, as the app's other lists are (the **logo** list, the palette of colours), so a further sound is added by declaring it and nothing else.
- **FR-022**: A stock sound a build does not know, or one that will not decode, MUST NOT fail the open of the clip or the export: the annotation is left out of what is heard and written, the rest of the clip is intact, and the person is told.
- **FR-023**: A clip MUST hold only the **name** of the stock sound a sound annotation uses, not a copy of its bytes, so a sound annotation is small, is written apart from the recording, and moves with the clip like a cut does.
- **FR-024**: The new words — **sound annotation**, **stock sound** and the list that holds them — MUST be written into `docs/GLOSSARY.md` before they appear in code, as the project's rule requires.
- **FR-025**: A sound annotation MUST be heard at **one level for the build**, with no per-annotation volume, and MUST be mixed with the recorded sound so the recording is always heard beneath it; the person sets no level in this iteration.
- **FR-026**: The app's stock sounds MUST be chosen from a **drop-down** in the annotation's preferences, listing every sound, and the chosen sound MUST be **heard from one play button** beside it — the app's own file, at the level the review and the file mix it at — so the person hears a sound before keeping it, without a play control per sound.

### Key Entities *(include if feature involves data)*

- **Sound annotation**: a new kind of annotation — a **stock sound** shown over a stretch of the clip's time, mixed with the recorded sound. It is an **annotation** like any other: it has an id and a **span**, is kept with the clip, marked on the **annotation lane**, copied, deleted and undone through the shared canvas, and carries one fact of its own — which stock sound it uses.
- **Stock sound**: one of the app's own built-in sounds — a **chime**, a **gong**, a **pluck** — chosen by name from a fixed list. Not a file the person supplies, not recorded, not loaded; the app serves it, and a clip names it rather than carrying it.
- **The stock sound list**: the app's declared set of stock sounds, from which a sound annotation's sound is chosen and shown. Declared in one place, like the **logo** list and the colour palette, so another sound is a further declaration.
- **Annotation preferences**: the surface a kind's own properties are edited on — for a sound annotation, which stock sound it uses and how long it plays (its **duration**). The existing surface, no new kind of control.
- **Reused, not new**: **annotation**, **annotation kind**, **annotation plugin**, **annotation canvas**, **annotation lane**, **annotation duration**, **selection**, **span**, **timeline map**, **clip**, **cut**, **clip snapshot**, **sound**, **sound boost**. The sound kind is a further kind over the machinery that already carries the arrow, the image and the text.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of outputs that carry sound, a sound annotation is heard at the same moment as in the review, mixed with the recorded sound.
- **SC-002**: A person can add a stock sound over a stretch and hear it in the review, mixed with the recording, in under 30 seconds from choosing to add it.
- **SC-003**: The recorded sound is never changed by a sound annotation: removing every sound annotation gives back the take's own sound whole, in 100% of cases.
- **SC-004**: A clip with sound annotations survives a reload and comes back with every sound annotation in place, with its sound and its length, 100% of the time.
- **SC-005**: Placing, changing, copying and deleting a sound annotation are each undone in one action through the same single undo that takes back a cut and any other kind, in 100% of cases.
- **SC-006**: A listener can tell two different stock sounds apart, in the review and in the export, in 100% of cases — the chosen sound is the one heard.
- **SC-007**: A sound annotation added to a clip that had no recorded sound makes the export carry sound, in 100% of cases.
- **SC-008**: The picture of an export with sound annotations is identical to the picture of the same export without them, in 100% of cases.
- **SC-009**: Adding the sound kind changes the outcome of no existing arrow, image, text or cut test (no regression).
- **SC-010**: A stock sound this build does not know never fails to open a clip or an export: the clip opens and the rest is intact, in 100% of cases.
- **SC-011**: A sound annotation can be placed and heard on a **sound-only** clip, in 100% of cases where the clip has sound or gains it from the annotation.

## Assumptions

- **"In the preferences" is the annotation's own preferences** — the panel its settings control opens, where a kind's properties are edited, as an arrow's **colour** and a text's **words** are — and the sound is a property of the sound annotation, chosen per annotation. The same list is offered when the sound is first added, so a sound plays at once, and again in the preferences to change it. There is no single clip-wide "sound preference" separate from the annotations.
- **The stock sounds are fixed for this MVP**: a **chime**, a **gong**, a **pluck** and the rest of the app's seven, served with the app. Nothing is loaded, imported, pasted or recorded, and adding another sound later is a declaration, not a new mechanism.
- **One sound per sound annotation**: an annotation names one stock sound. A place that wants two sounds uses two annotations, which may overlap.
- **The added sound plays at the app's own level for it**, a level chosen for the build that sits the sound clearly over a voice — not a per-annotation volume the person sets, and with no fade the app adds at the ends of the stretch. A volume is a property a later iteration can add, as a kind declares its properties.
- **The sound adds to the recording and never replaces it.** The recorded sound is always heard under a sound annotation; nothing about a sound annotation mutes, ducks or removes the recording.
- **The boost treats the recording.** The clip's **sound boost** is measured from the recorded sound and applied to it, as it is today; the added sound is mixed in at its own level, so placing a clap neither changes the boost's gain nor whether the boost is on. What is heard is the boosted recording with the added sound over it, and what is written is the same.
- **A sound annotation has no shape on the picture.** Its span and its sound are its whole self; it is found and picked on the **timeline lane**, and the shared canvas's picture picking, moving and resizing do not apply to it — there is nothing on the picture to pick, move or resize. Copy, paste, delete, undo and its **duration** all still apply.
- **A sound annotation is small.** The app serves the sound, so the clip holds only the sound's name — a few bytes beside the cuts, kept apart from the recording bytes — and writing one never means writing the recording again.
- **The words come first**: **sound annotation**, **stock sound** and the list that holds them are written into `docs/GLOSSARY.md` before they appear in code, as the project's rule requires.
- **The arrow, the image and the text are untouched.** The sound is a further kind; adding it changes no existing kind and no cut, and the shared canvas, the lane, the preferences and the snapshot machinery already carry it.
- **A sound annotation is the editor's own**, like every annotation: a viewer watching the output has no way to turn it on or off.
- **The staff-worthy surfaces are covered in the same change**: the sidecar that carries annotations writes and reads the sound by name, and the documents that list the app's features name the new kind, in the change that ships the feature.
