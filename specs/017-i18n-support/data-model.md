# Data Model: Internationalization (i18n) — Spanish and English

**Phase 1 output** | Branch: `feat/i18n-support` | Date: 2026-11-27

The feature's data is small and mostly static: a registry of the languages the app speaks,
one catalogue of text per language, and the active language chosen at load. Nothing is
stored and nothing is persisted (there is no chooser), so there are no lifecycles beyond
"read at load, used for the life of the page".

---

## Entity: Locale

One of the languages the app speaks.

| Field | Type | Rules |
|---|---|---|
| `code` | `'en_UK' \| 'es_ES'` | The app's own name for the language, not a BCP 47 tag. `en_UK` is the default. |
| `catalogue` | `TranslationCatalogue` | The sentences for this language (below). |

- `SUPPORTED_LOCALES = ['en_UK', 'es_ES'] as const` and `DEFAULT_LOCALE = 'en_UK'`.
- English is the **source**: every key is defined there, and it is the fallback for any
  missing entry in another language (spec FR-006, FR-008).
- `es_ES` is the only other locale in this version; the set is open (spec US4).

## Entity: Locale preference

The language the person's browser or operating system declares.

| Field | Type | Rules |
|---|---|---|
| `tag` | `string \| undefined` | Read from `navigator.language` in the entry module; never stored. |

**Resolution** (`resolveLocale(tag) -> LocaleCode`, a pure function):

1. No tag, or empty → `DEFAULT_LOCALE` (`en_UK`).
2. Take the **primary subtag**: lowercase everything before the first `-` or `_`
   (`es-MX` → `es`, `en-GB` → `en`, `zh-Hant-TW` → `zh`).
3. `es` → `es_ES`; `en` → `en_UK`.
4. Anything else → `en_UK` (unsupported languages fall back to English; no scanning of a
   list of alternatives — spec Edge Cases).

## Entity: Translation key

The stable, language-independent identifier for one user-facing sentence.

| Field | Type | Rules |
|---|---|---|
| `key` | `TranslationKey` | `keyof typeof en_UK`. Flat, dot-notation, lowercase (`record.button`). Written once; never renamed as languages are added. |

`TranslationKey` is derived from the English catalogue, so a key the English catalogue does
not define cannot be passed to `t()` (a compile error), and a Spanish catalogue missing a
key is a compile error too.

**Namespaces** (the shape of the catalogue; representative keys, not the full list):

| Namespace | Covers | Example key |
|---|---|---|
| `header.*` | toolbar: theme, help, agent chip, the two pills | `header.theme.toggle` |
| `sources.*` | Screen, Webcam, Mic, camera picker, Import | `sources.screen.label` |
| `record.*` | the record button and the live badge | `record.button.start` |
| `timeline.*` | play, NOW, length, ENCODING, undo | `timeline.encoding.left` |
| `clip.*` | the clip properties panel: title, description, logo, add to export, annotation colour, clip size, export resolution, boost | `clip.addToExport.blocked` |
| `annotation.*` | the kinds (arrow, image, text, magnifier, sound), the colours, the duration, the text entry | `annotation.kind.arrow` |
| `export.*` | the menu items and their notes, the export status | `export.menu.webm.note` |
| `publish.bluesky.*` | the Bluesky dialog and its status lines | `publish.bluesky.signin.note` |
| `publish.youtube.*` | the YouTube dialog and its status lines | `publish.youtube.visibility.private` |
| `profile.*` | the pill, the list, the profile dialog, the lock tooltip | `profile.lock.fixed` |
| `project.*` | the list, the project dialog, the overview, in-progress/finished | `project.progress.finished` |
| `help.*` | the in-app help panel's steps | `help.step.record` |
| `guide.*` | the guide page's prose and its tab title | `guide.step.cut` |
| `status.*` | status lines, toasts and errors that are not tied to one surface | `status.export.failed` |

