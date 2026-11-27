import { describe, it, expect } from 'vitest';
import { resolveLocale, DEFAULT_LOCALE, SUPPORTED_LOCALES } from './locale.js';

describe('resolveLocale', () => {
  it('picks Spanish for es and every es-* variant, whatever the case', () => {
    expect(resolveLocale('es')).toBe('es_ES');
    expect(resolveLocale('es-MX')).toBe('es_ES');
    expect(resolveLocale('es_ES')).toBe('es_ES');
    expect(resolveLocale('ES-AR')).toBe('es_ES');
  });

  it('picks English for en and every en-* variant', () => {
    expect(resolveLocale('en')).toBe('en_UK');
    expect(resolveLocale('en-GB')).toBe('en_UK');
    expect(resolveLocale('en-US')).toBe('en_UK');
  });

  it('falls back to the default for an unsupported, complex, missing or empty tag', () => {
    expect(resolveLocale('ja')).toBe(DEFAULT_LOCALE);
    expect(resolveLocale('de-DE')).toBe(DEFAULT_LOCALE);
    expect(resolveLocale('zh-Hant-TW')).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale('')).toBe(DEFAULT_LOCALE);
  });

  it('always returns a language the app speaks', () => {
    for (const tag of ['es', 'en', 'ja', 'zh-Hant-TW', undefined, '']) {
      expect(SUPPORTED_LOCALES).toContain(resolveLocale(tag));
    }
  });
});
