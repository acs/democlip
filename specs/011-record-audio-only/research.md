# Research: Recording Audio Only

Phase 0 decisions. Each is the rule the spec asks for, placed where the app's layers
say it belongs: a fact about the takes in `src/domain/`, a browser capability behind a
port, and the view listening.

## A sound-only take is a take with no picture — not a new kind of take

**Decision**: a **sound-only take** is the app's existing `Take` with `picture === null`.
There is no `AudioTake` class and no second take repository. A **sound-only clip** is a
clip whose takes carry no picture; a **mixed clip** is one holding both. The rule that a
take needs a **source** — a picture, or the microphone alone — belongs to `SourceSet`,
which already owns the three toggles.

**Why**: a take is a take. The clip, the cut marks, the player, the store and the export
all already work in terms of takes and seconds; a second kind of take would force every
one of them to ask which kind it held. The clip's size already treats a take with no
picture as one that contributes none (`Clip.size()` ignores a null picture), and the
snapshot already lets a take's picture be absent. This is the seam the feature grows
through, not a second model beside it.

**Alternatives considered**: a separate `AudioTake` type — rejected: it would split the
repository, the timeline map and the export into two paths for no rule that differs. A
new "audio" phase or mode — rejected: the phase describes the sitting (idle, live,
recording, review), not what the take is made of.

## The source rule: a picture or the microphone

**Decision**: `SourceSet` gains **`canRecord`** (any of the three sources is on) and
**`soundOnly`** (the microphone on, neither picture source on). `hasPicture()` stays as it
is. `RecordTake.start` refuses only when `!canRecord`, naming the screen, the webcam and
the microphone; it no longer refuses a microphone-only take. With a picture source on and
the microphone on, the take is a picture take with sound, exactly as today.

**Why**: the rule is about the set of sources, so it lives in the value object both the
recording flow and the automation surface ask. The clarification fixed the scope: the
microphone alone is the only sound-only source; a shared screen's sound is not a
sound-only mode.

**Alternatives considered**: a rule in `RecordTake` alone — rejected: the automation
surface's gate and the source buttons would each carry a copy of "is there enough". A
boolean on the `Session` — rejected: the sources are the capture adapter's, and a second
copy would drift when a device goes away. Letting a share's sound be a sound-only take —
rejected by the clarification; the screen remains a picture source.

## The stream and the recorder: a take with no video track

**Decision**: the compositor already builds the recorded stream from the tracks it is
given (`screen`, `webcam`, `mic`). With neither picture source it returns the mixed
**microphone sound alone**, with no video track. `RecordTake` passes no picture, no
`pictureElement` and no bubble drawer in that case. `TakeRecorderAdapter` chooses the
recording type from the stream's own tracks: `audio/webm;codecs=opus` (then
`audio/webm`) when there is no video track, and the existing video lists when there is.
The blob keeps that type — `audio/webm` rather than `video/webm` — so every reader can
tell what it is without probing it.

**Why**: the browser records what the stream holds; a video codec named on a stream with
no video track is a mismatch a browser may refuse, and a black canvas to carry a video
track would be the "sound over a black picture" the person explicitly did not choose.
The type travels with the blob into the probe, the store and the import, so nothing has
to guess.

**Alternatives considered**: a silent video track beside the audio — rejected: it makes
every sound-only file a video and doubles the encoder's work. A canvas that draws the
meter — rejected: it is a picture the person did not ask for and cannot see as the clip.
A second recorder adapter — rejected: one adapter choosing its mime from the stream is
the whole difference.

## The probe: reusing the element that already reads a take

**Decision**: `TakeProbeAdapter.measure` stays the one place that reads a recorded
blob's length and picture size. An `audio/webm` blob loaded in the same `<video>` element
reports the duration (with the existing seek-past-the-end fallback) and a `videoWidth`
of 0, so the take is measured with `picture: null`. No new probe is added.

**Why**: the probe is the browser boundary for "how long is this blob, and how big is its
picture"; a sound-only blob has a length and no picture, which is exactly what the port
already answers. A new probe would be a second decoder for the same question.

**Alternatives considered**: an `<audio>` element for audio blobs — rejected: the media
pipeline is the same, the existing fallback already handles a WebM's missing duration,
and the e2e check proves the audio-only blob through the existing path. Mediabunny in the
probe — rejected: the probe runs on a just-written MediaRecorder blob, and the element is
the cheapest reader; Mediabunny is already the import inspector.

