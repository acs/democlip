# Implementation Plan: Recording Audio Only

**Branch**: `feat/audio-only` | **Date**: 2026-11-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/011-record-audio-only/spec.md`

## Summary

A **sound-only take** is one made with the microphone alone, when neither the screen nor
the webcam is on. It is the app's existing **take** with no picture: the clip's length is
still the sum of its takes, the review and cuts still work, and nothing new is persisted.
The source rule moves from "a take needs a picture" to "a take needs a source", and the
review and export ask whether the clip — and, for the file, the **kept** stretches — carry
a picture.

The review of a sound-only clip shows its **waveform** where the picture strip would be,
with an audio size estimate and a sound-only preview. Its export is a **sound file** in
the app's two containers — WebM/Opus or MP4/AAC — with the kept stretches, cuts and fades,
and **no video track**. A clip with a picture still exports a video; a sound-only stretch
inside it is a plain **black picture** with its sound, so every stretch keeps its place on
the timeline. The plan decides the file from the kept stretches, so a clip whose picture
takes are all cut away exports as sound, and the video-service destinations are not
offered for it. A sound file in WebM or MP4 is importable as a take; a sound-only clip is
kept and restored like any other; the automation surface and the MCP server use the same
source rule and the same operations.

Out of scope, per the clarification and assumptions: any audio-only mode for a shared
screen, any container other than WebM and MP4, a dedicated "extract audio" menu item, and
publishing a sound-only clip to a video service.

## Technical Context

**Language/Version**: TypeScript 6 (ES modules)

**Primary Dependencies**: mediabunny (decode/encode, file inspection), the browser's
MediaRecorder and WebCodecs; Vite; Vitest (unit) and Playwright (end-to-end)

**Storage**: IndexedDB (the clip store). No schema version change and no migration: a
stored take's `picture` is already optional, and the store measures a missing picture on
load.

**Testing**: Vitest in node for every rule in `src/domain/` and the use cases; Playwright
in `e2e/` for what is recorded, drawn, played or encoded, with Chromium's fake microphone;
a real session with the person's own microphone for the sound itself.

**Target Platform**: the browser — Chrome 94+, Firefox 130+ (WebCodecs). No new browser
target is added: `audio/webm;codecs=opus` recording and WebM/Opus decoding are already
part of the app's supported path, and the MP4 audio track uses the same AAC the video MP4
uses.

**Project Type**: single-project browser app — `src/` in four layers, `web/` the shell,
`mcp/` the agent server

**Performance Goals**: the sound-only review opens and plays like a picture one; the
sound-only export is offline and faster than real time (the decoder and the audio mixer
run once over the kept stretches); no regression to the video export's ~10× real time.
The timeline's audio estimate uses 128 kbps, the export's own audio bitrate.

**Constraints**:
- `src/domain/` stays pure: `SourceSet`, `Clip`, `ExportPlan` and `TakeFile` hold the
  rules; no DOM, no `ui/` or `infra/` import.
- A take's blob and its object URL are the repository's; the edit never re-encodes.
- The words come first: `GLOSSARY.md` gains **sound-only** before the code, in this change.
- Everything stays local and offline; publishing a sound-only clip is refused, not sent.
- One change, one pull request; CI owns the version; `package.json` is untouched.

**Scale/Scope**: a clip of a handful of takes, minutes long, in one browser tab; the
existing take length and clip-length rules are unchanged. A picture may be up to the
app's existing 8192×8192 ceiling; a sound-only clip has no picture size at all.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. The skills are the constitution** — the plan follows `.agents/skills/domain-model`
  (a rule is a class or value object; the view listens; one answer per question),
  `.agents/skills/verification` (unit test per rule; a committed browser check for what is
  recorded, drawn or encoded; a real session for hardware) and `.agents/skills/project-workflow`
  (one change, one pull request). The constitution's principle IV still describes the
  retired `verify-*.html` harness, while the verification skill requires a committed
  `e2e/checks/` check; the constitution says the skill wins, so this plan follows the
  skill. The stale sentence is a separate documentation fix, not this change. **Pass.**
- **II. `src/domain/` is pure** — `SourceSet` gains `canRecord`/`soundOnly`; `Clip` gains
  `hasPicture`/`keepsPicture`; `ExportPlan` gains `soundOnly`; `TakeFile` gains a media
  kind. All are derived rules over values the domain already holds. The microphone's
  stream, the recorder's mime and the encoder's audio track stay behind ports and in
  `src/infra/`. **Pass.**
- **III. Every rule has a test beside it** — `SourceSet.test.ts`, `Clip.test.ts`,
  `ExportPlan.test.ts`, `TakeFile.test.ts`, `record-take.test.ts`, `export-clip.test.ts`,
  the two publish tests, `import-take.test.ts`, `size-estimate.test.ts` and
  `clip-properties.test.ts`, with fakes behind the ports. **Pass.**
- **IV. What is drawn, played or encoded is proved in a browser** — one check in
  `e2e/checks/capture.spec.ts` drives the microphone-only record → review → export with
  Chromium's fake microphone, and reads the downloaded file back for its duration, its
  missing picture and its decodable sound; one in `e2e/checks/export.spec.ts` drives the
  mixed clip's black stretch. The share picker is not involved. A real session with the
  person's own microphone and ears is the stated gap. **Pass.**
- **V. The words come first** — `GLOSSARY.md` gains **sound-only** and its take/clip
  meaning, and the record-source, export and publish entries say what a sound-only clip
  is, before the code uses the word. **Pass.**
- **VI. One change per pull request, and CI owns the version** — this is one feature on
  its branch; the plan's steps are the one change. `package.json` is not touched; the
  version is CI's. **Pass.**

No violations, so Complexity Tracking is empty.

**Post-design re-check (Phase 1)**: the artifacts keep every rule in `src/domain/`
(`SourceSet`, `Clip`, `ExportPlan`, `TakeFile`); the browser work stays behind ports and
in `src/infra/`; every rule has a test named in `data-model.md`; the two browser checks
and the real-session gap are stated; **sound-only** enters `GLOSSARY.md` first. No new
dependency, layer or project is introduced. The check still passes with no violations.

## Project Structure

### Documentation (this feature)

```text
specs/011-record-audio-only/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── sound-only.md    # Phase 1 output — sources, recording, file, import, publish, agent
└── tasks.md             # Phase 2 (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
src/
├── domain/
│   ├── capture/
│   │   ├── SourceSet.ts             # canRecord, soundOnly; hasPicture stays
│   │   └── SourceSet.test.ts        # the source rule and the microphone-alone state
│   ├── clip/
│   │   ├── Clip.ts                  # hasPicture() (any take), keepsPicture() (kept stretches)
│   │   ├── Clip.test.ts             # both questions, and a cut-away picture
│   │   ├── ExportPlan.ts            # soundOnly; no card and no offset for a sound-only plan
│   │   ├── ExportPlan.test.ts       # both kinds of plan; the card dropped; mixed keeps it
│   │   ├── TakeFile.ts              # media kind; audio/webm and audio/mp4 accepted
│   │   └── TakeFile.test.ts         # audio accepted, mp3/wav refused
│   └── (Take.ts, ClipSnapshot: no change; the picture is already optional)
├── application/
│   ├── record-take.ts               # canRecord, no picture deps, a stream with no tracks refuses
│   ├── record-take.test.ts          # mic-only starts; no source refuses; empty stream refuses
│   ├── export-clip.ts               # unchanged; the plan derives soundOnly
│   ├── export-clip.test.ts          # a sound-only plan and a picture plan
│   ├── export-video.test.ts         # the fake takes carry a picture, as real ones do
│   ├── publish-to-bluesky.ts        # refuse plan.soundOnly before encoding
│   ├── publish-to-bluesky.test.ts   # the refusal and zero encodes/uploads
│   ├── publish-to-youtube.ts        # the same refusal
│   ├── publish-to-youtube.test.ts   # the same
│   ├── import-take.ts               # copy: files, not videos
│   ├── import-take.test.ts          # a sound file becomes a take with no picture
│   └── ports/
│       └── TakeFilePort.ts          # picture may be null; docs say recording
├── infra/
│   ├── codecs.ts                    # audio/webm;codecs=opus when the stream has no video
│   ├── take-recorder.ts             # mime from the stream's tracks; blob type audio/webm
│   ├── compositor.ts                # comment/guard: no picture source => the sound alone
│   ├── take-probe.ts                # unchanged: an audio blob gives a duration and 0×0
│   ├── take-file.ts                 # a file with sound and no video track is a take
│   └── offline-encoder.ts           # audio-only output; black frames for a sound-only step;
│                                    #   firstStill walks to a picture for the card
└── ui/
    ├── recording/
    │   ├── record-flow.ts           # mic-only is live; sound-only placeholder and status
    │   ├── preview.ts               # drawSoundOnly; a no-picture frame is the background
    │   └── live-timeline.ts         # sound-only class, live waveform, audio estimate
    ├── clip/
    │   ├── clip.ts                  # seekAndDraw/resizeReview for a clip with no picture
    │   ├── review-flow.ts           # sound-only timeline; skip the strip; waveform
    │   ├── playback.ts              # drawSoundOnly for a sound-only clip
    │   ├── timeline-ui.ts           # rebuild/estimate by the clip's picture
    │   ├── size-estimate.ts         # estimateSoundText (128 kbps)
    │   ├── size-estimate.test.ts    # the audio estimate
    │   ├── thumbnail.ts             # a 0×0 frame leaves its cell blank, not a throw
    │   ├── clip-properties.ts       # addToExport blocked with the reason while no picture
    │   └── clip-properties.test.ts  # the reason; the register unchanged
    ├── cutting/marks.ts             # no annotation actions on a clip with no picture
    ├── exporting/
    │   ├── export-flow.ts           # no card for a sound-only clip
    │   └── export-menu.ts           # publish entries disabled when the kept clip has no picture
    ├── publishing/
    │   ├── publish-flow.ts          # refuse before loading the client
    │   └── youtube-flow.ts          # the same
    ├── lifecycle/view-lifetime.ts   # clear the sound-only mode with the clip
    ├── agent/takes.ts               # canRecord; the reason names the three sources
    ├── agent/edit.test.ts            # the clip helper gives its takes a picture
    └── shell/help-steps.html        # the quick guide says Mic alone is a sound-only clip
