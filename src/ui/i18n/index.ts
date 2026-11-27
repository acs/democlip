// The app's translation API.
//
// `t(key)` is what the view calls: it returns the sentence for a key in the active
// language, with `{name}` values substituted, falling back to the English sentence when the
// active catalogue has no entry. `tIn(code, key)` is the same but for a named language —
// used by the automation surface, which speaks to an agent in English whatever the person's
// language is. The active language is set once, at load, by the page's entry.
//
// This module is pure: it reads no browser API and touches no DOM. The resolver is in
// `locale.ts`; the pass over the static pages is in `dom.ts`.

import { DEFAULT_LOCALE, type LocaleCode } from './locale.js';
import { en_UK } from './catalogs/en_UK.js';
import { es_ES } from './catalogs/es_ES.js';

/** Every sentence the app can say, named. Derived from the English catalogue, the source. */
export type TranslationKey = keyof typeof en_UK;

/** The sentences for each language the app speaks. */
const CATALOGUES: Readonly<Record<LocaleCode, Readonly<Record<TranslationKey, string>>>> = {
  en_UK,
  es_ES,
};

/** The language the page is using. Chosen once, at load; fixed for the life of the page. */
let active: LocaleCode = DEFAULT_LOCALE;

/** Choose the active language. Called once, at startup, before anything is drawn. */
export function setLocale(code: LocaleCode): void {
  active = code;
}

/** The active language. */
export function currentLocale(): LocaleCode {
  return active;
}

/** Replace every `{name}` in a sentence with the value given for it. */
function fill(text: string, params?: Readonly<Record<string, string | number>>): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole);
}

/**
 * The sentence for a key in a named language, with values substituted. The English sentence
 * is used when that language has no entry; a key present nowhere returns the key itself,
 * never a blank. The pure core `t()` and `tIn()` are built on.
 */
export function translate(
  catalogue: Readonly<Record<string, string | undefined>>,
  fallbackCatalogue: Readonly<Record<string, string>>,
  key: string,
  params?: Readonly<Record<string, string | number>>,
): string {
  const text = catalogue[key] ?? fallbackCatalogue[key] ?? key;
  return fill(text, params);
}

/**
 * The sentence for a key in the active language, with `{name}` values substituted.
 * Falls back to the English sentence when the active catalogue has no entry.
 */
export function t(key: TranslationKey, params?: Readonly<Record<string, string | number>>): string {
  return translate(CATALOGUES[active], en_UK, key, params);
}

/**
 * The sentence for a key in a named language, whatever the active one is — for the parts of
 * the app that speak to an agent rather than a person.
 */
export function tIn(
  code: LocaleCode,
  key: TranslationKey,
  params?: Readonly<Record<string, string | number>>,
): string {
  return translate(CATALOGUES[code], en_UK, key, params);
}
