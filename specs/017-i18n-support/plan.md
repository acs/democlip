# Implementation Plan: Internationalization (i18n) — Spanish and English

**Branch**: `feat/i18n-support` | **Date**: 2026-11-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-i18n-support/spec.md`

## Summary

DemoClip speaks two languages: English (`en_UK`), today's language and the default, and
Spanish (`es_ES`). The language is read from the browser's preferred language at load —
no in-app chooser — and every user-facing string, in the page, the guide and the view
modules, comes from a per-language **catalogue** rather than from text written into the
markup or the code. English is the source of truth and the fallback; the two catalogues
are held in step so a half-translated language cannot ship.

The approach mirrors Graditone's, which has already proved it: a small **locale registry**
with a pure resolver, **one flat catalogue per language** bundled with the app (never
fetched), a tiny `t(key, params?)` with English fallback, and a parity check. No i18n
library. The one addition DemoClip needs that Graditone's React app did not is a
**DOM pass**: the app's shell is static HTML, so translatable elements carry a key and a
startup pass fills them from the catalogue, while modules that build the DOM at runtime
call `t()` directly. User-facing labels that today sit in `src/domain/` (colour names,
stock-sound names) move to the view, so the domain keeps ids and rules only.

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), ES modules; Vite 8 builds the app; Node 22 runs the tools and the MCP server.

**Primary Dependencies**: **No new dependency** — no i18n library. Existing `mediabunny` and `@atproto/oauth-client-browser` are untouched; no new dev dependency either (the parity and key checks run in the existing Vitest/node setup).

**Storage**: N/A — the active language is read from the browser at load (`navigator.language`) and never stored, because there is no chooser (spec Assumptions, Clarifications). Nothing is written to `localStorage` or IndexedDB for this feature.

**Testing**: Vitest in node beside the mechanism — the locale resolver, `t()`'s fallback and value substitution, and catalogue parity (both directions, no empty value); Playwright checks under `e2e/checks/` load the real app and the guide page with the browser's preferred language set to Spanish and assert that visible strings are Spanish, and that an English browser is unchanged.

**Target Platform**: Modern browsers (Chrome, Firefox, Safari), installed as a PWA, offline; nothing leaves the machine.

**Project Type**: Single-page web app (`src/`, `web/`) plus the MCP server (`mcp/`) released with it.

**Performance Goals**: First paint is unchanged — the catalogues travel in the bundle, so there is no fetch and no added wait (SC-007). The DOM pass runs synchronously at startup, before the app's flows build their own DOM.

**Constraints**: English is the source of truth and the fallback; the catalogues must stay in step; no plural forms (a count-bearing sentence is written to read at any count); the app's name and logo marks and the person's own text are never translated; agent-facing text stays English; the domain stays pure.

**Scale/Scope**: Two locales, a few hundred keys. The change reaches the whole shell (`web/index.html`, `web/help.html`), the two entries (`web/main.ts`, `web/help-page.ts`), and every `src/ui/` module that draws a label, a status line, a toast, an error or an accessible name; plus the few user-facing labels currently held in `src/domain/`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Verdict |
|---|---|---|
| I. The skills are the constitution | The plan follows **domain-model** (the mechanism is view infrastructure; no rule is added to `domain/`), **verification** (node tests for the resolver/`t()`/parity, a browser check for what is drawn), **project-workflow** (one change per PR, CI owns the version), **overview** (where code lives) and **branding** (the name is live text, the marks are not translated). No skill needs changing. | PASS |
| II. `src/domain/` is pure | The mechanism lives under `src/ui/i18n/`, which imports nothing from `domain/`. The change **strengthens** the boundary: user-facing labels now in `domain/` (`AnnotationColour.COLOUR_LABELS`, `StockSounds` labels) move to the view, leaving ids and rules behind. | PASS |
| III. Every rule has a test beside it | `resolveLocale` (each tag kind), `t()` (fallback to English, value substitution, missing key) and catalogue parity (both directions, no empty value) each get a node test beside the module. | PASS |
| IV. What is drawn, played or encoded is proved in a browser | A committed check in `e2e/checks/` loads the app with the browser language set to Spanish and asserts what a person sees (labels, a dialog, the guide page); an English load is asserted unchanged. The share picker is untouched. | PASS |
| V. The words come first | `locale`, `catalogue`, `translation key`, `active language` and `fallback` are written into `docs/GLOSSARY.md` in the first change, before any code. | PASS |
| VI. One change per PR, CI owns the version | The delivery is sliced below into independent PRs; `package.json` is never bumped by hand. | PASS |

No violations; the Complexity Tracking table stays empty.

**Post-design re-check (after Phase 1)**: unchanged. The design adds one cohesive view
group (`src/ui/i18n/`) and a startup pass, converts declared labels to keys, and moves a
handful of labels out of `domain/` — the existing layers, no new kind of module, no new
dependency. The glossary change is the first slice (principle V before code), and the
browser check is committed with the slice that converts the shell (principle IV as the
feature lands). No gate needs justification.

## Project Structure

### Documentation (this feature)

```text
specs/017-i18n-support/
├── plan.md              # This file
├── research.md          # Phase 0: the decisions and their alternatives
├── data-model.md        # Phase 1: the catalogue schema, key namespaces, the DOM contract
├── quickstart.md        # Phase 1: how to prove the feature end to end
├── contracts/
│   └── i18n-api.md      # The mechanism's TypeScript contract and the markup contract
└── tasks.md             # Phase 2 output (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
src/ui/i18n/                       # NEW — the mechanism (view infrastructure)
├── locale.ts                      # SUPPORTED_LOCALES, DEFAULT_LOCALE, resolveLocale() — pure
├── locale.test.ts                 # es, es-MX, en, en-GB, unsupported, empty, complex tags
├── index.ts                       # t(key, params?), setLocale(), currentLocale(), tIn(), TranslationKey
├── index.test.ts                  # fallback to English, value substitution, missing key
├── dom.ts                         # applyTranslations(root): the data-i18n pass — DOM
├── dom.test.ts                    # the pass over a small document, and that marked keys exist
├── catalogs/
│   ├── en_UK.ts                   # the source of truth: every key, today's words, `as const`
│   └── es_ES.ts                   # Spanish: typed Record<TranslationKey, string>
└── catalogs.test.ts               # parity both ways, no empty value, no orphan key

