import { describe, expect, it } from 'vitest';

import { Profile } from './Profile.js';

// The value object: a named set of declarations — the items a profile controls, and what each
// is fixed at. No browser, no clip: the name rule, and the one place where "declared" and
// "empty" have to be told apart, are the whole of it.

describe('Profile', () => {
  it('needs a name with something in it, and an id', () => {
    expect(Profile.create('', 'DemoClipTV')).toBeNull();
    expect(Profile.create('p1', '')).toBeNull();
    expect(Profile.create('p1', '   ')).toBeNull();
    expect(Profile.create('p1', '  DemoClipTV  ')?.name).toBe('DemoClipTV');
  });

  it('controls nothing it was not given, and answers null for what it does not control', () => {
    const profile = Profile.create('p1', 'DemoClipTV')!;
    expect(profile.declares('addToExport')).toBe(false);
    expect(profile.valueFor('addToExport')).toBeNull();
    expect(profile.controls).toEqual({});
  });

  it('declares an item, and reads it back, keeping the others', () => {
    const profile = Profile.create('p1', 'DemoClipTV')!
      .declare('addToExport', 'true')
      .declare('logo', 'brand.png');
    expect(profile.declares('addToExport')).toBe(true);
    expect(profile.valueFor('addToExport')).toBe('true');
    expect(profile.valueFor('logo')).toBe('brand.png');
  });

  it('tells a declared empty value apart from no declaration at all', () => {
    // The one place the two differ: a boolean the profile fixes **off** is declared, and
    // empty is what it is fixed at. `ClipProperties` folds empty to unset; this must not.
    const off = Profile.create('p1', 'DemoClipTV')!.declare('addToExport', '');
    expect(off.declares('addToExport')).toBe(true);
    expect(off.valueFor('addToExport')).toBe('');

    const free = off.free('addToExport');
    expect(free.declares('addToExport')).toBe(false);
    expect(free.valueFor('addToExport')).toBeNull();
  });

  it('is a value: declaring gives a new profile and leaves the old one alone', () => {
    const before = Profile.create('p1', 'DemoClipTV')!;
    const after = before.declare('addToExport', 'true');
    expect(before.declares('addToExport')).toBe(false);
    expect(after.declares('addToExport')).toBe(true);
  });

  it('reads a written profile back, keeping a declared empty value and dropping what is not a named string', () => {
    const profile = Profile.restore({
      id: 'p1',
      name: 'DemoClipTV',
      controls: {
        addToExport: 'true',
        logo: '',
        // A record from elsewhere: a number and an unnamed item are not ours.
        ...({ width: 12, '': 'nameless' } as Record<string, unknown>),
      } as Record<string, string>,
    })!;
    expect(profile.valueFor('addToExport')).toBe('true');
    expect(profile.valueFor('logo')).toBe('');
    expect(profile.controls).toEqual({ addToExport: 'true', logo: '' });
  });

  it('reads nothing back from nothing, or from what cannot name a profile', () => {
    expect(Profile.restore(null)).toBeNull();
    expect(Profile.restore(undefined)).toBeNull();
    expect(Profile.restore({ id: '', name: 'DemoClipTV', controls: {} })).toBeNull();
    expect(Profile.restore({ id: 'p1', name: '   ', controls: {} })).toBeNull();
  });

  it('renames, or refuses a name with nothing in it', () => {
    const profile = Profile.create('p1', 'DemoClipTV')!.declare('addToExport', 'true');
    expect(profile.renamed('GraditoneTV')?.name).toBe('GraditoneTV');
    expect(profile.renamed('GraditoneTV')?.valueFor('addToExport')).toBe('true');
    expect(profile.renamed('')).toBeNull();
  });

  it('writes itself down as plain data', () => {
    const profile = Profile.create('p1', 'DemoClipTV')!.declare('addToExport', '');
    expect(profile.stored()).toEqual({ id: 'p1', name: 'DemoClipTV', controls: { addToExport: '' } });
  });
});
