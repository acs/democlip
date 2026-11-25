---

description: "Task list for the Sound Boost feature"
---

# Tasks: Sound Boost

**Input**: Design documents from `/specs/012-sound-boost/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: included. The feature's design documents name the test files (`plan.md`'s
Constitution Check, `data-model.md`'s validation-rules table), and the project's
**Verification** skill — part of the constitution — requires a unit test beside every rule in
`src/domain/` and a committed browser check for what is heard, drawn or encoded. So each rule
gets its test in the same change.

**Organization**: tasks are grouped by user story, so each story can be implemented, tested and
delivered on its own. US1 is the MVP.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: US1, US2 or US3 — omitted in Setup, Foundational and Polish
- Exact file paths are given in every task

## Path Conventions

Single project: `src/` in four layers (`domain/`, `application/`, `infra/`, `ui/`), `e2e/` the
browser suite, `mcp/` the agent server, `docs/` and `.agents/` the words and the recipes.

---

## Phase 1: Setup

**Purpose**: the one thing that must come before the code — the word.

- [x] T001 [P] Add the word **sound boost** to `docs/GLOSSARY.md`: what it is (the clip property that brings the clip's sound to the app's one target with peak safety), and its place among a **profile**'s items beside **add to export**, **logo** and **annotation colour**. Constitution V: the word is written down before the code uses it.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the shared rules and the seam every story is built on — the measurement, the gain
rule, the switch, the plan carrying the fact, and the gain at the two application sites.

**⚠️ CRITICAL**: no user story work can begin until this phase is complete.

- [x] T002 [P] Implement the EBU R128 measurement in `src/domain/sound/Loudness.ts`, per `data-model.md` **`Loudness.measure`**: K-weighting, 400 ms blocks at 75 % overlap, the −70 LUFS absolute gate, the −10 LU relative gate, `lufs = −0.691 + 10·log₁₀(mean gated power)`, and the sample peak in dBFS. Pure: samples and a rate in, two numbers out, no browser.
- [x] T003 [P] Prove the measurement in `src/domain/sound/Loudness.test.ts`, per `data-model.md` **`Loudness.measure`**: a full-scale 1 kHz sine is about −3.01 LUFS, the same sine 20 dB down about −23.01, digital silence has `lufs = -Infinity` with its peak still measured, and an empty input is silence.
- [x] T004 [P] Implement the rule in `src/domain/sound/SoundBoost.ts`, per `data-model.md` **`SoundBoost.TARGET_LUFS`** (`-16`), **`SoundBoost.PEAK_CEILING_DBFS`** (`-1.5`), **`SoundBoost.OFF`** (`'false'`), **`SoundBoost.boostsSound`** (true unless the clip holds `OFF`) and **`SoundBoost.gainFor`** (one gain for the whole clip: `10^(min(target − lufs, ceiling − peakDb)/20)`, and `1` for silence).
- [x] T005 [P] Prove the rule in `src/domain/sound/SoundBoost.test.ts`, per `data-model.md` **`SoundBoost.gainFor`** and **`SoundBoost.boostsSound`**: a quiet sound is lifted toward the target, a loud one comes down, no gain lets the peak past the ceiling, silence (and `-Infinity`) answers `1`, and an unset `ClipProperties.EMPTY` reads as boosted while a clip holding `'false'` does not.
- [x] T006 Register the switch in `src/ui/clip/clip-properties.ts`, per `data-model.md` **`ClipProperty`** (the `soundBoost` row) and **`ClipProperties`** (its stored value): `id` from `SoundBoost.BOOST_ID`, label **Boost the sound**, `control: 'toggle'`, `seedable: true`, `value` reading `boostsSound`, and `with` mapping `'true'` to unset and anything else to `SoundBoost.OFF`. No `offValue` field and no change to the register's shape.
- [x] T007 [P] Prove the property in `src/ui/clip/clip-properties.test.ts`, per `data-model.md` **`ClipProperty`** (the `soundBoost` row): the switch is on for a clip that never set it, `with('')` stores `'false'` and `with('true')` clears it, the value round-trips, and the property is among `seedableClipProperties()`.
- [x] T008 Carry the boost on the plan: add `soundBoost: boolean` to `ExportPlan.of` in `src/domain/clip/ExportPlan.ts`, per `data-model.md` **`ExportPlan.soundBoost`**, and have `planExport` in `src/application/export-clip.ts` pass `boostsSound(clip.properties)`. Every encoder — the download and both publish paths — builds its plan here and inherits it.
- [x] T009 [P] Prove the plan follows the clip in `src/domain/clip/ExportPlan.test.ts` and `src/application/export-clip.test.ts`, per `data-model.md` **`ExportPlan.soundBoost`**: true for a clip that never set the switch, false once the clip holds `'false'`, and independent of `audio` (a plan with no sound carries the flag and does nothing).
- [x] T010 Measure the kept sound at the edge in `src/infra/sound-boost.ts`, per `data-model.md` **`boostGain`**: decode the pieces' `from`…`to` ranges of each take **one take at a time**, measure with `Loudness`, reduce with `SoundBoost.gainFor`, keep only per-block statistics and the peak, return `1` when off or when there is no sound, and cache the measurement per clip against the **sound** (not the switch) so a toggle or a play costs nothing.
- [x] T011 Apply the gain in `src/infra/offline-encoder.ts`, per `data-model.md` **`renderAudio`**: after the mix is rendered and `plan.soundBoost && plan.audio`, multiply every sample of the rendered `AudioBuffer` by `boostGain(plan.pieces, plan.takes)`. The takes are already decoded for the mix, so this adds no decode; it covers the video export and the sound-only export alike.

**Checkpoint**: the rules, the switch, the plan and the seam are in place — the stories can begin.

---

## Phase 3: User Story 1 - A recording that plays at the loudness players expect, without being asked (Priority: P1) 🎯 MVP

**Goal**: a clip with sound is boosted by default — heard in the review and carried in every
file — with the switch never pressed.

**Independent Test**: seed a **quiet** fixture take, open the review (the sound plays boosted),
export WebM, and measure the file: within ±1 LU of −16 LUFS and no sample above −1.5 dBFS,
with the picture identical to an un-boosted export.

### Tests for User Story 1

- [x] T012 [P] [US1] Add a **level** to the fixture tone in `e2e/fixtures/encode-take.ts` (`FixtureSpec.level`, applied as the oscillator's gain), so a check can seed a take that is quiet on purpose. Test support only; no application code.
- [x] T013 [P] [US1] Add `loudnessOf(page, bytes)` to `e2e/helpers/exports.ts`: decode the exported file in the page and measure it with the app's own `src/domain/sound/Loudness.ts`, so the check reads the real rule rather than a second one. Follows the `hasSound` helper's shape.
- [x] T014 [US1] Add the check to `e2e/checks/export.spec.ts`: seed a quiet fixture take, and assert the switch is **on** without anything being pressed, that the exported WebM's loudness is within ±1 LU of −16 LUFS, and that no sample passes −1.5 dBFS. Cite `data-model.md` **`boostGain`** for the one number the review and the file share.

### Implementation for User Story 1

- [x] T015 [US1] Add the review's boost: a second gain node after the fade node in `src/ui/clip/fade.ts` (`element → fade gain → boost gain → destination`), the new `src/ui/clip/boost.ts` (refresh → `gain 1` when off or with no sound, else `boostGain(...)`; `clear()` at New), and the call to refresh from `src/ui/clip/review-flow.ts` when the review opens and when the clip's sound changes. The gain comes from the same `boostGain` the encoder uses, so the review is not a preview of anything else (`data-model.md` **`boostGain`**).

**Checkpoint**: User Story 1 works on its own — a quiet recording plays and exports boosted, and the file measures at the target.

---

## Phase 4: User Story 2 - The recording is kept, and the boost is the person's to turn off (Priority: P2)

**Goal**: the switch is the person's when no profile fixes it; off plays and exports the
recorded sound, and turning it back on returns the boosted one — the takes are never changed.

**Independent Test**: with the switch on, turn it **off** in the clip's settings and export:
the file carries the recorded sound; turn it **on** and export again: the boosted sound. The
two files' pictures are identical.

### Tests for User Story 2

- [x] T016 [US2] Extend the check in `e2e/checks/export.spec.ts`: from the clip seeded in T014, turn **Boost the sound** off in the settings and export again — the file's loudness is the fixture's own and lower than the boosted one, and the picture of the two files is the same; turn it on and the boosted sound returns. Per `data-model.md` **`ClipProperties`** (the stored value) and **`boostGain`** (`1` when off).

### Implementation for User Story 2

- [x] T017 [US2] Offer the switch to an agent in `mcp/src/tools.ts`: add `"soundBoost"` to the `property` enum of `set_clip_property` and say in its description that the switch is on by default and that `"true"` turns it on and anything else off. The panel, the read side (`describe_clip` lists the register) and the undo path are already the app's and need no change — a person's toggle is the one undo's, a profile's application is not.

**Checkpoint**: User Stories 1 and 2 both work — the sound is boosted by default and the person can take it back to the recording.

---

## Phase 5: User Story 3 - A profile fixes the boost, so a way of working cannot get it wrong (Priority: P2)

**Goal**: a profile fixes the boost **on** or **off**; the clip's row reads as a value naming
the profile with nothing to press, and the file follows it.

**Independent Test**: define a profile that fixes **Boost the sound** off, make a clip under it,
and confirm the row is fixed by the profile and the export is un-boosted; switch to the built-in
**Default** and the same row is an ordinary switch, on by the app's default.

### Tests for User Story 3

- [x] T018 [P] [US3] Prove the profile fixes the switch in `src/ui/profile/apply.test.ts` (per `data-model.md` **`SoundBoost.OFF`**: a profile fixing it off applies `'false'`, one fixing it on applies unset, **Free** leaves it the person's) and in `src/ui/profile/profile-menu.test.ts` (the definition sheet draws the switch with **Free** / **On** / **Off**, told apart).

### Implementation for User Story 3

- [x] T019 [US3] Add the profile check to `e2e/checks/profiles.spec.ts`, folding it into the existing "an item a profile fixes is applied and locked — on or off" test: a profile fixing **Boost the sound** off makes a clip whose row reads as fixed by the profile with nothing to press and whose export is the un-boosted sound. The seam is already the register's (`applyActiveProfile` walks `seedableClipProperties()`), so this is proof, not new code.

**Checkpoint**: all three stories work independently.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: the words, the recipe and the gate.

- [x] T020 [P] Update `docs/FEATURES.md`: the sound row says a clip's sound is boosted to a competitive loudness by default, and that a profile may fix it.
- [x] T021 [P] Update the *improve the sound* recipe in `.agents/skills/recipes/improve-the-sound.md` and its row in `.agents/skills/recipes/SKILL.md`: the loudness step is what the app now does itself, always; the recipe keeps what the app still does not do and says the loudness is no longer the reason to reach for ffmpeg (`contracts/sound-boost.md`, "The recipe it replaces").
- [x] T022 Run the gate — `npm run lint && npm run typecheck && npx vitest run && npm run build`, then `npm run test:e2e` — and record, for the pull request, the overhead the measurement added to opening a real clip and to an export (`plan.md`, Performance Goals), plus the achieved loudness of the checked file.
- [x] T023 Commit the change with its spec on `feat/sound-boost` and open the pull request per the project workflow, with a body that states how it was verified, what was deliberately not done (the recipe's mono, high-pass, presence lift, compression and denoise), and the caveats (the ear is a real session; the review's own audio cannot be captured by a check).
- [x] T024 Draw the waveform at the level the sound is heard at: scale the bars by the boost gain in `src/ui/clip/waveform.ts` (`setGain`/`gainNow`, clamped), apply it from `src/ui/clip/boost.ts`, and scale the carried echo in `src/ui/recording/live-timeline.ts` — so a quiet take the boost lifts does not draw as a flat line the person cannot read. Asserted in the `e2e/checks/export.spec.ts` check (the bars are taller with the switch on, and back at the recording's level with it off).
- [x] T025 Read a kept stretch in its **own take's** seconds: add `ExportPlan.localPieces()` (`LocalPiece`), measure from it in `src/infra/sound-boost.ts` (`measureKept(decoded, plan.localPieces())`, `boostGain(plan, boost)`) and in `src/infra/offline-encoder.ts`. A piece's `from`/`to` are the **recording's**, so reading them against one take's buffer lands past its end and a two-take clip is measured by its first take alone — one gain, far too large, over both, which is why a second take saturated. Proved in `src/domain/clip/ExportPlan.test.ts` (the second take's stretch is 0s…5s of that take) and caught by the two-take, two-level `e2e/checks/export.spec.ts` check.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup; **blocks** every story.
- **User Stories (Phase 3+)**: depend on Foundational; then independent of one another.
- **Polish (Phase 6)**: depends on the stories being complete.

### Within the Foundational phase

- T002 → T003, T004 → T005 (a rule's test follows the rule; the test is written to fail first).
- T006 → T007.
- T008 → T009.
- T010 → T011 (the encoder calls the measurement) and T008 (the plan must carry the flag).
- T002/T004 (measurement and rule) have no dependency on each other and can run in parallel.

### User Story Dependencies

- **US1 (P1)**: after Foundational. Its check (T014) is the one the suite grows.
- **US2 (P2)**: after Foundational; T016 (the check) extends T014, so it follows US1's test task.
- **US3 (P2)**: after Foundational; independent of US1 and US2.

### Parallel Opportunities

- Setup and the two domain modules: T001, T002, T004 in parallel.
- Their tests: T003, T005 in parallel.
- T006, T008 in parallel (different files).
- T012 and T013 in parallel (different files).
- T020 and T021 in parallel.

---

## Parallel Example: Foundational

```bash
# The measurement and the rule are separate modules with no dependency between them:
Task: "Implement the EBU R128 measurement in src/domain/sound/Loudness.ts"
Task: "Implement the target, the ceiling and gainFor in src/domain/sound/SoundBoost.ts"

