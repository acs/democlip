# Implementation Plan: Sound Annotations

**Branch**: `sounds-annotations` | **Date**: 2026-11-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/014-sound-annotations/spec.md`

## Summary

The annotation family gains a fourth kind: a **sound annotation** — a **stock sound** placed
over a stretch of the clip and **mixed with the recorded sound**. It is added in the one place
every kind is added, found and picked on the **timeline lane**, kept with the clip, copied,
deleted and undone through the shared canvas, and it is edited the same way as the others: the
sound it uses and how long it plays are its **preferences**.

The sound is one of the app's own few **stock sounds** — a **chime**, a **gong**, a **pluck** — served with the
build under `web/public/sounds/`, named rather than carried, so nothing is loaded, imported or
recorded and a clip stays small. What the person hears in the review and what every file carries
are the same mix, produced the same way: the recording, with the stock sound over it. The takes
are never touched, so removing the annotations gives the recording back whole.

Two facts from the clarification shape the work, and both are visible in the code below: the
sound is **per annotation** (each one names its own stock sound), and the clip's **sound boost
keeps treating the recorded sound alone**, with the added sound mixed in over it — so a sound
annotation changes neither the loudness measure nor the gain the boost applies.

A sound annotation draws nothing. It therefore has no shape on the picture, is never picked
from it, and is found and edited on the lane; its preferences open from the lane, since the
on-picture settings control every other kind hangs off its own box is a place a boxless kind
does not have. The work ships as a sequence of pull requests, each leaving the app working: the
words first, then the kind, then where the sound's bytes are kept, then the file carrying it,
then the plugin and the preferences, then the review hearing it, then the docs.

## Technical Context

**Language/Version**: TypeScript ^6.0.3, ES modules, strict.

**Primary Dependencies**: Vite ^8.3.8, Vitest ^5.1.0 (node tests), Playwright (end-to-end),
Mediabunny + WebCodecs (the offline export) and the browser's own **Web Audio** —
`AudioContext`, `OfflineAudioContext`, `decodeAudioData`, `AudioBufferSourceNode` — which the
app already uses for the waveform, the join fades, the review's gain and the export's own audio
mix. **No new dependency**: a stock sound is fetched from the app's own folder and decoded with
`decodeAudioData`, as a logo's picture is fetched and decoded today.

**Storage**: IndexedDB (the clip store, `src/infra/clip-store.ts`). **No schema change and no
migration**: a sound annotation is an ordinary `StoredAnnotation` — an id, a kind (`"sound"`), a
span and a geometry (`{ sound: "chime" }`) — and the store already writes every annotation
generically. `PROFILES_FORMAT` is untouched (a sound annotation is not a clip property and no
profile controls it). The stock sound's **bytes** are the app's own files, never in the store,
so a clip holds only the sound's **name**.

**Testing**: Vitest in node for the kind's rules (`SoundAnnotation`, `StockSounds`,
`kinds`), the plan (`ExportPlan.soundings()`, its `audio` derivation, `export-clip`), the
plugin's action and the `sound` annotation property; a temporary `verify-*.html` harness on the
dev server for the review's mix and the lane's boxless editing; and one committed check in
`e2e/checks/annotations.spec.ts` that exports a clip holding a sound annotation and reads the
file back to prove the sound is **in the file** (its samples, at its moment), with the
byte-length and loudness of the recording unchanged by the added sound.

**Target Platform**: unchanged — the browser, Chrome 94+/Firefox 130+. Every API the mixing
needs is already on the app's audio path; no new browser target is added.

**Project Type**: single-project browser app — `src/` in four layers, `web/` the shell and the
app's served files, `mcp/` the agent server.

**Performance Goals**: the export stays faster than real time. The stock sounds are short and
are decoded **once** and cached; mixing one is a sample-add into the buffer the export already
renders, so a sound annotation costs neither a second decode of the takes nor a second encode.
In the review a sound is **one decoded buffer** (the app's own file, small), played from the
`AudioContext` the review already holds. Opening a clip with sound annotations adds no decode of
the recording.

**Constraints**:
- `src/domain/` stays pure: the kind (`SoundAnnotation`), the stock list (`StockSounds`) and
  the plan's `soundings()` are numbers and names — no `AudioBuffer`, no `fetch`, no import from
  `ui/` or `infra/`.
- The audio bytes and their decode are the browser's: they live in `src/infra/stock-sounds.ts`,
  behind the same shape `src/infra/images.ts` gives a picture.
- The takes are never re-encoded or replaced: the stock sound is mixed over the recorded sound
  as it is heard and written, so a clip with its annotations removed carries the recording
  whole.
- A sound annotation draws nothing and is never picked from the picture: `handles()` is empty,
  `hitTest` is false. The lane is its finder and its editing home.
- The sound boost keeps treating the **recorded** sound; the added sound is mixed after the
  gain, so it is not measured and not lifted.
- The words come first: `docs/GLOSSARY.md` gains **sound annotation** and **stock sound** before
  the code, in this change.
- Everything stays local and offline; no network, no server, no upload.
- One change per pull request; CI owns the version; `package.json` is untouched.

**Scale/Scope**: a clip of a handful of takes, minutes long, in one browser tab, with a handful
of annotations. The stock list is a few sounds; the plan, the export mix and the review's
trigger are all linear in the sounds placed, which is a few.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. The skills are the constitution** — the plan follows `.agents/skills/domain-model` (a
  rule is a class in `src/domain/`; a browser capability behind a port; the view listens),
  `.agents/skills/verification` (a unit test per rule; a committed browser check for what is
  heard or encoded; the ear is a real session) and `.agents/skills/project-workflow` (one
  change per pull request). **Pass.**
- **II. `src/domain/` is pure** — `SoundAnnotation` is an id, a span and a sound name; the
  stock list is names and labels. The bytes, the fetch, the decode and the mixing stay in
  `src/infra/` and `src/ui/`. **Pass.**
- **III. Every rule has a test beside it** — `SoundAnnotation.test.ts` (a stock sound is
  required, an unknown one refused, no handles, no pick, duplicate/withSound/restore),
  `StockSounds.test.ts` (the list, `isStockSound`), `kinds.test.ts` (the kind restores and an
  unknown one is left out), `ExportPlan.test.ts` (the soundings, the `audio` derivation, a cut
  through a stretch) and `export-clip.test.ts` (the plan carries the clip's sound annotations);
  the plugin's action and the `sound` property are tested with the other plugins'. The existing
  `Arrow`/`ImageAnnotation`/`TextAnnotation`/`Clip` tests are the regression proof and are not
  touched. **Pass.**
- **IV. What is drawn, played or encoded is proved in a browser** — one committed check in
  `e2e/checks/annotations.spec.ts` seeds a clip, places a sound annotation (through the agent's
  data-only maker), exports it and reads the file back to prove the stock sound's samples land
  at its stretch and the recording is otherwise unchanged; a temporary harness proves the
  review's trigger and the lane's boxless editing, which no check can capture (the page's audio
  is not observable from outside). **Pass.**
- **V. The words come first** — `docs/GLOSSARY.md` gains **sound annotation** and **stock
  sound** (and the list that holds them) before the code uses the words. **Pass.**
- **VI. One change per pull request, and CI owns the version** — the plan is a sequence of
  seven steps, each its own branch and pull request, each leaving the app working.
  `package.json` is not touched. **Pass.**

No violations, so Complexity Tracking is empty.

**Post-design re-check (Phase 1)**: every rule sits in `src/domain/` (`SoundAnnotation`,
`StockSounds`, `ExportPlan.soundings`); the bytes, the decode and the mixing stay in
`src/infra/` and `src/ui/`; every rule has a test named in `data-model.md`; the browser check
and the real-session ear gap are stated; **sound annotation** and **stock sound** enter
`GLOSSARY.md` first. No new dependency, layer or project is introduced, and the kind reuses the
shared canvas, the lane, the preferences and the snapshot machinery rather than adding a
mechanism. The check still passes with no violations.

## Project Structure

### Documentation (this feature)

```text
specs/014-sound-annotations/
├── plan.md                     # This file
├── research.md                 # Phase 0 output
├── data-model.md               # Phase 1 output
├── quickstart.md               # Phase 1 output
├── contracts/
│   └── sound-annotation.md     # Phase 1 output — the kind, the stock list, the file, the review, the agent
├── checklists/
│   └── requirements.md         # Specification quality checklist
└── spec.md                     # Feature specification
```

### Source Code (repository root)

```text
src/
├── domain/
│   ├── annotation/
│   │   ├── SoundAnnotation.ts        # NEW: the fourth kind — a stock sound over a stretch, no shape
│   │   ├── SoundAnnotation.test.ts   # NEW: a stock sound required; no handles; no pick; duplicate; restore
│   │   └── kinds.ts                  # registers SoundAnnotation (a line)
│   ├── sound/
│   │   ├── StockSounds.ts            # NEW: the app's declared list — name, label, file
│   │   └── StockSounds.test.ts       # NEW: the list, isStockSound, the default
│   └── clip/
│       ├── ExportPlan.ts             # soundings() in output seconds; audio true when there are any
│       └── ExportPlan.test.ts        # the soundings; a cut through a stretch; a silent clip gains sound
├── application/
│   ├── export-clip.ts                # planExport passes the clip's sound annotations
│   └── export-clip.test.ts           # the plan carries them
├── infra/
│   ├── stock-sounds.ts               # NEW: fetch the app's files, decode once, cache the buffers
│   └── offline-encoder.ts            # renderAudio overlays the stock sounds after the boost
├── ui/
│   ├── annotating/
│   │   ├── sound-plugin.ts           # NEW: the kind in the view — its action, its property, its creation
│   │   ├── annotation-plugin.ts      # PropertyControl gains 'sound'; a kind may say it needs no picture
│   │   ├── plugins.ts                # a line for the sound kind
│   │   ├── properties-inspector.ts   # the 'sound' control; a placement for an annotation with no box
│   │   ├── annotate-options.ts       # offers a picture-less kind on a clip with no picture
│   │   └── annotation-lane.ts        # a picked boxless annotation's controls, and its preferences
│   ├── clip/
│   │   ├── sounds.ts                 # NEW: the review's trigger — play a sound as the playhead crosses it
│   │   └── playback.ts               # the loop tells the trigger where the playhead is; a seek resets it
│   └── agent/
│       ├── make.ts                   # makeSound — a sound annotation from a name (data alone)
│       └── describe.ts               # a sound annotation's properties appear with the others
├── main.ts                           # wires the sound plugin
web/public/sounds/                    # NEW: the app's stock sound files (the palette), served beside the app
web/index.html                        # the help text gains the sound
mcp/src/tools.ts                      # annotate gains kind "sound" with a "sound" name; set_property says so
docs/GLOSSARY.md                      # "sound annotation", "stock sound", the list
docs/FEATURES.md                      # the sound row
e2e/checks/annotations.spec.ts        # the sound-annotation check (new): the sound is in the file
```

**Structure Decision**: single project, the existing four layers. The **rules** — the kind's
shape (none), that it must name a stock sound, and the plan's kept positions — live in
`src/domain/`, pure and node-tested, because the export plan is built in `application/`, which
cannot import the view. The stock sound's **bytes, fetch and decode** are the browser's and live
in `src/infra/stock-sounds.ts`; the **mixing** is the browser's and lives where the app already
mixes — `infra/offline-encoder.ts` for the file and `ui/clip/sounds.ts` for the review. The kind
in the view is a plugin like the arrow, the image and the text, registered under the same id, so
the shared canvas, the lane, the preferences, the store, the sidecar and the automation surface
all learn it from the one registration.

## Implementation Sequence

Each step is its own branch and pull request, and leaves the app working and its tests green.
The order puts the words and the kind first (so the regression is provable while the feature is
not yet wired), then where the sound's bytes are kept, then the file carrying it (with a
data-only maker so a check can create one), then the view and the review, and the docs last.

| Step | Change | Proof | Pull request |
|---|---|---|---|
| 1 | **Words and map.** Add **sound annotation**, **stock sound** and the list that holds them to `GLOSSARY.md`; update `FEATURES.md`, the help text and the Overview/Domain-model skills' maps. No code. | Docs review; the glossary is the only source of the words. | `docs/sound-annotation-words` |
| 2 | **The kind, and the list.** `src/domain/sound/StockSounds.ts` (the declared list, `isStockSound`, the default) and `src/domain/annotation/SoundAnnotation.ts` (its id, its `{ sound }` geometry, `create`/`restore`, `handles()` empty, `hitTest` false, `movedBy` unchanged, `withSound`, `duplicated`, `stored`), registered in `kinds.ts`. Nothing creates one yet. | Unit tests beside each file; `kinds.test.ts` restores a sound and leaves an unknown one out; every existing kind and cut test unmodified. | `feat/sound-annotation-kind` |
| 3 | **Where a stock sound is kept.** Add the app's files under `web/public/sounds/` and `src/infra/stock-sounds.ts` — fetch a sound's file from where the app is served, decode it once, cache the `AudioBuffer` by name; a `StockSoundPort` (by name → buffer, `ready()`). | Unit tests with a fake port; a browser harness that a sound's file decodes and is drawn (its samples read back) after a fetch. | `feat/stock-sound-store` |
| 4 | **It is heard in the file.** `ExportPlan` carries the clip's sound annotations and answers **`soundings()`** (each kept stretch in output seconds, a cut taking its part) and derives `audio` true when there are any; `planExport` passes them; `renderAudio` decodes the named stock sound and adds its samples at each sounding, **after** the boost gain. The data-only maker (`make.ts`) and MCP `annotate` `kind: "sound"` create one without the view. | `ExportPlan`/`export-clip` unit tests (the soundings, a cut, a silent clip gaining sound); the committed `annotations.spec.ts` check reads the exported file back and proves the sound's samples are in it at its stretch and the recording is unchanged. | `feat/sound-annotation-export` |
| 5 | **The plugin and the preferences.** `sound-plugin.ts` (its action, its creation: place in the default sound at once, open its preferences); `PropertyControl 'sound'` rendered by the inspector as the app's list of stock sounds; `annotate-options` offers a kind that needs no picture; the lane draws a picked boxless annotation's controls (remove, copy, settings) and opens its preferences; `main.ts` and `plugins.ts` wire it. | The plugin and property unit tests; the shared canvas, lane and inspector tests; a browser harness — add a sound, see it on the lane, pick it, change its sound and length, copy, delete, undo; and that a picture-less clip offers only Sound. | `feat/sound-annotation-plugin` |
| 6 | **The review hears it.** `src/ui/clip/sounds.ts`: the review's `AudioContext` plays a stock sound's buffer as the playhead crosses the start of its kept stretch — from the loop in `playback.ts`, reset on pause and seek, silent on a backward jump — so the review and the file agree. | A browser harness: place a sound, play, hear nothing outside its stretch and the sound at it; the same after a seek; a cut through the stretch is silent over the cut. A real session is the person's. | `feat/sound-annotation-review` |
| 7 | **Docs and final verification.** The help modal and `FEATURES.md`; `GLOSSARY.md`'s cross-references; the full suite and the end-to-end run. | The three levels of the Verification skill; the unit tests; the harnesses and the check pasted into the pull request; the person's session stated as the ear. | `docs/sound-annotation-final` |

## Complexity Tracking

> No Constitution Check violations: nothing to justify.
