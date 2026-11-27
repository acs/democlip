# Research: Internationalization (i18n) — Spanish and English

**Phase 0 output** | Branch: `feat/i18n-support` | Date: 2026-11-27

The spec's clarifications already fixed the shape of the feature (no plural forms, no
in-app chooser, app labels translated but brand marks kept). What follows resolves the
technical unknowns: how the mechanism is built, where it lives, how the static shell is
translated, and how it is proved. Each decision names what was rejected.

---

## Decision 1 — A custom mechanism, no i18n library

**Decision**: Build the mechanism by hand: a locale registry with a pure resolver, one
flat catalogue per language, a `t(key, params?)` with English fallback, and a DOM pass.
Roughly the size of Graditone's (~50 lines of logic plus the catalogues).

**Rationale**: Every string is static; there is one interpolation form and no plurals
(spec FR-018, Clarification 1). The whole mechanism is a few dozen lines, fully typed,
and testable in node. Graditone reached the same conclusion for the same reasons, and the
user asked to follow that approach.

**Alternatives considered**:
- `i18next` / `react-i18next` — rejected: ~50 KB, designed for async loading, namespaces
  and plural rules this feature explicitly does not need, and a runtime dependency in an
  app whose whole promise is "nothing but the browser".
- `@formatjs/intl` / `react-intl` — rejected: ICU message syntax and build tooling for
  date/number/plural formatting that is out of scope (spec Assumptions).

---

## Decision 2 — Catalogues as typed `.ts` modules, not flat JSON

**Decision**: Each catalogue is a TypeScript module exporting one object literal
`as const` (`catalogs/en_UK.ts`, `catalogs/es_ES.ts`). The English object is the source of
truth; the Spanish object is typed `Record<TranslationKey, string>`.

**Rationale**: The project's `tsconfig` has **no** `resolveJsonModule` and has
`verbatimModuleSyntax` on; importing JSON would need a config change and default-import
handling. A `.ts` catalogue needs neither, gives `TranslationKey = keyof typeof en_UK`
for free, and makes a Spanish catalogue missing a key a **compile error**, which is the
strongest form of the parity rule (FR-007, SC-005). Graditone's flat-JSON choice is kept
in spirit — flat keys, one file per language — but not in file extension.

