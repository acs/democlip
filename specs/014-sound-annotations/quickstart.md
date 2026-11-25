# Quickstart: Sound Annotations

How to see the feature work once it is built. The rules are unit-tested in node; what is **in the
file** is driven in the end-to-end suite; what is **heard in the review** is driven in a
temporary harness on the dev server, because no suite can capture the page's sound; and whether
it *sounds* right is the person's own session with their own ears.

## Prerequisites

```bash
npm install
```

The app's stock sounds live under `web/public/sounds/` and are served with the app; nothing else
is needed and nothing is downloaded at run time.

## The rules, in node

```bash
npx vitest run src/domain/sound/StockSounds.test.ts
npx vitest run src/domain/annotation/SoundAnnotation.test.ts src/domain/annotation/kinds.test.ts
npx vitest run src/domain/clip/ExportPlan.test.ts src/application/export-clip.test.ts
npx vitest run src/ui/annotating/annotation-plugin.test.ts src/ui/agent/describe.test.ts
```

Expected:

- `StockSounds.isStockSound('chime')` and `('gong')` are true, `('applause')` and `('claps')` are false;
  `DEFAULT_STOCK_SOUND` names one of the list; every file is a relative `./sounds/…` path.
- `SoundAnnotation.create(span, 'chime')` makes one; `create(span, 'applause')` is **null**;
  `restore` of an unknown name is **null**; `handles()` is `[]`; `hitTest(...)` is **false**;
  `withSound('gong')` changes the sound and keeps the id, the span and the kind; `duplicated`
  keeps the sound under a new id; `stored()`/`restore()` round-trip the name.
- `kinds.annotationFrom` rebuilds a sound annotation, and answers **null** for a sound this build
  does not know (the clip still opens).
- `plan.soundings()` is one entry per kept stretch a sound covers, in the file's seconds; a sound
  whose stretch is cut through answers one entry for the kept part and none for the cut; a sound
  whose whole stretch is cut answers **nothing**; `plan.audio` is **true** for a clip with no
  recorded sound that holds a sound annotation.
- The `sound` property's `value` is the annotation's stock sound, and its `with` changes it; a
  name the app does not serve is refused.
- `describe()` lists a sound annotation with **Sound** and **Duration**.

Every `Arrow`, `ImageAnnotation`, `TextAnnotation`, `AnnotationSet` and `Clip` test passes
**unmodified** — the regression proof that the family did not change.

## The sound in the file, in a browser

```bash
npm run test:e2e -- e2e/checks/annotations.spec.ts --grep "sound"
```

The check places a sound annotation through the agent's **data-only maker** (so it needs no
hands on the picture), exports the clip, and reads the exported file back in the page:

1. **It is in the file** — the stock sound's samples are present in the exported audio at the
   annotation's stretch, and absent outside it.
2. **The recording is unchanged** — the exported recording's samples and its length are the same
   as the same export with the sound annotation removed; only the added sound differs.
3. **A silent clip gains sound** — a clip whose takes carry no sound, holding a sound
   annotation, exports a file that **has** an audio track.
4. **A cut takes its part** — a cut through the stretch leaves the sound silent over the cut.

## The review and the editing, in a browser (a temporary harness)

```bash
npm run dev   # then open /verify-sound-annotations.html on the dev server
```

The harness is temporary and is deleted before the commit, as the verification skill asks. It
drives, in the real page:

- **Add** — with a stretch selected, the **Sound** row places a sound over it, it appears on the
  lane, and its preferences open.
- **Hear it** — press ▶: the sound plays as the playhead crosses its stretch, and nothing plays
  outside it; after a **seek**, the sound plays when the playhead next crosses it, and a seek
  backwards does not play it twice.
- **Edit it** — pick it on the lane: **remove** and **settings** are offered; change
  the **Sound** and the **Duration** in the preferences and hear the change; copy and paste puts
  a second one at the playhead; delete it and take it back with the one undo.
- **A clip with no picture** — a sound-only clip offers only **Sound** in the annotate options,
  and a sound placed on it is heard in the review and carried by its sound file.
- **Nothing on the picture** — no sound annotation ever draws anything over the picture, in any
  state.

Its output (screenshots and the console) is pasted into the pull request.

## What no check can do

- **The ear**: whether a clap or a gong sits right over a voice, and whether the review plays
  what the file will carry, is a person's own speakers. The suite proves the samples are in the
  file and the harness proves the review triggers; the judgement is a real session.
- **The review's own audio**: Playwright cannot record the page's sound, so the review's mix is
  proved by the harness and by the shared rules (the same `soundings()` both read), not by a
  captured signal.
- **A real screen share**: the recorder's flow is untouched and is the person's to run, exactly
  as the app already states for the recording.
- **The stock sounds' own mastering**: that the app's files sit at the right level over a voice
  is a judgement about the files, made by ear.

## In the app, by hand

```bash
npm run dev
```

Open the address Vite prints. Then:

1. Record a short take with the microphone, then in the review select a stretch and press the
   **Sound** row: a clap plays over that stretch, it appears on the lane, and its preferences
   open.
2. In the preferences change the sound to **Gong**, then shorten or lengthen its **Duration**:
   the review plays the new sound for the new length.
3. Press ▶ and listen: the gong plays *with* the voice, only over its stretch. Seek away and
   back: it plays again when you cross it, and not when you jump past it.
4. Place a second sound that overlaps the first: both are heard with the voice.
5. Cut a stretch through the gong: it is silent over the cut, and putting the cut back brings it
   back.
6. **Export ▾ → WebM file** and play the file: it carries the sounds, mixed the same way as the
   review.
7. Make a **sound-only** clip (the microphone alone): the annotate options offer **Sound** on its
   own; place one and export — the sound file carries it.
8. Reload the page: the sounds come back in place, with the sound and length you left them at.
9. With **Boost the sound** on, place a sound and export: the voice is still at the boosted
   level, and the added sound sits over it — the sound did not change the boost.

## After the change

```bash
npm run lint && npm run typecheck && npx vitest run && npm run build
npm run test:e2e
```

The end-to-end suite is the final gate: the new sound check passes, and the checks that already
seed a take with sound — the export, publishing and profile checks — still pass, since a clip
with no sound annotation is unchanged.
