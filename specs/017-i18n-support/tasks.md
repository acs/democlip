---
description: "Task list for the i18n feature"
---

# Tasks: Internationalization (i18n) — Spanish and English

**Input**: Design documents from `/specs/017-i18n-support/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/i18n-api.md, quickstart.md

**Tests**: Included, because this project's constitution requires them — every rule in
`src/` has a unit test beside it (principle III), and what is drawn is proved in a browser
(principle IV). The spec (SC-008) and the plan name the same tests.

**Organization**: Tasks are grouped by user story so each can be implemented and tested on
its own. `en_UK` is the source of truth; `es_ES` must always hold the same keys.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story it serves (US1, US2, US3, US4)
- Every task names the exact file path it touches

## Path Conventions

Single project: the app is `src/` and `web/`, the end-to-end suite is `e2e/`, the second
package is `mcp/`. The mechanism lives under `src/ui/i18n/` (plan.md, Structure Decision).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The words come first (constitution V) before any code.

- [x] T001 [P] Write the i18n words into `docs/GLOSSARY.md` — **locale**, **catalogue**, **translation key**, **active language**, **fallback** — in a short section, before any code uses them
- [x] T002 [P] Add the i18n line to the "The app" section of `docs/FEATURES.md`, and the new module (`src/ui/i18n/`) to the module map in `docs/FILES.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The mechanism every story builds on. **No story work begins until this phase is complete.**

- [x] T003 Create the locale registry and pure resolver in `src/ui/i18n/locale.ts`: `SUPPORTED_LOCALES`, `DEFAULT_LOCALE`, `resolveLocale(tag)` per `data-model.md` **Locale.code** and **Locale preference.tag**, and the contract in `contracts/i18n-api.md` (`resolveLocale`)
- [x] T004 [P] Test the resolver in `src/ui/i18n/locale.test.ts`: `es`/`es-MX`/`es_ES` → `es_ES`; `en`/`en-GB` → `en_UK`; `fr`, `zh-Hant-TW`, `undefined`, `''` → `en_UK`
- [x] T005 Create the English catalogue `src/ui/i18n/catalogs/en_UK.ts` as the source of truth (`as const`), seeded with the shell keys — keys follow `data-model.md` **Translation key.key** (flat, dot-notation)
- [x] T006 [P] Create the Spanish catalogue `src/ui/i18n/catalogs/es_ES.ts`, typed `Record<TranslationKey, string>` and seeded to match, per `data-model.md` **Translation catalogue** value (non-empty; `{name}` placeholders; no plural forms)
- [x] T007 Create the `t()` API in `src/ui/i18n/index.ts`: `TranslationKey`, `t(key, params?)`, `tIn(code, key, params?)`, `setLocale(code)`, `currentLocale()` — per `contracts/i18n-api.md` and `data-model.md` **Active language.active**
- [x] T008 [P] Test `t()` in `src/ui/i18n/index.test.ts`: the active sentence; the English fallback for a missing key; `{name}` substitution; a key missing everywhere returns the key, never blank
- [x] T009 Create the DOM pass `applyTranslations(root?)` in `src/ui/i18n/dom.ts`, reading the `data-i18n*` attributes of the `data-model.md` markup contract (`data-i18n`, `data-i18n-aria-label`, `data-i18n-title`, `data-i18n-placeholder`)
- [x] T010 [P] Add the catalogue parity test in `src/ui/i18n/catalogs.test.ts`: the two key sets are equal in **both** directions and no value is empty, per `data-model.md` Validation rules
- [x] T011 [P] Test the DOM pass in `src/ui/i18n/dom.test.ts` over a small in-memory document: text, `aria-label`, `title` and `placeholder` are filled; an unmarked element is untouched

**Checkpoint**: The mechanism resolves, translates and applies — the stories can begin.

---

## Phase 3: User Story 1 - A Spanish speaker gets the app in Spanish (Priority: P1) 🎯 MVP

**Goal**: A browser set to Spanish shows the app and the guide in Spanish on load.

**Independent Test**: Load `web/index.html` and `web/help.html` in a browser whose preferred
language is Spanish and confirm the shell and the guide are Spanish; load them in English
and confirm the words are exactly today's.