**Alternatives considered**:
- Flat JSON + `resolveJsonModule: true` (Graditone's) — rejected for this project: a
  tsconfig change plus `esModuleInterop`/default-import handling, for no gain over a `.ts`
  module; the compile-time exhaustiveness is equivalent.
- One big catalogue keyed by a nested object — rejected: flat, dot-notation keys are what
  Graditone used and keep the parity check a simple set comparison.

---

## Decision 3 — Compile-time keys, and a runtime parity check

**Decision**: `type TranslationKey = keyof typeof en_UK`. `t()` takes a `TranslationKey`,
so a misspelled or unknown key is a compile error. A node test asserts the two catalogues
hold the same key set **in both directions** and that no value is empty.

**Rationale**: The type catches a bad key at the call site; the test catches a Spanish
catalogue that has drifted. Two layers, because a type alone cannot stop a value being
left blank. This is exactly Graditone's `locales.test.ts` pattern.

**Alternatives considered**:
- Runtime-only validation — rejected: later feedback, no call-site safety.
- Codegen from a schema — rejected: a build step and a tool for a small, hand-written set.

---

## Decision 4 — The static shell keeps its English text; a DOM pass applies the catalogue

**Decision**: Translatable elements in `web/index.html` and `web/help.html` carry a key
attribute (`data-i18n`, `data-i18n-aria-label`, `data-i18n-title`, `data-i18n-placeholder`)
and **keep their current English text** as the pre-paint content. At startup the entry
module applies the active catalogue over every marked element. A node test reads the two
HTML files as text and asserts every marked key exists in both catalogues.

**Rationale**: The shell is static HTML shown before the deferred module runs. Stripping
the text would make the app paint empty and move first paint later, against SC-007.
Keeping the English words means an English browser sees no change and no flash; a Spanish
browser sees Spanish as soon as the module runs (a frame or two, since the catalogue is
bundled and the pass is synchronous). The catalogue stays authoritative — it overwrites
the marked elements — so the English text in the markup is a first-paint copy, not a
second source. The raw-text test catches the one real risk, a key marked in the HTML but
forgotten in a catalogue.

**Alternatives considered**:
- Remove the text from the HTML and fill it from the catalogue — rejected: a flash of
  empty shell and a later first contentful paint.
- Translate only when the locale is not English (leave English to the markup) — rejected:
  two sources for English that can drift, against the constitution's one-source rule.
- Generate the HTML from the catalogue at build time — rejected: a build step and a
  template language for a handful of pages.

---

## Decision 5 — The language is read once, from `navigator.language`

**Decision**: The entry modules (`web/main.ts`, `web/help-page.ts`) read
`navigator.language` and call `setLocale(resolveLocale(tag))`; `resolveLocale` is a pure
function on the primary subtag with `en_UK` as the default. The page's `lang` attribute is
set from the active locale. Nothing is stored.

**Rationale**: The spec (FR-001..FR-004) and Graditone both match on the primary subtag
and fall back to the default. Reading in the entry keeps the browser access in one place
per page and leaves `resolveLocale` pure and node-testable. No chooser means no storage
(Clarification 2).

**Alternatives considered**:
- Read `navigator.languages` and scan the list — rejected: the spec (Edge Cases) matches
  Graditone and uses the preferred language alone.
- Store the choice — rejected: there is no choice to store.

---

## Decision 6 — Value substitution, no plural forms

**Decision**: `t(key, params?)` replaces `{name}` occurrences with the given values. No
singular/plural selection.

**Rationale**: FR-012 needs values placed into sentences (a length, a handle, a URL);
FR-018 and Clarification 1 rule out plurals. Count-bearing copy is written to read at any
count (numbers with an invariant label), so a single form is correct.

**Alternatives considered**:
- A minimal one/other plural form — rejected by Clarification 1.
- ICU message syntax — rejected: overkill for two languages with no plural need.

---

## Decision 7 — The mechanism lives in `src/ui/i18n/`

**Decision**: One group, `src/ui/i18n/`, holding `locale.ts` (pure), `index.ts` (the
`t()` API), `dom.ts` (the pass) and `catalogs/`.

**Rationale**: The mechanism is the app's text — view infrastructure — and `src/ui/`
already holds pure, node-tested modules beside the DOM (recording rows, size estimates).
Keeping it under `ui/` respects the four layers and avoids a new top-level group. It
imports nothing from `domain/`, so principle II is untouched.

**Alternatives considered**:
- A top-level `src/i18n/` (Graditone's location) — rejected: DemoClip's architecture is
  four layers plus `state.ts`/`session.ts`/`main.ts`; a view concern belongs in `ui/`.
- Under `src/infra/` — rejected: there is no browser capability to adapt; the one browser
  read happens in the entry.

---

## Decision 8 — Declared labels become keys; the domain keeps ids and rules

**Decision**: A label the app declares (`ClipProperty.label`, an annotation plugin's kind
name, a stock-sound name) becomes a **translation key**, resolved through `t()` where it is
drawn. User-facing labels currently in `domain/` — `AnnotationColour.COLOUR_LABELS` and
`StockSounds`' `label` — move to the view, keyed by the id the domain already holds.

**Rationale**: The spec (FR-019, Clarification 3) translates the app's descriptive labels
but not brand marks. Labels are text with no rules, so principle II is better served with
them out of `domain/`. The view owns which key a colour or a sound maps to; the domain
owns the palette and the sound names it refuses.

**Alternatives considered**:
- Keep labels in `domain/` and translate at the boundary — rejected: it leaves UI text in
  the pure layer, which the domain-model skill argues against.
- Put keys inside the domain constants — rejected: a key is a view concept.

---

## Decision 9 — The automation surface resolves its labels in English

**Decision**: The agent surface (`src/ui/agent/`) resolves the same keys through an
English-only lookup (`tIn('en_UK', key)`), so its tool names and descriptions never change
with the person's language.

**Rationale**: The spec's Assumptions keep agent-facing text English: an agent reads it,
not a person, and a stable vocabulary is what an agent's calls depend on. Because the
surface reuses declared labels that are now keys, it needs the English rendering rather
than a literal.

**Alternatives considered**:
- Leave the surface's literals hardcoded — rejected: it shares the label registry with the
  panel, so it must resolve the keys anyway.
- Translate the surface too — rejected by the spec's Assumptions.

---

## Decision 10 — Proved by a Spanish browser check

**Decision**: A committed Playwright check (`e2e/checks/i18n.spec.ts`) opens the app in a
context whose preferred language is Spanish (`browser.newContext({ locale: 'es' })`, or a
`locale: 'es'` project) and asserts visible strings are Spanish — a shell label, a dialog,
and the guide page — and that an English context is unchanged.

**Rationale**: The verification skill: what is drawn is proved in a browser. Playwright's
`locale` sets both the `Accept-Language` header and `navigator.language`, which is exactly
what the mechanism reads, and it is the idiomatic way to test locale detection.

**Alternatives considered**:
- `page.addInitScript` overriding `navigator.language` — rejected: fragile and
  non-idiomatic when the context option exists.
- Only node tests — rejected: they cannot prove the DOM pass or the static pages.

---

## Summary of Decisions

| # | Question | Decision | Main alternative rejected |
|---|---|---|---|
| 1 | Library or custom | Custom mechanism, no library | i18next (oversized, async, a dependency) |
| 2 | Catalogue format | Typed `.ts` modules, `as const` | Flat JSON + `resolveJsonModule` |
| 3 | Key safety | `keyof typeof en_UK` + parity test | Runtime-only validation |
| 4 | Static shell | Keep English text; keys + startup pass | Strip the text (flash of empty) |
| 5 | Detection | `navigator.language`, primary subtag, in the entries | `navigator.languages` scan |
| 6 | Values | `{name}` substitution, no plurals | Minimal plural forms |
| 7 | Location | `src/ui/i18n/` | Top-level `src/i18n/` |
| 8 | Declared labels | Become keys; domain keeps ids | Labels left in `domain/` |
| 9 | Agent surface | Resolves keys in English | Translate the surface |
| 10 | Proof | Spanish-browser Playwright check | Node tests only |
