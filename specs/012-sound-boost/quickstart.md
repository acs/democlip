# Quickstart: Sound Boost

How to see the feature work once it is built. The rules are unit-tested in node; what is
heard and encoded is driven in the end-to-end suite; whether it *sounds* right is the
person's own session with their own ears.

## Prerequisites

```bash
npm install
```

## The rules, in node

```bash
npx vitest run src/domain/sound/Loudness.test.ts
npx vitest run src/domain/sound/SoundBoost.test.ts
npx vitest run src/domain/clip/Clip.test.ts src/ui/clip/clip-properties.test.ts
npx vitest run src/domain/clip/ExportPlan.test.ts src/application/export-clip.test.ts
```

Expected:

- `Loudness.measure` of a full-scale 1 kHz sine is about **−3.01 LUFS**; the same sine 20 dB
  down is about **−23.01 LUFS**; digital silence measures as silence (`lufs` `-Infinity`).
- `SoundBoost.boostsSound(ClipProperties.EMPTY)` is **true**; a clip holding `'soundBoost' =
  'false'` is false.
- `SoundBoost.gainFor(-30, -6)` lifts (gain > 1) and lands the sound near −16; `gainFor(-10,
  -2)` answers a gain **below 1** (the sound comes down) and keeps the peak under −1.5 dBFS;
  `gainFor(-Infinity, -90)` is **1**.
- The `soundBoost` descriptor reports `'true'` for a clip that never set it, and its `with`
  turns `''` into `'false'` and `'true'` back into unset.
- `planExport(clip, …).soundBoost` is true for a default clip and false once the clip holds
  `'soundBoost' = 'false'`; a profile fixing it off gives the second.

## What a person sees, in a browser

```bash
npm run test:e2e -- e2e/checks/export.spec.ts --grep "sound boost"
npm run test:e2e -- e2e/checks/profiles.spec.ts --grep "boost"
```

The first check is the sound of the file:

1. **On by default** — seed a **quiet** fixture take, open the clip's settings: **Boost the
   sound** is on, without anything having been pressed. The waveform's bars are taller than
   with the switch off, because the waveform is drawn at the level the sound is heard at.
2. **The file is boosted** — export WebM and read it back: its integrated loudness, measured
   in the page with the app's own `Loudness`, is within **±1 LU of −16 LUFS**, and no sample
   passes −1.5 dBFS.
3. **Off gives it back** — turn the switch off and export again: the file's loudness is the
   fixture's own, below the boosted one, the bars are back at the recording's level, and the
   picture of the two files is the same.

The second check is the profile's guardrail: a profile that fixes **Boost the sound** off
makes a clip whose row reads as fixed by the profile, with nothing to press, and whose export
is the un-boosted sound.

The fixture's **level** (in `e2e/fixtures/encode-take.ts`) is what makes a take quiet on
purpose; the loudness helper (in `e2e/helpers/exports.ts`) decodes the exported file in the
page and measures it with `src/domain/sound/Loudness.ts`, so the check reads the real rule
rather than a second one.

## What no check can do

- **The ear**: whether a boosted voice sounds right, and whether the review plays what the
  file will get, is a person's own microphone and speakers. The suite measures numbers; a
  real session is the judgement.
- **The review's own audio**: Playwright cannot record the page's sound, so the review's gain
  node is proved by the shared-rule tests and by the code, not by a captured signal.
- **A take recorded from a real microphone**: the suite uses a fixture tone; a real
  microphone's room and distance are the person's own session, exactly as the *improve the
  sound* recipe's own caveat says.
- **Music rather than speech**: the target is a speech target; whether a clip of music is
  better boosted or raw is a judgement the person makes with the switch.

## In the app, by hand

```bash
npm run dev
```

Open the address Vite prints. Then:

1. Record a take with the microphone a little far — a quiet one — and press ▶ in the review:
   the waveform's bars are drawn as tall as the boosted voice, and the voice plays at a
   confident loudness, not the quiet level you recorded.
2. Open the clip's **settings**: **Boost the sound** is **on**. Turn it **off**, press ▶
   again: you hear exactly what you recorded.
3. Turn it **on**, then **Export ▾ → WebM file** and play the file: it sounds like the review
   did.
4. Press **New**, then define a profile that fixes **Boost the sound** **Off** and make a clip
   under it: the settings row shows **Off** with a lock naming the profile, and the export is
   the recorded sound.
5. Record a **sound-only** clip (the microphone alone) and export it: its sound file is
   boosted in the same way.
6. Reload the page. The clip comes back with the switch where you left it.

## After the change

```bash
npm run lint && npm run typecheck && npx vitest run && npm run build
npm run test:e2e
```

The end-to-end suite is the final gate: the two new checks pass, and the checks that seed a
take with sound — the export, publishing and profile checks — still pass, since the boost
changes the sound's loudness and nothing else about the file.
