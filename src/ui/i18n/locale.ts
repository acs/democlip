// The languages the app speaks, and how a browser's own language tag picks one.
//
// The app reads the language the person's browser or operating system declares when it
// loads — `navigator.language` — and shows every word in it. There is no chooser in the
// app: changing the browser's language and reloading changes the app. English is the
// default and the source of truth; a language the app does not speak falls back to it.
//
// This module is pure: it decides which locale a tag selects and nothing else. The
// catalogue and `t()` live beside it in `index.ts`; the browser read happens in the page's
// entry, so nothing here touches the DOM.

/** The languages this build speaks. The set is open: a new language is a code here, a
 *  catalogue beside the others, and a line in the resolver below. */
export const SUPPORTED_LOCALES = ['en_UK', 'es_ES'] as const;

/** One of the languages the app speaks. */
export type LocaleCode = (typeof SUPPORTED_LOCALES)[number];

/** The language the app uses when it speaks none of the person's — English, the source. */
export const DEFAULT_LOCALE: LocaleCode = 'en_UK';

/** The primary subtag of a tag (`es-MX` → `es`) and the locale it selects. */
const PRIMARY_SUBTAG: Readonly<Record<string, LocaleCode>> = {
  en: 'en_UK',
  es: 'es_ES',
};

/**
 * The locale a raw language tag selects.
 *
 * Only the primary subtag matters, so `es`, `es-MX` and `es_ES` all select Spanish and
 * `en`, `en-GB` and `en-US` all select English. A missing, empty or unsupported tag
 * selects the default (`en_UK`), so an unsupported language reads whole in English
 * rather than a blank or a key.
 */
export function resolveLocale(tag: string | undefined): LocaleCode {
  if (!tag) return DEFAULT_LOCALE;
  const primary = tag.split(/[-_]/)[0]?.toLowerCase() ?? '';
  return PRIMARY_SUBTAG[primary] ?? DEFAULT_LOCALE;
}