## The review: the waveform where the pictures would be

**Decision**: a clip whose **takes** carry no picture enters a **sound-only review**: the
preview draws the app's own "sound only" panel (not a stale frame), the thumbnail strip is
hidden and the **waveform takes its room**, the timeline header shows an **audio**
estimate, and the playhead, marks, cuts, playback and the one undo work as they do with
pictures. `Clip.hasPicture()` — `size() !== null` — is the one answer the view asks. The
mode is set when the review opens, and the view follows a change to the clip, including
`cleared` (New) and a restored clip.

**Why**: the review is the clip's picture; with no picture, the sound is the clip. Hiding
the strip is honest (there is nothing to show there) and gives the waveform the room the
clip deserves. The view listening is the app's rule: the clip says what changed, the
review decides what to draw.

**Alternatives considered**: 22 blank thumbnail cells and a black preview — rejected: it
shows a picture the clip does not hold and buries the waveform. A separate audio player
screen — rejected: the clip's cuts, marks, annotations and properties are the same review
over the same timeline; a second screen would duplicate them. Drawing the meter in the
preview — rejected: the meter is the microphone's, not the recording's.

## The export: the kept stretches decide what the file is

**Decision**: `ExportPlan` gains **`soundOnly`**, computed from the **kept** pieces and
the takes they point at: true when none of the kept takes carries a picture. A sound-only
plan has **no title card** — `intro` is null and `introSeconds` is 0, so nothing is pushed
along — and the encoder writes an **audio-only** file: the same kept stretches, mixes and
fades, through the same `renderAudio`, but with only an `AudioBufferSource` (Opus for
WebM, AAC for MP4) and no `CanvasSource`. The blob's type is `audio/webm` or
`audio/mp4`; the download name is unchanged (`democlip-<ms>.<target>`).

**Why**: the spec decides the file from what the export keeps (FR-008), not from the
takes that were cut away, so the plan is the one place with that answer and every
exporter that asks the plan gets it. Reusing the audio renderer keeps the cuts, joins,
fades and mixing identical to a video export; there is no second audio path to drift.
Dropping the card in the plan means the encoder cannot write one by accident, and the
sound-only file is the sound alone.

**Alternatives considered**: a new `ExportTarget` such as `m4a` — rejected: the person
chose the app's two containers, and the file name and import rule stay one. A black
canvas and a video track — rejected by the clarification. Re-encoding the takes with
MediaRecorder — rejected: the export is offline and must not run in real time, and a
sound file should not go through a second recording. Writing an empty video track —
rejected: a player would show a broken or black video, not a sound file.

## A mixed clip: black over the sound-only stretch

**Decision**: a plan with at least one kept picture is a video. Each kept step whose take
has no video track is written as **black frames at 30 fps** over its pieces, with the
frame renderer drawing the annotations and the preview, while its sound comes through the
normal audio renderer. A picture step is encoded exactly as today. `firstStill` walks the
pieces until one has a picture, so the title card's background is a real frame even when
the first kept take is sound-only.

**Why**: a video file needs a picture on every stretch; black is the honest picture for a
stretch that has none, and the alternative — a gap in the video track — makes timestamps
and players unreliable. Drawing the annotations keeps every annotation over the clip's
own time, which is what the review shows. The card's still cannot come from a sound-only
first take, hence the walk.

**Alternatives considered**: hold the previous take's last frame — rejected: it shows a
picture from another moment and hides the join; the sound-only stretch would look like a
frozen picture. Skip the video frames — rejected: a gap in the track, and the sound and
picture could drift. Fill with the app's logo card — rejected: the person asked for sound,
not branding.

## What "no sound" means: no audio track, not silence

**Decision**: a sound-only take is refused only when the composed stream has **no tracks
at all** (the microphone gave no audio track). A quiet or silent stretch of a working
microphone is a valid take and is kept and exported. The spec's wording is read this way
and has been made explicit.

**Why**: a person may record a pause, a silent passage, or a room with no speaking; a
take that drops those would silently lose the clip's time. The take's length is the
timeline's unit, and a silent stretch is part of it. A source that hands back nothing,
by contrast, would make a take that is only a length and holds no sound.