# And their tests, in parallel:
Task: "Prove the measurement in src/domain/sound/Loudness.test.ts"
Task: "Prove the gain rule in src/domain/sound/SoundBoost.test.ts"
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 1: the word in `GLOSSARY.md`.
2. Phase 2: the measurement, the rule, the switch, the plan and the seam.
3. Phase 3: the review's gain and the export check.
4. **Stop and validate**: a quiet clip plays and exports at the target — this is the whole feature's value.

### Incremental delivery

1. Setup + Foundational → the rules and the seam.
2. US1 → a clip is boosted by default → the MVP.
3. US2 → the switch is the person's, and the recording comes back whole.
4. US3 → a profile fixes it, so a way of working cannot get it wrong.
5. Polish → the words, the recipe, the gate, the pull request.

---

## Notes

- `[P]` marks different files with no dependency; the two tasks in Phase 4/5 that extend
  `e2e/checks/export.spec.ts` are deliberately **not** parallel.
- The switch reuses the clip-property and profile machinery, so US2 and US3 are mostly
  **proof** rather than new code — the design's point (`research.md`, "The boost is a clip
  property").
- One feature, one or two checks: `export.spec.ts` walks the sound of the file (on, then off),
  and `profiles.spec.ts` walks the profile's guardrail. The review's own audio cannot be
  captured by a check; it is the shared-rule tests plus a real session, as
  `quickstart.md` says.
- Nothing derived is persisted: the measurement is taken again when a restored clip is opened
  (`data-model.md`, `boostGain`).
