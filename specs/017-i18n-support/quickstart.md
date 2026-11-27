# Quickstart: proving the i18n feature

**Phase 1 output** | Branch: `feat/i18n-support` | Date: 2026-11-27

How to prove the feature end to end, and how to add a language. It names the commands and
what a person should see; it does not repeat the mechanism's details — those are in
[contracts/i18n-api.md](./contracts/i18n-api.md) and [data-model.md](./data-model.md).

## Prerequisites

```bash
npm ci          # the app's dependencies (Node 22)
```

No new dependency is added by this feature; nothing else to install.

## 1. Prove the mechanism in node

The rules that are not drawn are proved by unit tests beside them (verification skill).

```bash
npx vitest run src/ui/i18n/
```

Expected:

- `locale.test.ts` — `resolveLocale` returns `es_ES` for `es`, `es-MX`, `es_ES`;
  `en_UK` for `en`, `en-GB`, and for `fr`, `zh-Hant-TW`, `undefined` and `''`.
- `index.test.ts` — `t()` returns the Spanish sentence under `es_ES`, the English one
  under `en_UK`, the **English** one when the active catalogue is missing a key, and
  substitutes `{name}` values.
- `catalogs.test.ts` — `en_UK` and `es_ES` hold the **same** key set in both directions,
  and no value is empty.
- `dom.test.ts` — the pass fills a small document's `data-i18n*` elements, and every key
  marked in `web/index.html` and `web/help.html` exists in both catalogues.

The whole suite, the type check and the build (the change touches `web/` and `src/`):

```bash
npm run lint && npm run typecheck && npx vitest run && npm run build
```

## 2. Prove the language in a browser

The language is drawn, so it is proved in the real app (verification skill).

```bash
npx playwright test --config e2e/playwright.config.ts e2e/checks/i18n.spec.ts
```

The check opens the app in a browser context whose preferred language is **Spanish**
(`browser.newContext({ locale: 'es' })`) and asserts what a person sees:

- a shell label is Spanish (for example the record button's label, or the theme toggle's
  accessible name);
- a dialog opened in Spanish shows Spanish (for example the help panel, or a publish
  dialog);
- the guide page (`help.html`) is Spanish, tab title included;
- a context whose preferred language is **English** (and one that is unsupported, e.g.
  `fr`) is unchanged — English throughout.

Expected: the check passes; an unsupported language shows English, never a key or a blank.

## 3. Prove it by hand (optional)

```bash
npm run dev
```

Open the app and set the browser's preferred language to Spanish (or use a Spanish
profile), then reload:

- the toolbar, the source row and the timeline are Spanish;
- open the clip properties, the annotate options, the help panel and the guide page — all
  Spanish;
- an export and a publish dialog are Spanish;
- set the browser back to English (or any unsupported language) and reload — English
  throughout, word for word as before this feature.

## 4. Add a language (the extensibility proof)

Adding a third language must touch **no view or interaction code** (spec FR-011, SC-004).

1. Copy `src/ui/i18n/catalogs/en_UK.ts` to `catalogs/<code>.ts` (for example `fr.ts`) and
   translate every value. Keep the keys unchanged.
2. Add the code to `SUPPORTED_LOCALES` in `src/ui/i18n/locale.ts`, and map its primary
   subtag in `resolveLocale`.
3. Type-check and run the node tests: the compiler and `catalogs.test.ts` will reject a
   catalogue missing a key, and `dom.test.ts` will catch a key marked in the markup but not
   present.

Expected: a browser set to that language shows the app in it, with no change to any view.
The full guide is in the feature's [research.md](./research.md) and the spec's US4.

## What is not proved here

- A **real screen share** is the user's to run (verification skill); this feature does not
  touch the recorder's flow, so no real session is needed for it.
- **Date and number formatting** is out of scope (spec Assumptions), so nothing here proves
  a localized date.
- The **English wording is unchanged** is asserted by the browser check on the surfaces it
  visits, not by a full word-for-word diff of every string; a reviewer reads the English
  catalogue against the current interface as the slice that moves the strings lands.