**Alternatives considered**: refuse a take whose samples are all zero — rejected: it
would make silence unrecordable and depends on reading the whole blob. Add an empty take
with no track — rejected: it would be a take the player cannot play and the exporter
cannot decode.

## A clip with a picture, and a kept clip with none

**Decision**: two questions, named for what they ask:
`Clip.hasPicture()` is "do any of the clip's takes carry a picture?" (the clip's picture
size and the review's mode), and `Clip.keepsPicture()` is "do any of the **kept** stretches
carry a picture?" (the export's `soundOnly`, the publish menu's destinations). They are
derived from the takes and the cuts, never stored. `ExportPlan.soundOnly` is the same
fact as `!keepsPicture()` for the stretches an export keeps, and a unit test holds the two
together.

**Why**: the spec's export rule is about the **kept stretches** (FR-006, FR-008, FR-012),
while the review is about the clip's takes. A clip whose only picture take is entirely
cut away still has a picture (so its review and properties are unchanged) but its export
is a sound file (so a video service is not offered). Using `hasPicture()` for both would
either offer a publish that must be refused or hide a review that still has pictures; two
named questions say which is which.

**Alternatives considered**: one boolean for both — rejected: the cut-away picture would
make one of the two answers wrong. Store the fact — rejected: it changes with every cut
and every take, and the clip already knows both.

## The card, the annotations and the clip's properties

**Decision**: a **sound-only clip** has no picture for a **title card** or a **watermark**,
so its `Add to export` control is blocked while the clip has no picture, with the reason
that the card needs one; a **logo** stays the clip's value and draws nothing without a
picture (the watermark reconciler already returns when the clip has no size). The
**annotation actions** are not offered on a clip with no picture; the shared canvas,
picking, copying and deleting are unchanged, and a mixed clip keeps its actions, including
over a black sound-only stretch. The clip's **properties** — title, description, logo,
annotation colour — remain, and the **clip size** stays derived from picture takes (a
sound-only clip has none).

**Why**: a card is a picture drawn over a picture, and a watermark is a mark over one; a
sound file cannot hold either. Saying why is better than accepting a switch that changes
nothing. An annotation over a sound-only clip would have no picture to land on, so the
tools that make one are not offered; cuts and the clip's own words have nothing to do with
the picture and stay.

**Alternatives considered**: leave the switch available and silently omit the card —
rejected by FR-013. Hide the switch instead of blocking it — rejected: the row would
disappear, and a profile's value would have nowhere to be seen. Offer annotations and draw
them nowhere — rejected: a tool that cannot deliver its result is worse than one that is
not offered.

## Import: an audio file is a take

**Decision**: `TakeFile` gains a **media** kind (`video` or `audio`) beside its container
and accepts `audio/webm` and `audio/mp4` as well as `video/webm` and `video/mp4`; its
`mime` follows the kind. `TakeFileInspector` no longer requires a video track: a file with
an audio track and no video track is a take with `picture: null`; a file with neither
track is still refused. The file input accepts the two audio types, and the copy says
"files" rather than "videos".

**Why**: the app's own sound-only export must come back through Import, or the round trip
the app promises is one-way for the new kind of clip. The inspector already owns "what a
take file says about itself", and a missing picture is already a shape the take accepts.
A file with neither track holds nothing the app can play.

**Alternatives considered**: a separate audio import button or picker — rejected: Import
is already the one action for a file, and a sound file is a take. Accept any `audio/*` —
rejected: the export has to decode what it takes in, and only WebM/MP4 are the containers
it reads back. Guess the type from the extension only — rejected: the browser's own type
is better where it gives one, as today.

## Publishing: a video service takes a video

**Decision**: `publishToBluesky` and `publishToYouTube` refuse a plan with `soundOnly`
before anything is encoded or uploaded, with a reason naming the destination and the
absence of a picture. The **Export** menu disables the two entries for a clip that
`keepsPicture()` is false for. The publish flows also check before loading the heavy
client or signing in, so a person is not sent to a sign-in for a post that cannot happen.

**Why**: the destination's rule is the destination's, and it is already the app's habit to
refuse a clip a destination cannot take before spending the encode (Bluesky's ten minutes,
YouTube's fifteen). The menu's disabled entries and the use case's refusal say the same
thing at the two moments a person or an agent can ask.

**Alternatives considered**: encode an MP4 and let the service refuse — rejected: it
spends the encode and the upload on a known refusal. Offer the publish and fail in the
dialog — rejected: a menu that offers a dead end is worse than one that says why. Make a
black video to publish — rejected by the clarification; the file is the sound alone.

## Persistence: no new shape

**Decision**: none. A stored take already has an optional `picture`; a sound-only take is
stored with none. `clip-store.loadClip` already measures a take whose picture is absent
through the file inspector, which now returns null for an audio-only file, so a restored
sound-only take stays sound-only. The clip's `audio` flag already travels in the stored
meta. No schema version is bumped and no migration is written.

**Why**: the persisted shape was designed with an optional picture, and the store already
measures what is missing. A new store or a new version would be a change with no reader
or writer that needs it.

**Alternatives considered**: a new `kind` field on the stored take — rejected: the picture
already says whether there is one, and a second copy could disagree. Bump `FORMAT` —
rejected: every existing take still reads.

## The agent and the MCP server

**Decision**: the automation surface's recording gate becomes `canRecord` instead of
`hasPicture`; `takes.start` refuses only with no source, naming the three, and a
microphone-only start succeeds. `out.export` is unchanged and writes the sound file for a
sound-only clip; `out.publish` is refused through the publish use cases. The MCP server's
`start_take` description says a source is needed and that the microphone alone is one.

**Why**: the surface is the app's own operations. A rule change in the app that the
surface still spells the old way would make an agent told "turn the screen on" for a
recording the app would accept. The description is the tool's documentation; it must say
what the app does.

**Alternatives considered**: a new agent-only operation — rejected: the surface adds no
operation the person does not have; this is the same Record with a different source set.
Leaving the description — rejected: it would tell an agent to turn on a source it does
not need.

## Verification: a microphone, a file, and a mixed clip

**Decision**: the rules are unit-tested in node; the browser behaviour is one committed
check in `e2e/checks/capture.spec.ts` for the microphone-only record → review → export,
and one in `e2e/checks/export.spec.ts` for a mixed clip's black stretch (a second story,
not a second behaviour of the first). The first uses Chromium's fake microphone, because
it is the recorder's own flow; the second seeds a **sound-only fixture take** and a
picture fixture take, so it is deterministic and needs no live recording. The fixture
encoder gains an audio-only mode (a tone, no video track), and the fixture metadata says a
take has no picture. The export is read back for its duration, its lack of a picture, and
decodable sound. The MP4 audio path is checked when the browser's AAC encoder is
available and otherwise reported as skipped. A real session with the person's own
microphone and ears is the one thing no check can do.

**Why**: the verification skill requires a unit test per rule and a browser check for
what is drawn, played or encoded, and it prefers fixture takes to recordings for an
editing or export check. The microphone-only check is about the recorder; the mixed check
is about the file, so a fixture is the honest and fast way to build it. The share picker
is not involved — the feature is the microphone alone — so the one real session the skill
names is the person's own device, not a screen share.

**Alternatives considered**: only unit tests — rejected: the recorder's mime, the probe's
duration, the review's strip and the encoder's file are all browser work. A check per
behaviour — rejected by the skill's one-or-two rule; the two checks walk the two stories.
Recording the mixed clip live with the fake devices — rejected: slower and less
deterministic than a fixture, and not what the check is about. A real screen share — not
this feature; the microphone-only flow needs no picker.

## The tests' own takes must carry a picture

**Decision**: the unit-test fakes that build a **picture clip** (the export, publish and
clip-property tests) pass a picture to `addTake`, as a recorded or imported take does.
The sound-only tests use a helper that adds a take with no picture. The existing
`e2e/checks/publishing.spec.ts` seeder, which adds a take with no picture today, gains
the take's own 640×360 picture.

**Why**: with the new rule, a take with no picture *is* a sound-only take. A test that
means "a normal clip" but adds takes without pictures would now be testing a sound-only
clip, and the card and publish tests would fail for the wrong reason. Giving the fixture
the picture a real take carries keeps the test's meaning.

**Alternatives considered**: make the domain assume a picture when the episode does not
say — rejected: the whole feature is that a take can have none. Change only the failing
assertions — rejected: the test would no longer exercise the picture path. Leave the e2e
seeder — rejected: the publishing checks would silently become sound-only and fail.