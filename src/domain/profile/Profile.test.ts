import { describe, expect, it } from 'vitest';

import { Profile } from './Profile.js';

// The value object: a named set of settings a person works under. No browser, no clip —
// the name rule and the difference between unset and empty are the whole of it.

describe('Profile', () => {
  it('needs a name with something in it, and an id', () => {
    expect(Profile.create('', 'DemoClipTV')).toBeNull();
    expect(Profile.create('p1', '')).toBeNull();
    expect(Profile.create('p1', '   ')).toBeNull();
    expect(Profile.create('p1', '  DemoClipTV  ')?.name).toBe('DemoClipTV');
  });

  it('holds nothing it was not given, and answers null for a setting it does not carry', () => {
    const profile = Profile.create('p1', 'DemoClipTV')!;
    expect(profile.valueFor('addToExport')).toBeNull();
    expect(profile.values).toEqual({});
  });

  it('sets one setting and reads it back, keeping the others', () => {
    const profile = Profile.create('p1', 'DemoClipTV')!
      .with('addToExport', 'true')
      .with('title', 'A demo');
    expect(profile.valueFor('addToExport')).toBe('true');
    expect(profile.valueFor('title')).toBe('A demo');
  });

  it('is a value: setting one gives a new profile and leaves the old alone', () => {
    const before = Profile.create('p1', 'DemoClipTV')!.with('addToExport', 'true');
    const after = before.with('addToExport', '');
    expect(before.valueFor('addToExport')).toBe('true');
    expect(after.valueFor('addToExport')).toBeNull();
  });

  it('clears a setting set to nothing, so unset has one shape', () => {
    const profile = Profile.create('p1', 'DemoClipTV')!.with('addToExport', 'true').with('addToExport', '');
    expect(profile.values).toEqual({});
  });

  it('reads a written profile back, folding an empty value to unset and dropping what is not a named string', () => {
    const profile = Profile.restore({
      id: 'p1',
      name: 'DemoClipTV',
      values: {
        addToExport: 'true',
        title: '',
        // A record from elsewhere: a number and an unnamed setting are not ours.
        ...({ width: 12, '': 'nameless' } as Record<string, unknown>),
      } as Record<string, string>,
    })!;
    expect(profile.valueFor('addToExport')).toBe('true');
    expect(profile.valueFor('title')).toBeNull();
    expect(profile.values).toEqual({ addToExport: 'true' });
  });

  it('reads nothing back from nothing, or from what cannot name a profile', () => {
    expect(Profile.restore(null)).toBeNull();
    expect(Profile.restore(undefined)).toBeNull();
    expect(Profile.restore({ id: '', name: 'DemoClipTV', values: {} })).toBeNull();
    expect(Profile.restore({ id: 'p1', name: '   ', values: {} })).toBeNull();
  });

  it('renames, or refuses a name with nothing in it', () => {
    const profile = Profile.create('p1', 'DemoClipTV')!.with('addToExport', 'true');
    expect(profile.renamed('GraditoneTV')?.name).toBe('GraditoneTV');
    expect(profile.renamed('GraditoneTV')?.valueFor('addToExport')).toBe('true');
    expect(profile.renamed('')).toBeNull();
  });

  it('writes itself down as plain data', () => {
    const profile = Profile.create('p1', 'DemoClipTV')!.with('addToExport', 'true');
    expect(profile.stored()).toEqual({ id: 'p1', name: 'DemoClipTV', values: { addToExport: 'true' } });
  });
});
