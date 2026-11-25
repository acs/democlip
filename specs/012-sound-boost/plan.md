# Implementation Plan: Sound Boost

**Branch**: `feat/sound-boost` | **Date**: 2026-11-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/012-sound-boost/spec.md`

## Summary

The clip gains one more of its own properties — **Boost the sound** — a switch that is **on
by default** and that a **profile** may fix, exactly as it fixes **Add to export** and the
**logo**. While it is on, the clip's sound is brought to the app's one target for speech and
held below its peak ceiling, in the **review and in every file alike** — the WebM download,
the MP4 for Bluesky, the YouTube upload and a **sound-only** clip's sound file. It is
**loudness with peak safety alone**: the channels, the low end and the dynamics are left as
recorded, so the recording is never repaired, only placed where players expect it.

The takes are never touched. The boost is applied to the sound as it is *heard* (a gain on
the review's audio graph) and as it is *written* (a gain on the export's offline mix), from
one measured number, so what the person hears and what the file carries cannot disagree.
Turning the switch off gives the recorded sound back whole. This is the *improve the sound*
recipe's loudness step, moved out of ffmpeg and into the app so it is always available.

Out of scope, per the clarification and the spec: the recipe's mono fold-down, its rumble
high-pass, its measurement-driven presence lift, and any compression or noise removal. The
boost is the loudness step and nothing else.

## Technical Context

**Language/Version**: TypeScript 6 (ES modules)

**Primary Dependencies**: mediabunny + WebCodecs (the offline encoder) and the browser's Web
Audio (`AudioContext`, `OfflineAudioContext`, `decodeAudioData`), which the app already uses
for the waveform, the join fades and the export's own audio mix; Vite; Vitest (node) and
Playwright (browser). **No new dependency**: EBU R128 is a few dozen lines of arithmetic in
the domain, and a library would be a heavier thing to carry than the rule it replaces.

**Storage**: IndexedDB (the clip store). No schema change and no migration: the switch is an
ordinary **clip property**, already persisted with the clip, and a profile's declaration for
it is already persisted by the profile store. Neither the clip store's format nor
`PROFILES_FORMAT` is bumped.

**Testing**: Vitest in node for the loudness measurement (against the standard R128 test
signals), the gain rule, the clip property and the export plan; Playwright in `e2e/` for the
sound of the exported file, its loudness measured with the app's own module; a real session
with the person's own ears for whether it sounds right.

**Target Platform**: unchanged — the browser, Chrome 94+/Firefox 130+. Every API the boost
needs is on the app's existing audio path; no new browser target is added.

**Project Type**: single-project browser app — `src/` in four layers, `web/` the shell,
`mcp/` the agent server

**Performance Goals**: the export stays faster than real time: it decodes every take for its
mix already, so the measurement is arithmetic over those same samples — no second decode and
no second encode — and the boost is one multiply over the rendered mix. The review pays **one**
extra full-rate decode of the clip's sound, once per change to its sound (the app's waveform
decode is 8 kHz and cannot measure R128), keeping only per-block statistics and one take's
samples at a time; the number is cached, so a play and a toggle cost nothing. The pull request
records the overhead the measurement added to opening a real clip, and to an export.

**Constraints**:
- `src/domain/` stays pure: the R128 measurement and the gain rule are arithmetic over
  `Float32Array` samples — no DOM, no `AudioContext`, no import from `ui/` or `infra/`.
- The measurement needs a **decode**, which is the browser's; the decode stays in
  `src/infra/` and only the arithmetic is the domain's.
- The takes are never re-encoded or replaced: the boost is a gain over the sound as it is
  heard and written, and turning it off gives the recording back.
- The words come first: `docs/GLOSSARY.md` gains **sound boost** before the code, in this
  change.
- Everything stays local and offline; the boost adds no network, no server and no upload.
- One change, one pull request; CI owns the version; `package.json` is untouched.

**Scale/Scope**: a clip of a handful of takes, minutes long, in one browser tab. The
measurement is linear in the kept sound's samples — the same order as the decode the export
already performs, and far below the frame loop that dominates an export.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. The skills are the constitution** — the plan follows `.agents/skills/domain-model`
  (a rule is a class or a module in `src/domain/`, a browser capability behind a port, the
  view listens), `.agents/skills/verification` (a unit test per rule; a committed browser
  check for what is heard, drawn or encoded; a real session for the ear) and
  `.agents/skills/project-workflow` (one change, one pull request). The **recipes** skill is
  honoured the other way round: a recipe that the app *can* do is promoted out of the recipe
  and into the app, and the recipe is updated or retired with it. **Pass.**
- **II. `src/domain/` is pure** — the loudness measurement (`Loudness`), the target and the
  gain rule (`SoundBoost`) and the plan's `soundBoost` are arithmetic and values; the decode,
  the gain node and the encoder's multiply stay in `src/infra/` and `src/ui/`. **Pass.**
- **III. Every rule has a test beside it** — `Loudness.test.ts` (the R128 signals and
  silence), `SoundBoost.test.ts` (lift, attenuation, the peak cap, silence), `Clip.test.ts`
  (the property defaults on and round-trips), `clip-properties.test.ts` (the descriptor),
  `ExportPlan.test.ts` and `export-clip.test.ts` (the plan carries the boost). **Pass.**
- **IV. What is drawn, played or encoded is proved in a browser** — one committed check in
  `e2e/checks/export.spec.ts` seeds a quiet fixture take, exports with the boost on and off,
  and reads each file back to measure its loudness with the app's own `Loudness` module; a
  fold in `e2e/checks/profiles.spec.ts` proves a profile fixing the switch off makes an
  un-boosted clip. The ear — does the boost make a voice sound right — is the person's own
  session, stated as the gap. **Pass.**
- **V. The words come first** — `docs/GLOSSARY.md` gains **sound boost** and its place in the
  profile's items, before the code uses the word. **Pass.**
- **VI. One change per pull request, and CI owns the version** — this is one feature on its
  branch; the plan's steps are the one change. `package.json` is not touched. **Pass.**

No violations, so Complexity Tracking is empty.

**Post-design re-check (Phase 1)**: every rule sits in `src/domain/` (`Loudness`,
`SoundBoost`, `ExportPlan`); the decode and the gain node stay in `src/infra/` and `src/ui/`;
every rule has a test named in `data-model.md`; the browser check and the real-session ear
gap are stated; **sound boost** enters `GLOSSARY.md` first. No new dependency, layer or
project is introduced, and the switch reuses the clip-property and profile machinery rather
than adding a kind. The check still passes with no violations.

## Project Structure

### Documentation (this feature)

```text
specs/012-sound-boost/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── sound-boost.md   # Phase 1 output — the property, the profile, the file, the plan, the agent
└── tasks.md             # Phase 2 (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
src/
├── domain/
│   ├── sound/
│   │   ├── Loudness.ts              # NEW: EBU R128 integrated loudness and peak, over samples
│   │   ├── Loudness.test.ts         # NEW: the standard R128 signals; silence
│   │   ├── SoundBoost.ts            # NEW: the target, the ceiling, boostsSound(), gainFor()
│   │   └── SoundBoost.test.ts       # NEW: lift, attenuation, the peak cap, silence
│   └── clip/
│       ├── ExportPlan.ts            # soundBoost on the plan, from the clip's property
│       └── ExportPlan.test.ts       # the plan carries the boost; a silent plan does nothing
├── application/
│   ├── export-clip.ts               # planExport passes boostsSound(clip.properties)
│   └── export-clip.test.ts          # the plan's soundBoost follows the clip
│                                    # (publish-to-bluesky / publish-to-youtube: unchanged —
│                                    #  they build the same plan and inherit the boost)
├── infra/
│   ├── sound-boost.ts               # NEW: decode the kept sound, measure, gain; cached
│   └── offline-encoder.ts           # renderAudio applies the gain to the rendered mix
├── ui/
│   ├── clip/
│   │   ├── clip-properties.ts       # the soundBoost descriptor: toggle, seedable, on by default
│   │   ├── clip-properties.test.ts  # the default, the round-trip, the profile off value
│   │   ├── fade.ts                  # a second gain node — the boost — after the fade node
│   │   ├── boost.ts                 # NEW: the review's side — the gain node, refreshed
│   │   └── review-flow.ts           # the review asks the boost to refresh when it opens
│   └── clip/waveform.ts             # unchanged: the bars are the recording's shape
├── main.ts                          # wires the boost's refresh, if not via the review flow
mcp/src/tools.ts                     # set_clip_property takes "soundBoost"; the description says so
docs/GLOSSARY.md                     # "sound boost", and the profile's items
docs/FEATURES.md                      # the sound row
e2e/
├── fixtures/encode-take.ts          # a tone whose level the check can choose
├── helpers/exports.ts               # loudnessOf(page, bytes) — the app's own module, in the page
├── checks/export.spec.ts            # the sound-boost check (new)
└── checks/profiles.spec.ts          # a profile fixing the boost off (new)
```

**Structure Decision**: single project. The rules — the loudness measurement, the target, the
ceiling and the gain — live in `src/domain/sound/`, pure and node-tested, because they must
be readable without a browser and the export plan is built in `application/`, which cannot
import the view. The decode that feeds the measurement, the encoder's multiply and the
review's gain node are the browser's, and stay in `src/infra/` and `src/ui/`. The switch is a
further entry in the clip-property register, so the panel, a profile's sheet and the
automation surface all learn it from the one declaration.

## Complexity Tracking

> No Constitution Check violations: nothing to justify.
