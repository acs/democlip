# Data Model: Recording Audio Only

The feature adds no new aggregate and no new stored record. It grows the shapes the app
already has: a **take** may have no picture, the **sources** say whether one can be
recorded, and the **export plan** says whether the file holds a picture.

## `SourceSet` — `src/domain/capture/SourceSet.ts`

The three record sources. Already immutable; the three toggles stay independent.

| field | type | rule |
|---|---|---|
| `screen` | boolean | the shared screen is on |
| `webcam` | boolean | the camera is on |
| `mic` | boolean | the microphone is on |

**New derived facts**

| member | rule |
|---|---|
| `canRecord` | `screen \|\| webcam \|\| mic` — is there anything to record? |
| `soundOnly` | `mic && !hasPicture` — the microphone alone |
| `hasPicture` | unchanged: `screen \|\| webcam` |
| `any` | unchanged: the same as `canRecord`; kept for the readers that already ask it |

`SourceSet.NONE.canRecord` is false. A set is on only while its device is held, so the
adapter's set is the truth; the derived facts never outlive the device.

## `Take` — `src/domain/clip/Take.ts`

A **sound-only take** is a take whose `picture` is null. The take now also carries
whether it has an audio track, so a clip can answer whether it has sound without a
session flag.

| field | type | rule |
|---|---|---|
| `id` | number | as today |
| `blob` | Blob | the recording's bytes; `audio/webm` for a sound-only take |
| `url` | string | the object URL, owned by the repository |
| `duration` | number | > 0, measured from the blob or the wall clock |
| `picture` | `Picture \| null` | null for a sound-only take |
| `hasAudio` | boolean | **new**: did the take carry an audio track? A picture take can be silent; a sound-only take always has it |

`Take.of` allows a null picture and defaults `hasAudio` to false. It still refuses a zero
duration. A null picture is not an error: it is what a take with no video track has.

## `Clip` — `src/domain/clip/Clip.ts`

No stored field. Two derived answers, each named for its question.

| member | rule |
|---|---|
| `size()` | unchanged: the largest picture among **all** takes, both even, or null |
| `hasPicture()` | `size() !== null` — do any of the clip's takes carry a picture? This is the review's question: a clip with a picture keeps its picture review. |
| `keepsPicture()` | do any of the **kept** stretches (after the cuts) point at a take with a picture? This is the export's and the publish menu's question. Derived through `segmentsIn`. |
| `hasSound()` | **new**: do any of the clip's takes carry an audio track? This is the waveform's question: a picture take can be silent, so "a take exists" is not enough. |
| `keepsSound()` | **new**: do any of the **kept** stretches carry sound? This is the export's question: a clip whose sound takes are all cut away writes a silent file. Derived through `segmentsIn`. |
| `total()` | unchanged: the sum of the takes |
| `keptLength()` | unchanged |

**Invariants**

- A take with no picture contributes neither width nor height to `size()`.
- A clip with no picture takes has `size() === null`, `hasPicture() === false` and
  `keepsPicture() === false`.
- A clip with a picture take that is entirely cut away has `hasPicture() === true` and
  `keepsPicture() === false`. Its review keeps its picture mode; its file is sound only.
- `keepsPicture()` and `ExportPlan.soundOnly` answer the same question for the same
  stretches; a unit test holds them together.
- `keepsSound()` and `ExportPlan.audio` answer the same question for the same stretches.
- No event is added: `take-added`, `cut-approved`, `cut-undone` and `cleared` already tell
  the view what it needs; the derived answers are recomputed by the reader.

## `ClipSnapshot` — the takes carry their sound

```ts
takes: ReadonlyArray<{ blob: Blob; duration: number; picture?: Picture; hasAudio?: boolean }>;
```

A sound-only take is written with no `picture` and `hasAudio: true`. `clip-store.loadClip`
measures a stored take whose picture or sound is missing through `takeFile.inspect`, and
the small half's old `audio` flag is the fallback when the blob will not say. `FORMAT` is
not bumped and no migration is added.

## `ExportPlan` — `src/domain/clip/ExportPlan.ts`

The plan gains two derived facts and loses the card when there is no picture.

| field | type | rule |
|---|---|---|
| `soundOnly` | boolean | **new**: none of the kept pieces' takes carries a picture |
| `audio` | boolean | **derived**: does any kept piece's take carry an audio track? It is no longer a caller's setting |
| `intro` | `IntroCard \| null` | **null when `soundOnly`**; the card is a picture over a picture |
| `introSeconds` | number | **0 when `soundOnly`**; nothing is pushed along |
| `pieces`, `steps`, `takes`, `total`, `fadeSeconds`, `annotations` | as today | unchanged |
| `annotationsAt(target)` | as today | unchanged; a sound-only file draws none because it has no picture, but the plan still knows them |

**Rule**: `soundOnly` and `audio` are computed from `segments` and `takes` in
`ExportPlan.of`, before the card is applied:

```text
soundOnly = no segment's take has a picture
audio     = some segment's take has an audio track
```

The card is dropped when `soundOnly` is true, and the offset every piece lands at is 0.
Both are values, so they can be read and tested in node.

## `ExportSettings` — fade and annotations only

`fadeSeconds`, `annotations` and `intro` stay; `audio` is gone. The plan derives whether
the file has sound from the kept takes, so a caller cannot disagree with the clip. An
audio-only file with no sound is a failure the encoder reports, not a plan rule.

## `TakeFile` — `src/domain/clip/TakeFile.ts`

The file chosen to import. It gains a **media** kind beside its container.