├── main.ts                          # passes canRecord to the surface
web/
├── index.html                       # idle hint names Mic; import accepts the two audio types
├── styles.css                       # .timeline.sound-only: no strip, a tall waveform
└── help.html                        # the long guide says what a sound-only clip exports
mcp/src/tools.ts                     # start_take says a source is needed; the mic alone is one
GLOSSARY.md                          # "sound-only", record source, source set, export, publish
FEATURES.md                          # the source row, export, import, microphone
README.md                            # the headline, usage, export note
e2e/
├── checks/capture.spec.ts           # the microphone-only check (new)
├── checks/export.spec.ts            # the mixed clip's black stretch (new)
├── fixtures/encode-take.ts          # an audio-only fixture take (a tone, no video track)
├── fixtures/takes.ts                # the fixture's shape says it has no picture
├── checks/publishing.spec.ts        # the seeder gives its take a picture
├── checks/agent.spec.ts             # the refusal names the sources
└── helpers/exports.ts               # hasSound: a file's sound decodes
```

**Structure Decision**: single project. The rule that a take needs a source and that a
sound-only take has no picture lives in `src/domain/` (`SourceSet`, `Clip`, `ExportPlan`,
`TakeFile`); the browser work — the audio-only stream, the recorder's mime, the probe, the
encoder — stays in `src/infra/` behind the ports; the flows and the review stay in
`src/ui/`. Nothing in `domain/` or `application/` imports the view or a browser.

## Complexity Tracking

> No Constitution Check violations: nothing to justify.