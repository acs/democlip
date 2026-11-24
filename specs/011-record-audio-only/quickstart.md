# Quickstart: Recording Audio Only

How to see the feature work once it is built. The rules are unit-tested in node; what is
recorded, drawn and encoded is driven in a real browser by the end-to-end suite. The
microphone is Chromium's fake device in the suite and the person's own device by hand.

## Prerequisites

```bash
npm install
```

## The rules, in node

```bash
npx vitest run src/domain/capture/SourceSet.test.ts
npx vitest run src/application/record-take.test.ts
npx vitest run src/domain/clip/Clip.test.ts
npx vitest run src/domain/clip/ExportPlan.test.ts
npx vitest run src/application/export-clip.test.ts
npx vitest run src/application/publish-to-bluesky.test.ts src/application/publish-to-youtube.test.ts
npx vitest run src/domain/clip/TakeFile.test.ts src/application/import-take.test.ts
npx vitest run src/ui/clip/size-estimate.test.ts src/ui/clip/clip-properties.test.ts
```

Expected:

- `SourceSet.of(false, false, true)` has `canRecord` true, `soundOnly` true and
  `hasPicture` false; `SourceSet.NONE.canRecord` is false.
- `RecordTake.start()` starts on the microphone alone, asking the compositor for no
  picture; it refuses with the three sources when none is on, and refuses a stream with
  no tracks.
- `Clip.hasPicture()` is false for takes with no picture and true for a mixed clip;
  `Clip.keepsPicture()` is false once every picture stretch is cut away.
- `ExportPlan.of(...)` is `soundOnly` for kept takes with no picture, drops the title card
  and does not push the sound along; a mixed clip keeps its card.
- `planExport()` says `soundOnly` for a sound-only clip and false for a picture clip.
- A sound-only publish is refused before the encode; the service receives nothing.
- `TakeFile.of('voice.webm', 'audio/webm')` is a WebM audio file; `audio/mpeg` is refused;
  an imported sound file becomes a take with `picture: null`.
- `estimateSoundText(10)` is `~0.1–0.2 MB (audio)`.
- The `Add to export` switch is blocked for a clip with takes and no picture, with the
  reason that a card needs one.

## What a person sees, in a browser

```bash
npm run test:e2e -- e2e/checks/capture.spec.ts --grep "sound-only"
npm run test:e2e -- e2e/checks/export.spec.ts --grep "mixed"
```

The first check is the microphone-only story:

1. **Armed** — the microphone is on and the screen and webcam are off; the status says
   the take is sound-only, and Record starts.
2. **A take arrives** — after a short recording, the clip's length is greater than zero
   and the review opens.
3. **The review is the sound** — the timeline is in its sound-only mode, the waveform is
   visible, the header's estimate is an audio one, and no picture is drawn.
4. **The file is the sound** — export WebM, read it back: the duration is real, the
   picture is 0×0, and its sound decodes.
5. **No video service** — open the Export menu: the Bluesky and YouTube entries are
   disabled, with the reason.

The second check is the mixed story: a clip seeded with a **sound-only fixture take** and
a picture fixture take exports a video whose picture is black over the sound-only stretch
and the picture take's own over the other. Cut the picture stretch away and export again:
the file is sound only.

Both checks drive the real page; neither opens the share picker. The fixture encoder's
new audio-only mode (a tone with no video track) is what makes the mixed clip
deterministic without a second live recording.

## What no check can do

- **A real microphone and ears**: the suite records Chromium's fake device; whether the
  person's own microphone sounds right is a real session. Record a few seconds and listen.
- **The share picker**: not part of this feature (the microphone alone needs no picker);
  a real screen share remains the person's to run.
- **The MP4 audio path when AAC is unavailable**: the browser's MP4 export needs an AAC
  encoder, as the video MP4 does today. Where the suite's browser has one, export MP4 and
  read it back; where it does not, say so rather than count the path as proved.
- **A person's cut on real sound**: the marks are arithmetic and the unit tests cover the
  clip; whether the cut lands where the person wanted is an ear and a hand, not a check.

## In the app, by hand

```bash
npm run dev
```

Open the address Vite prints. Then:

1. Press **Mic** only. The status says the take is sound-only, and Record is armed.
2. Press **Record**, speak for a few seconds, press it again. The review opens on the
   waveform, and **▶** plays what you said.
3. Mark a stretch and press the **scissors**. The cut leaves the timeline and the sound
   closes up; the undo puts it back.
4. Press **Export ▾ → WebM file**. The file plays in any player with sound and no picture.
5. Press **Import** and choose the file you just downloaded. It comes back as a take with
   no picture, and the review opens on it.
6. Reload the page. The clip comes back in the review, still sound-only, cuts included.
7. Add a **Webcam** take and press **Record**. The review now shows a strip again; the
   export is a video, black over the first stretch and the camera over the second. Cut the
   camera stretch away and export: the file is sound only.
8. Open the **settings** control in the preview. The **Add to export** switch says why it
   cannot be used, and the clip has no size to show.
9. Press **New** with the microphone still on. The next clip starts empty and is still
   armed for a sound-only take.

## After the change

```bash
npm run lint && npm run typecheck && npx vitest run && npm run build
npm run test:e2e
```

The end-to-end suite is the final gate: the new checks pass, and the checks for a picture
clip — including publishing, which seeds its take with a picture — are unchanged.