src/ui/
├── shell/help.ts                  # the help panel's steps drawn through t()
├── shell/version.ts               # the version line, the "reload" offer, drawn through t()
├── clip/clip-properties.ts        # declared labels become keys; resolved where drawn
├── clip/colour-choices.ts         # colour labels come from the view, keyed by colour id
├── clip/sounds.ts                 # stock-sound names drawn through t()
├── clip/timeline-ui.ts            # status and readouts drawn through t()
├── annotating/*-plugin.ts         # kind names and property labels drawn through t()
├── annotating/text-entry.ts       # the dialog's labels and buttons drawn through t()
├── exporting/export-menu.ts       # the menu items and notes drawn through t()
├── publishing/publish-dialog.ts   # Bluesky dialog strings drawn through t()
├── publishing/youtube-dialog.ts   # YouTube dialog strings drawn through t()
├── profile/*.ts                   # the pill, the list, the dialog, the lock tooltips
├── project/*.ts                   # the list, the dialog, the overview, the states
├── agent/*.ts                     # the automation surface resolves its labels in ENGLISH
└── dom.ts                         # toast() and setStatus() take keys, not literals

src/domain/
├── annotation/AnnotationColour.ts # keeps COLOURS and the rules; COLOUR_LABELS moves out
└── sound/StockSounds.ts           # keeps names and files; labels move out (view keys)

web/
├── index.html                     # every translatable element carries a data-i18n key
├── help.html                      # the guide's prose carries keys; its tab title too
├── main.ts                        # setLocale(resolveLocale(navigator.language)); applyTranslations()
└── help-page.ts                   # the same, for the guide page

src/main.ts                        # sets the page's lang attribute; no other change
docs/
├── GLOSSARY.md                    # the words, first
├── FEATURES.md                    # the i18n line under "The app"
└── FILES.md                       # the new module
e2e/
├── checks/i18n.spec.ts            # the app and the guide in Spanish; English unchanged
└── playwright.config.ts           # a Spanish-language context (locale: 'es')
```

**Structure Decision**: The mechanism is a single cohesive group under `src/ui/i18n/`,
because it is view infrastructure — the app's text — and `src/ui/` already holds pure,
node-testable modules beside the DOM (recording rows, size estimates). It is not a new
top-level layer, and it imports nothing from `domain/`. Declared labels become keys
resolved through `t()` where they are drawn; the automation surface resolves the same keys
in English so agent output is stable. No new package, no new framework.

## Delivery Slices

Each slice is its own branch and pull request, starting from `origin/main`, and each
leaves the app working.

1. **The words.** `docs/GLOSSARY.md` (the i18n words), `docs/FEATURES.md` (a line under
   "The app"), `docs/FILES.md` (the future module). No code. Constitution V holds before
   anything is built.
2. **The mechanism.** `src/ui/i18n/`: the locale registry and resolver, the two
   catalogues (seeded with the shell's strings), `t()` with fallback and substitution, the
   DOM pass, and their tests (resolver, `t()`, parity). The app still shows English
   everywhere; the mechanism is exercised by its tests. The app's `lang` attribute is set.
3. **The shell and the guide.** Every translatable element in `web/index.html` and
   `web/help.html` carries its key; the entries set the locale and run the pass; the guide
   page is translated with its body and its tab title. The committed browser check lands
   here: the app and the guide in Spanish, English unchanged.
4. **The dynamic surfaces.** The declared labels become keys and every flow that draws
   text calls `t()`: clip properties, the annotate options, the properties inspector, the
   text entry, the export menu, the publish dialogs, the profile and project surfaces, the
   status lines, toasts and errors, and the accessible names. The user-facing labels now in
   `domain/` move to the view. The agent surface resolves its labels in English.
5. **The words, again.** The glossary entry gains anything the slices named differently;
   the quickstart's "add a language" steps are checked against the code.

## Complexity Tracking

No constitution violations to justify.