- [x] T012 [US1] Mark every translatable element in `web/index.html` with its `data-i18n*` key (per the `data-model.md` markup contract), keeping the current English text as the pre-paint content
- [x] T013 [US1] Add the shell keys to both catalogues `src/ui/i18n/catalogs/en_UK.ts` and `src/ui/i18n/catalogs/es_ES.ts` (English from the markup's own words; Spanish translations)
- [x] T014 [US1] Mark the guide's prose and its tab title in `web/help.html` with `data-i18n*` keys, and add the `guide.*` keys to both catalogues
- [x] T015 [US1] Wire the app entry `web/main.ts`: `setLocale(resolveLocale(navigator.language))`, set `document.documentElement.lang`, and `applyTranslations()` as the first action (per `contracts/i18n-api.md`, the startup contract)
- [x] T016 [US1] Wire the guide entry `web/help-page.ts` the same way, before it reads the theme and the version
- [x] T017 [US1] Add the marked-key test to `src/ui/i18n/dom.test.ts`: every `data-i18n*` key in `web/index.html` and `web/help.html` exists in both catalogues
- [x] T018 [US1] Add the Spanish browser check `e2e/checks/i18n.spec.ts` (the app shell and the guide) and the Spanish-language context in `e2e/playwright.config.ts` (`locale: 'es'`), asserting what a person sees

**Checkpoint**: A Spanish browser sees the app in Spanish — the MVP is deliverable.

---

## Phase 4: User Story 2 - The English experience is untouched (Priority: P1)

**Goal**: English is the source and the fallback; the English interface is unchanged.

**Independent Test**: Open the app in an English browser and see today's words; open it with
a Spanish catalogue missing an entry and see the English sentence, never a key or a blank.

- [x] T019 [US2] Add the English and unsupported-language assertions to `e2e/checks/i18n.spec.ts`: an English context shows the catalogue's English; a `fr` context shows English with no key and no blank
- [x] T020 [US2] Add a completeness test to `src/ui/i18n/catalogs.test.ts`: every key resolves in **both** locales (no value falls through to the key itself), per `data-model.md` Validation rules

**Checkpoint**: English is unchanged and every unsupported language degrades to English.

---

## Phase 5: User Story 3 - Every surface is translated, nothing is left behind (Priority: P2)

**Goal**: Every user-facing string in every surface — dialogs, panels, status lines, toasts,
errors, tooltips and accessible names — comes from a catalogue.

**Independent Test**: Switch to Spanish and visit every surface — record, cut, annotate,
change a clip property, export, open each publish dialog, open a profile and a project, open
the help panel and the guide — and find no English left.

> Each task below adds the keys it uses to **both** catalogues (`en_UK.ts`, `es_ES.ts`) and
> converts its surface. Because the two catalogue files are shared, these tasks are run in
> sequence; the surfaces themselves are independent.

- [x] T021 [US3] Convert the clip-property labels to keys in `src/ui/clip/clip-properties.ts` and resolve them where drawn (the properties panel and the profile sheet), per `data-model.md` **App-declared labels → keys**
- [x] T022 [P] [US3] Move the colour labels out of `src/domain/annotation/AnnotationColour.ts` into the view (`src/ui/clip/colour-choices.ts`), keyed by colour id, and update `src/ui/clip/clip-properties.ts` to resolve them
- [x] T023 [P] [US3] Move the stock-sound labels out of `src/domain/sound/StockSounds.ts` into the view (`src/ui/clip/sounds.ts`), keyed by sound name, keeping the names and files in the domain
- [x] T024 [US3] Translate the annotation kinds' names and property labels in `src/ui/annotating/*-plugin.ts` and the annotate options (`src/ui/annotating/annotate-options.ts`)
- [x] T025 [US3] Translate the text-entry dialog in `src/ui/annotating/text-entry.ts` (its label, Cancel and Add)
- [x] T026 [US3] Translate the export menu in `src/ui/exporting/export-menu.ts` (each item's name and note)
- [x] T027 [US3] Translate the Bluesky dialog in `src/ui/publishing/publish-dialog.ts` (notes, field labels, buttons, status lines)
- [x] T028 [US3] Translate the YouTube dialog and its visibility labels in `src/ui/publishing/youtube-dialog.ts`
- [x] T029 [US3] Translate the profile surfaces in `src/ui/profile/` (the pill, the list, the dialog, the lock tooltip)
- [x] T030 [US3] Translate the project surfaces in `src/ui/project/` (the list, the dialog, the overview, the in-progress/finished states and the progress line)
- [x] T031 [US3] Translate the timeline readouts and status lines in `src/ui/clip/timeline-ui.ts` (NOW, length, ENCODING, the time left)
- [x] T032 [US3] Make `toast()` and `setStatus()` take a key in `src/ui/dom.ts`, and translate the flows' messages that pass through them
- [x] T033 [US3] Translate the in-app help panel's steps in `src/ui/shell/help.ts`
- [x] T034 [US3] Translate the version line and the reload offer in `src/ui/shell/version.ts`
- [x] T035 [US3] Translate the accessible names and tooltips across the shell and the dialogs (`aria-label`, `title`, `placeholder`) through the same mechanism
- [x] T036 [P] [US3] Resolve the automation surface's labels in English via `tIn('en_UK', …)` in `src/ui/agent/` (the surface reuses declared labels that are now keys)
- [x] T037 [US3] Fold the dynamic-surface assertions into `e2e/checks/i18n.spec.ts`: a dialog (the help panel or a publish dialog) and a dynamic surface in Spanish

**Checkpoint**: A Spanish browser finds no English on any surface.

---

## Phase 6: User Story 4 - A new language is a small change (Priority: P3)

**Goal**: A third language is a catalogue and a registry entry, with no view change; a
half-written language cannot ship.

**Independent Test**: Add a French catalogue, register it, set the browser to French, and see
French with no view change; remove a key and watch the check fail.

- [x] T038 [P] [US4] Write the "add a language" steps in `specs/017-i18n-support/quickstart.md` and check them against the code (a catalogue, a registry entry, a resolver mapping)
- [x] T039 [P] [US4] Add the guard test `src/ui/i18n/no-branching.test.ts`: no module outside `src/ui/i18n/` names a locale code (`'en_UK'`/`'es_ES'`) or branches on the language, proving FR-010 and FR-011
- [x] T040 [US4] Walk the "add a language" steps once end to end and record in the pull request that no view file changed (the extensibility proof for SC-004)

**Checkpoint**: A new language is cheap, and an incomplete one fails the build.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: The last pass over the words, the gate, and the proof.

- [x] T041 [P] Update `docs/GLOSSARY.md` and `docs/FEATURES.md` with any word the slices named differently, and confirm the glossary section is complete
- [x] T042 [P] Run the full gate: `npm run lint && npm run typecheck && npx vitest run && npm run build && npm run test:mcp`
- [x] T043 Confirm the end-to-end suite kept to **one** i18n check (folded, not grown), and that it covers the guide page as well as the app
- [x] T044 Write the pull request body per the workflow skill: what and why, how it was verified (the node tests and the Spanish-browser check, with the result), what was deliberately not done (a language chooser, localized date/number formatting, RTL), and the caveats

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies; can start at once.
- **Foundational (Phase 2)**: depends on Setup for the words (constitution V); blocks every story.
- **US1 (Phase 3)**: depends on Foundational; delivers the MVP.
- **US2 (Phase 4)**: depends on US1 (its English assertions need the marked shell); its fallback behaviour is already in Foundational.
- **US3 (Phase 5)**: depends on Foundational; independent of US1/US2 in logic, but shares the catalogue files, so it follows US1 in practice.
- **US4 (Phase 6)**: depends on Foundational (the registry and the parity check); no view work.
- **Polish (Phase 7)**: after the stories it names.

### Within a story

- Tests beside the code they prove (Foundational: T004, T008, T010, T011).
- US1: mark the markup (T012, T014), add keys (T013), wire the entries (T015, T016), then the tests (T017, T018).
- US3: convert a surface and its keys together (T021–T035); the automation surface (T036) is independent.

### Parallel opportunities

- **Setup**: T001 and T002 (different files).
- **Foundational**: T004, T008, T010, T011 (test files) once their subject exists.
- **US3**: T022 (colour labels) and T023 (sound labels) move domain labels and touch files no other US3 task does; T036 (the automation surface) touches only `src/ui/agent/`. The remaining US3 tasks share the catalogue files and are sequenced.
- **US4**: T038 and T039 (different files).
- **Polish**: T041 and T042.

---

## Parallel Execution Examples

```text
# Setup — two writers, two files
T001  docs/GLOSSARY.md
T002  docs/FEATURES.md + docs/FILES.md

# Foundational tests — once the subjects exist
T004  src/ui/i18n/locale.test.ts
T008  src/ui/i18n/index.test.ts
T010  src/ui/i18n/catalogs.test.ts
T011  src/ui/i18n/dom.test.ts

# US3 — the two domain-label moves and the agent surface, on their own files
T022  src/domain/annotation/AnnotationColour.ts + src/ui/clip/colour-choices.ts
T023  src/domain/sound/StockSounds.ts + src/ui/clip/sounds.ts
T036  src/ui/agent/
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Setup (T001–T002) — the words.
2. Foundational (T003–T011) — the mechanism, tested.
3. US1 (T012–T018) — the shell and the guide, marked and wired, with the Spanish-browser check.
4. **Stop and validate**: a Spanish browser shows the app and the guide in Spanish; an English one is unchanged. This is a shippable increment.

### Incremental delivery

1. MVP (Setup → Foundational → US1).
2. US2 (T019–T020) — pin the English experience and the fallback.
3. US3 (T021–T037) — the dynamic surfaces, one area at a time.
4. US4 (T038–T040) — the extensibility proof.
5. Polish (T041–T044).

Each slice is its own branch and pull request (plan.md, Delivery Slices), starting from
`origin/main`; CI owns the version.

---

## Notes

- `en_UK` is the source of truth; a key added to one catalogue must be added to the other,
  or the type check and `catalogs.test.ts` fail (spec FR-007, FR-017).
- A count-bearing sentence is written to read at any count — no plural forms (spec FR-018).
- Brand marks (`DemoClip`, the logo names) and the person's own text (clip/project/profile
  names) are never keys (spec FR-013, FR-014).
- The mechanism imports nothing from `src/domain/`; the two domain-label moves take text
  *out* of the domain (constitution II).
- Commit after each task or logical group; delete any temporary harness before committing.