Brand marks (`DemoClip`, the logo names) and the person's own text (clip title and
description, project name and description, profile name) are **not** keys (spec FR-013,
FR-014, Clarification 3).

## Entity: Translation catalogue

The set of sentences for one language.

| Field | Type | Rules |
|---|---|---|
| — | `Record<TranslationKey, string>` | Flat: key → text. Every key in `en_UK`; `es_ES` typed as the same record, so it cannot miss or add a key. |
| value | `string` | Non-empty. May contain `{name}` placeholders for `t()` to substitute. No plural forms (spec FR-018). |

`en_UK` is the source of truth and holds today's exact words (spec FR-006, SC-006).

## Entity: Active language

The locale the page is using, chosen once at load.

| Field | Type | Rules |
|---|---|---|
| `active` | `LocaleCode` | Set by `setLocale(resolveLocale(navigator.language))` in the entry, before anything is drawn. Fixed for the life of the page (spec Assumptions). |

**Transition**: none. It is set once at load; a change to the browser language takes effect
on the next load (there is no chooser). The page's `lang` attribute is set from it.

## The markup contract

A static element names its sentence with an attribute; the startup pass fills it.

| Attribute | Applies to | Sets |
|---|---|---|
| `data-i18n="key"` | any element | `textContent` |
| `data-i18n-html="key"` | any element | `innerHTML` — for a sentence carrying first-party markup (the guide's `<strong>`) |
| `data-i18n-aria-label="key"` | any element | the `aria-label` attribute |
| `data-i18n-title="key"` | any element | the `title` attribute |
| `data-i18n-placeholder="key"` | input, textarea | the `placeholder` attribute |

- An element **keeps its current English text** as the pre-paint content; the pass
  overwrites it from the active catalogue (research Decision 4).
- The pass walks the marked elements once, synchronously, at startup.
- Elements a module builds at runtime are not marked; that module calls `t()` directly.

## App-declared labels → keys

A label the app declares becomes a key, resolved where it is drawn. This is what keeps the
app's own vocabulary translated (spec FR-019) while the person's text and the brand marks
are not.

| Declared today | Where it moves | Resolved by |
|---|---|---|
| `ClipProperty.label` (`'Title'`, `'Add to export'`, …) | the value becomes a key (`clip.title`, …) | the properties panel and the profile sheet through `t()`; the automation surface through `tIn('en_UK', …)` |
| `AnnotationPlugin` kind name and property labels | keys (`annotation.kind.arrow`, …) | the annotate options, the inspector, the lane |
| `AnnotationColour.COLOUR_LABELS` | **out of `domain/`** into the view, keyed by colour id | the colour choices and the properties panel |
| `StockSounds` `label` | **out of `domain/`** into the view, keyed by sound name | the sound preferences |
| `ExportResolution` level labels (`'1080p'`, `'Clip size'`) | view keys (the numbers stay in `domain/`) | the clip properties panel |
| `Visibility` names (`private`, `unlisted`, `public`) | view keys for the three labels (the names stay in `domain/`) | the YouTube dialog |
| `LOGOS` labels (`'DemoClip'`, `'Graditone'`) | **unchanged** — brand marks, not translated | — |

## Validation rules

- **Parity, both directions**: the key sets of `en_UK` and `es_ES` are equal — no key
  missing from Spanish, no orphan key (spec FR-007, FR-017, SC-005).
- **No empty value**: every value in every catalogue is a non-empty string.
- **Compile-time exhaustiveness**: `es_ES` is `Record<TranslationKey, string>`; `t()` takes
  a `TranslationKey`.
- **Every marked key exists**: every `data-i18n*` key in `web/index.html` and
  `web/help.html` is present in both catalogues (research Decision 4).
- **No literal user-facing text**: a user-facing string is a key, not a literal — the
  exception being brand marks and the person's own text (spec FR-005, FR-010, FR-013,
  FR-014).
