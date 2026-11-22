import { describe, expect, it } from 'vitest';

import { Profile } from './Profile.js';
import { Profiles } from './Profiles.js';

// The book: the rules about several profiles. The built-in default is always there and
// cannot go, an active choice always names something, and a written book is repaired
// rather than trusted.

const tv = () => Profile.create('tv', 'DemoClipTV', { addToExport: 'true' })!;
const graditone = () => Profile.create('gra', 'GraditoneTV')!;

describe('Profiles', () => {
  it('starts with the built-in default alone, and active', () => {
    const book = Profiles.starting();
    expect(book.all.map(p => p.id)).toEqual([Profiles.DEFAULT_ID]);
    expect(book.activeId).toBe(Profiles.DEFAULT_ID);
    expect(book.active().name).toBe('Default');
    expect(book.active().values).toEqual({});
  });

  it('chooses one, or refuses an id it does not hold', () => {
    const book = Profiles.starting().add(tv())!;
    expect(book.choose('tv')?.activeId).toBe('tv');
    expect(book.choose('nobody')).toBeNull();
  });

  it('adds one, but not a second under the same id', () => {
    const book = Profiles.starting().add(tv())!;
    expect(book.all.map(p => p.id)).toEqual([Profiles.DEFAULT_ID, 'tv']);
    expect(book.add(tv())).toBeNull();
  });

  it('renames the person’s own profiles, and refuses an empty name', () => {
    const book = Profiles.starting().add(tv())!;
    expect(book.rename('tv', 'My TV')?.get('tv')?.name).toBe('My TV');
    expect(book.rename('tv', '   ')).toBeNull();
    expect(book.rename('nobody', 'X')).toBeNull();
  });

  it('never renames or removes the built-in default', () => {
    const book = Profiles.starting();
    expect(book.rename(Profiles.DEFAULT_ID, 'Mine')).toBeNull();
    expect(book.remove(Profiles.DEFAULT_ID)).toBeNull();
  });

  it('changes a profile’s setting, or refuses an id it does not hold', () => {
    const book = Profiles.starting().add(graditone())!;
    const set = book.setSetting('gra', 'addToExport', 'true')!;
    expect(set.get('gra')?.valueFor('addToExport')).toBe('true');
    expect(set.setSetting('nobody', 'addToExport', 'true')).toBeNull();
  });

  it('falls back to the built-in default when the active profile is removed', () => {
    const book = Profiles.starting().add(tv())!.choose('tv')!;
    const after = book.remove('tv')!;
    expect(after.all.map(p => p.id)).toEqual([Profiles.DEFAULT_ID]);
    expect(after.activeId).toBe(Profiles.DEFAULT_ID);
  });

  it('leaves the active choice alone when another profile goes', () => {
    const book = Profiles.starting().add(tv())!.add(graditone())!.choose('tv')!;
    const after = book.remove('gra')!;
    expect(after.activeId).toBe('tv');
  });

  it('is a value: a change gives a new book and leaves the old one alone', () => {
    const before = Profiles.starting().add(tv())!;
    const after = before.choose('tv')!;
    expect(before.activeId).toBe(Profiles.DEFAULT_ID);
    expect(after.activeId).toBe('tv');
  });

  it('reads a written book back', () => {
    const written = Profiles.starting().add(tv())!.choose('tv')!.stored();
    const book = Profiles.of(written);
    expect(book.activeId).toBe('tv');
    expect(book.active().valueFor('addToExport')).toBe('true');
  });

  it('lands a dangling active id on the default, and keeps the person’s profiles', () => {
    const book = Profiles.of({ version: 1, activeId: 'gone', profiles: [tv().stored()] });
    expect(book.activeId).toBe(Profiles.DEFAULT_ID);
    expect(book.all.map(p => p.id)).toEqual([Profiles.DEFAULT_ID, 'tv']);
  });

  it('drops an entry that cannot be named, and one that claims the default’s id', () => {
    const book = Profiles.of({
      version: 1,
      activeId: Profiles.DEFAULT_ID,
      profiles: [
        { id: '', name: 'Nameless', values: {} },
        { id: 'x', name: '   ', values: {} },
        { id: Profiles.DEFAULT_ID, name: 'Not mine', values: { addToExport: 'true' } },
        tv().stored(),
      ],
    });
    expect(book.all.map(p => p.id)).toEqual([Profiles.DEFAULT_ID, 'tv']);
    expect(book.active().name).toBe('Default');
    expect(book.active().valueFor('addToExport')).toBeNull();
  });

  it('gives the starting book for nothing, or for what is not a book', () => {
    for (const bad of [null, undefined, {} as never, { profiles: 'no' } as never]) {
      const book = Profiles.of(bad);
      expect(book.all.map(p => p.id)).toEqual([Profiles.DEFAULT_ID]);
      expect(book.activeId).toBe(Profiles.DEFAULT_ID);
    }
  });

  it('writes down the profile it holds', () => {
    const book = Profiles.starting().add(tv())!.choose('tv')!;
    expect(book.stored()).toEqual({
      version: 1,
      activeId: 'tv',
      profiles: [
        { id: Profiles.DEFAULT_ID, name: 'Default', values: {} },
        { id: 'tv', name: 'DemoClipTV', values: { addToExport: 'true' } },
      ],
    });
  });
});
