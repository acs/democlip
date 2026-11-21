import { describe, expect, it } from 'vitest';

import { Visibility } from './Visibility.js';

describe('Visibility', () => {
  it('is one of the three words YouTube takes', () => {
    for (const name of ['private', 'unlisted', 'public'] as const) {
      expect(Visibility.of(name).name).toBe(name);
    }
  });

  it('starts at private, which is the narrowest', () => {
    expect(Visibility.PRIVATE.name).toBe('private');
  });

  it('refuses a word YouTube does not take', () => {
    expect(() => Visibility.of('secret')).toThrow(/private, unlisted or public/);
    expect(() => Visibility.of('Public')).toThrow(/private, unlisted or public/);   // the API's words are lower case
    expect(() => Visibility.of('')).toThrow(/not nothing/);
  });
});
