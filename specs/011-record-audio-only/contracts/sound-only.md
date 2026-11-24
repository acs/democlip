# Contract: Sound-only Recording

The app is a browser application: its contracts are the **operations a person or an agent
performs**, the **files it writes and reads**, and the **domain seams** the rest of the
code asks. This file names what those must accept for the feature; it does not restate
the rules, which are in [data-model.md](../data-model.md).

## Record sources

`SourceSet` (`src/domain/capture/SourceSet.ts`) answers:

| question | answer |
|---|---|
| can a take start? | `canRecord` — screen, webcam or microphone is on |
| is this the microphone alone? | `soundOnly` — mic on, neither picture source on |
| is there a picture to record? | `hasPicture` — screen or webcam on |

The refusal when `canRecord` is false names all three sources:
`"A take needs a source: turn on the screen, the webcam or the microphone."`

A take is **sound-only** when `soundOnly` is true. A shared screen's sound is not a
sound-only mode (clarified 2026-11-24).

## Recording a take

`RecordTake.start()` (`src/application/record-take.ts`) answers one of:

| outcome | when |
|---|---|
| `started` with the composed stream | a source is on and the compositor returned at least one track |
| `refused` | no source is on, or the sources returned a stream with no tracks at all |

For a sound-only take:

- the compositor is given `screen: null`, `webcam: null`, the microphone stream, and no
  picture, picture element or bubble drawer;
- the recorder records the stream with `audio/webm;codecs=opus` (falling back to
  `audio/webm`) and the blob is born `audio/webm`;
- `stop()` measures the blob's duration through the existing probe, with
  `picture: null`, and adds the take.

Silence is not a refusal. A quiet stretch of a working microphone is a take; only a
stream with no audio track is refused.

## What a person sees

| surface | sound-only behaviour |
|---|---|
| status line | says the take is sound-only while armed and recording |
| preview | the app's sound-only panel, not a stale picture |
| live timeline | the waveform, and an audio size estimate |
| review | the waveform where the thumbnail strip would be; the playhead, marks, cuts, playback and undo work |
| Export menu | the two file destinations are offered; the two video-service destinations are disabled with the reason |
| Add to export | blocked with the reason that a card needs a picture |
| annotation actions | not offered on a clip with no picture; unchanged on a mixed clip |

## The file

| property | contract |
|---|---|
| WebM | one Opus audio track; **no video track**; blob type `audio/webm` |
| MP4 | one AAC audio track; **no video track**; blob type `audio/mp4` |
| name | `democlip-<epoch milliseconds>.<webm\|mp4>` |
| content | the kept stretches, cuts skipped, joins faded, the sound played in the review |
| card | none; a sound-only plan has no title card and no offset |
| annotations | not drawn; there is no picture to draw them on |

A **mixed** clip writes a video, as today, with the picture black over each kept stretch
of a sound-only take. The picture of a picture take is unchanged.

The **file is sound-only** when `Clip.keepsPicture()` is false for the kept stretches,
even if the recording holds a picture take that was cut away
(`ExportPlan.soundOnly === true`).

## Import

`TakeFile.of(name, type)` accepts:

| type | container | media |
|---|---|---|
| `video/webm` | webm | video |
| `audio/webm` | webm | audio |
| `video/mp4` | mp4 | video |
| `audio/mp4` | mp4 | audio |

A codecs parameter is ignored. Another `video/*` or `audio/*` type is refused. With no
type, the name decides the container and the media is video.

The inspector returns `picture: null` for a file with an audio track and no video track,
and rejects a file with neither track. The take is appended like any other; the Import
copy says "files", and the file input accepts the two audio types.

## Publishing

`publishToBluesky` and `publishToYouTube` refuse a plan with `soundOnly === true` **before**
the encode and before the upload, with a reason naming the destination and the absence of
a picture. The runs answer `{ ok: false, reason }` through the app's own handlers; no
network request is made.

The **Export** menu disables the two destinations when `Clip.keepsPicture()` is false and
sets the reason as the disabled item's tooltip.

## The automation surface and the MCP server

| operation | contract |
|---|---|
| `sources()` | unchanged: `{ screen, webcam, microphone }` |
| `takes.start()` | succeeds when a source is on, including the microphone alone; refuses with the three sources when none is |
| `out.export(target, annotations?)` | writes the sound file for a sound-only clip, the video for a mixed one |
| `out.publish(options)` | refuses a sound-only clip with the destination's reason, before anything is sent |
| `describe()` | unchanged |
| MCP `start_take` description | says a take needs a source, and the microphone alone is one |

## Refusals

| where | reason |
|---|---|
| Record, no source | "A take needs a source: turn on the screen, the webcam or the microphone." |
| Record, no tracks from the sources | "Nothing came from the sources: check the microphone and try again." |
| Export, browser cannot write the sound | the encoder's own message, as today for video |
| Publish, sound-only | "<Destination> takes a video, and this clip is sound only — it has no picture to write. Export it as a file instead." |
| Import, another container | "Only WebM and MP4 files can be imported." |
| Import, no length | "That file has no length." |