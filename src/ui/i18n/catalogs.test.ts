import { describe, it, expect } from 'vitest';
import { en_UK } from './catalogs/en_UK.js';
import { es_ES } from './catalogs/es_ES.js';

// The catalogues are held in step: the same keys in every language, and no empty value. The
// type `Record<TranslationKey, string>` catches this at compile time; this test catches it
// at run time too, and names the difference when it finds one.

describe('catalogue parity', () => {
  const enKeys = Object.keys(en_UK).sort();
  const esKeys = Object.keys(es_ES).sort();

  it('holds the same number of keys in both languages', () => {
    expect(esKeys.length).toBe(enKeys.length);
  });

  it('Spanish holds every key the English source holds', () => {
    expect(enKeys.filter((key) => !esKeys.includes(key))).toEqual([]);
  });

  it('English holds every key Spanish holds (no orphan)', () => {
    expect(esKeys.filter((key) => !enKeys.includes(key))).toEqual([]);
  });

  it('has no empty value in either language', () => {
    const en = en_UK as Record<string, string>;
    const es = es_ES as Record<string, string>;
    expect(enKeys.filter((key) => en[key] === '')).toEqual([]);
    expect(esKeys.filter((key) => es[key] === '')).toEqual([]);
  });
});
