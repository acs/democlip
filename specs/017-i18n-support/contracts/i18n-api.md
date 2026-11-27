# Contract: the i18n API

**Phase 1 output** | Branch: `feat/i18n-support` | Date: 2026-11-27

The mechanism's whole surface: the functions the app calls, the shape of a catalogue, and
the markup attributes the startup pass reads. Anything not listed here is private.

---

## Module: `src/ui/i18n/locale.ts` (pure — no DOM)

```ts
export const SUPPORTED_LOCALES = ['en_UK', 'es_ES'] as const;
export type LocaleCode = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: LocaleCode = 'en_UK';

/**
 * The locale a raw language tag selects. The primary subtag decides (`es-MX` → `es`);
 * a missing, empty or unsupported tag falls back to DEFAULT_LOCALE.
 */
export function resolveLocale(tag: string | undefined): LocaleCode;
```

**Contract**:

- `resolveLocale('es')`, `resolveLocale('es-MX')`, `resolveLocale('es_ES')` → `'es_ES'`.
- `resolveLocale('en')`, `resolveLocale('en-GB')`, `resolveLocale('en-US')` → `'en_UK'`.
- `resolveLocale('fr')`, `resolveLocale('zh-Hant-TW')`, `resolveLocale(undefined)`,
  `resolveLocale('')` → `'en_UK'`.
- Matching is case-insensitive and splits on `-` or `_`.

## Module: `src/ui/i18n/catalogs/*.ts`

```ts
// catalogs/en_UK.ts — the source of truth
export const en_UK = {
  'record.button.start': 'Record',
  'status.encoding.left': 'ENCODING · {time} left',
  // …
} as const;

// catalogs/es_ES.ts — must hold exactly the same keys
import type { TranslationKey } from '../index.js';
export const es_ES: Record<TranslationKey, string> = {
  'record.button.start': 'Grabar',
  'status.encoding.left': 'CODIFICANDO · quedan {time}',
  // …
};
```

**Contract**: `en_UK` defines `TranslationKey = keyof typeof en_UK`. `es_ES` is typed
`Record<TranslationKey, string>` — a missing or extra key is a compile error. Values are
non-empty and may contain `{name}` placeholders.

## Module: `src/ui/i18n/index.ts`

```ts
import type { en_UK } from './catalogs/en_UK.js';
export type TranslationKey = keyof typeof en_UK;

/** Choose the active language. Called once, at startup, before anything is drawn. */
export function setLocale(code: LocaleCode): void;

/** The active language. */
export function currentLocale(): LocaleCode;

/**
 * The sentence for a key in the active language, with `{name}` values substituted.
 * Falls back to the English sentence when the active catalogue has no entry; a key
 * missing everywhere returns the key itself rather than a blank.
 */
export function t(key: TranslationKey, params?: Record<string, string | number>): string;

/**
 * The English sentence for a key, whatever the active language — for the parts of the
 * app that speak to an agent rather than a person.
 */
export function tIn(code: LocaleCode, key: TranslationKey, params?: Record<string, string | number>): string;
```

**Contract**:

- `t('record.button.start')` → `'Grabar'` under `es_ES`, `'Record'` under `en_UK`.
- `t('status.encoding.left', { time: '0:12' })` → `'ENCODING · 0:12 left'` — each
  `{name}` replaced by `String(value)`.
- A key present in English but absent from the active catalogue returns the **English**
  sentence (spec FR-008). No blank is ever returned.
- No plural selection: a count is passed as a value into a sentence written to read at any
  count (spec FR-018).

## Module: `src/ui/i18n/dom.ts` (DOM)

```ts
/** Fill every marked element under `root` (the document by default) from the active catalogue. */
export function applyTranslations(root: ParentNode = document): void;
```

**Markup contract** — the attributes the pass reads (see data-model.md):

| Attribute | Sets |
|---|---|
| `data-i18n` | `textContent` |
| `data-i18n-html` | `innerHTML` (first-party markup) |
| `data-i18n-aria-label` | the `aria-label` attribute |
| `data-i18n-title` | the `title` attribute |
| `data-i18n-placeholder` | the `placeholder` attribute |

**Contract**: the pass is idempotent and synchronous; an element with no `data-i18n*`
attribute is untouched. The static element keeps its English text as the pre-paint content;
the pass overwrites it with the active catalogue (research Decision 4).

## The startup contract

Each entry (`web/main.ts`, `web/help-page.ts`) does, as its first action:

```ts
setLocale(resolveLocale(navigator.language));
document.documentElement.lang = currentLocale().replace('_', '-');  // 'es-ES', 'en-UK'
applyTranslations();
```

**Contract**: the language is chosen once, before anything is drawn. A change to the
browser's language takes effect on the next load; nothing re-renders live, because there is
no in-app chooser (spec Clarifications).

## What this contract does not cover

- **Agent-facing text** (the automation surface's tool names and descriptions) resolves
  through `tIn('en_UK', …)`, so it never changes with the person's language.
- **Brand marks** (`DemoClip`, the logo names) and **the person's own text** (clip title and
  description, project name and description, profile name) are not keys and are never
  translated (spec FR-013, FR-014).
- **The MCP server** (`mcp/`) is unchanged: its tool names and schemas are the app's
  operations, in English.