| field | type | rule |
|---|---|---|
| `name` | string | the file's name |
| `container` | `'webm' \| 'mp4'` | one of the two containers the app reads |
| `media` | `'video' \| 'audio'` | **new**: the type's own kind |

**Accepted types**

| type | container | media |
|---|---|---|
| `video/webm` | webm | video |
| `audio/webm` | webm | audio |
| `video/mp4` | mp4 | video |
| `audio/mp4` | mp4 | audio |

A codecs parameter is ignored as today. A `video/*` or `audio/*` type naming another
container is refused. Where the browser gives no type, the name's `.webm`/`.mp4`/`.m4v`
is used and the media is **video** (the ordinary case). `mime` answers
`"<media>/<container>"` — `audio/webm`, `audio/mp4`, `video/webm`, `video/mp4`.

## `TakeFileInfo` — `src/application/ports/TakeFilePort.ts`

| field | type | rule |
|---|---|---|
| `duration` | number | > 0; a take cannot be built without a length |
| `hasAudio` | boolean | does the file carry sound |
| `picture` | `Picture \| null` | **null when the file has no video track**; absent counts as null |

The inspector accepts a file with an audio track and no video track. A file with neither
track is rejected. A video file is measured as today.

## `ClipProperties` and the `Add to export` property — no stored value

The clip's stored properties are unchanged. The **`addToExport`** descriptor's `blocked`
answer gains the picture rule: when a clip has takes and none carries a picture, the
switch is blocked with the reason that a card needs a picture. A `logo` is still a value
the clip keeps; the watermark reconciler already returns when the clip has no size, so a
sound-only clip wears no mark. A profile may still fix either value; the file simply has
no picture to draw it on.

## `Session` — the audio flag is gone

The session holds the clip and whether it has begun to capture. `audio` is removed: a
clip's sound is derived from its takes (`Clip.hasSound()`/`keepsSound()`), so no
"last take" flag can disagree with the clip. `hasCaptured` is still raised by a take that
really started, sound-only included.

## The sound-only file

| property | value |
|---|---|
| container | WebM or MP4, the target the person chose |
| tracks | one audio track (Opus for WebM, AAC for MP4); **no video track** |
| length | the kept length, cuts applied, joins faded |
| name | `democlip-<epoch milliseconds>.<webm\|mp4>`, unchanged |
| type | `audio/webm` or `audio/mp4` |
| import | accepted by `TakeFile` as a take with `picture: null` |

A **mixed** video's file has one video track and one audio track, as today; the picture is
black over a sound-only stretch.

## State transitions

| from | event | to |
|---|---|---|
| all sources off | microphone on | `sourceSet.soundOnly === true` |
| microphone only | Record | a take with no picture starts |
| recording | Stop | the take is added with `picture: null`; the review opens in sound-only mode |
| sound-only clip | a picture take is appended | mixed clip; `size()` grows; the review shows the strip again |
| sound take, then a silent picture take | the second take is added | `hasSound()`/`keepsSound()` stay true; the waveform stays and the file keeps the sound |
| picture clip | every picture stretch is cut away | `keepsPicture() === false`; the export is sound only; publish entries are out |
| cut away picture | undo the cut | `keepsPicture() === true`; the export is a video again |
| sound take | every sound stretch is cut away | `keepsSound() === false`; the export is silent |
| sound-only clip | export WebM/MP4 | an `audio/webm` / `audio/mp4` file with no video track |
| sound-only clip | publish | refused before encode; nothing sent |
| sound-only file | Import | a take with `picture: null` is appended |
| sound-only clip | reload | restored as a sound-only clip; the store measures no picture |
| any clip | New | cleared; the sources are untouched, so a microphone left on arms the next take |

## Validation rules

| rule | where | test |
|---|---|---|
| a take needs a source; the microphone alone is one | `SourceSet.canRecord`, `RecordTake.start` | `SourceSet.test.ts`, `record-take.test.ts` |
| the microphone alone is the only sound-only source | `SourceSet.soundOnly` | `SourceSet.test.ts` |
| a take carries whether it has sound | `Take.hasAudio`, `TakeRepository.add`, `Clip.addTake` | `Take.test.ts`, `record-take.test.ts`, `import-take.test.ts` |
| a sound-only take has a length and no picture | `Take.of` (length), probe/import (null picture) | `Take.test.ts`, `record-take.test.ts`, `import-take.test.ts` |
| the clip's size ignores a take with no picture | `Clip.size()` | `Clip.test.ts` |
| the review's mode follows the clip's takes | `Clip.hasPicture()` | `Clip.test.ts` |
| the clip's sound follows its takes, not the last one | `Clip.hasSound()`, `Clip.keepsSound()` | `Clip.test.ts`; the silent-picture e2e check |
| the file follows the kept stretches | `Clip.keepsPicture()`, `Clip.keepsSound()`, `ExportPlan.soundOnly`, `ExportPlan.audio` | `Clip.test.ts`, `ExportPlan.test.ts`, `export-clip.test.ts` |
| the waveform shows when any take has sound | `Waveform.build(takes)` | the silent-picture e2e check |
| a sound-only plan has no card and no offset | `ExportPlan.of` | `ExportPlan.test.ts` |
| a sound file has no video track | encoder adapter | e2e, file read back |
| a sound file imports as a take with no picture | `TakeFile`, inspector, `ImportTake` | `TakeFile.test.ts`, `import-take.test.ts` |
| a video service refuses a sound-only plan before encoding | publish use cases | `publish-to-bluesky.test.ts`, `publish-to-youtube.test.ts` |
| the switch cannot ask for a card with no picture | `addToExport.blocked` | `clip-properties.test.ts` |
| the estimate is the audio's | `estimateSoundText` | `size-estimate.test.ts` |