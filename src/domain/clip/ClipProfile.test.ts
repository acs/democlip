import { describe, expect, it } from 'vitest';

import { ClipProfile } from './ClipProfile.js';
import { Profiles } from '../profile/Profiles.js';
import { Profile } from '../profile/Profile.js';

describe('ClipProfile', () => {
  it('is the built-in free profile when the app has nothing else', () => {
    expect(ClipProfile.DEFAULT.id).toBe(Profiles.DEFAULT_ID);
    expect(ClipProfile.DEFAULT.name).toBe('Default');
    expect(ClipProfile.DEFAULT.declares('logo')).toBe(false);
  });

  it('snapshots a profile in the book, declaration by declaration', () => {
    const live = Profile.create('p1', 'DemoClipTV', { logo: 'democlip', addToExport: 'true' })!;

    const snapshot = ClipProfile.of(live);

    expect(snapshot.id).toBe('p1');
    expect(snapshot.name).toBe('DemoClipTV');
    expect(snapshot.declares('logo')).toBe(true);
    expect(snapshot.valueFor('logo')).toBe('democlip');
    expect(snapshot.valueFor('addToExport')).toBe('true');
    expect(snapshot.valueFor('title')).toBeNull();
  });

  it('keeps a declaration fixed at an empty value, which is a switch fixed off', () => {
    const snapshot = ClipProfile.create('p1', 'Quiet', { addToExport: '' })!;

    expect(snapshot.declares('addToExport')).toBe(true);
    expect(snapshot.valueFor('addToExport')).toBe('');
  });

  it('refuses a profile with no id or no name', () => {
    expect(ClipProfile.create('', 'Named')).toBeNull();
    expect(ClipProfile.create('p1', '   ')).toBeNull();
    expect(ClipProfile.create('p1', '  Named  ')!.name).toBe('Named');
  });

  it('writes down and reads back the whole snapshot', () => {
    const snapshot = ClipProfile.create('p1', 'DemoClipTV', { logo: 'democlip' })!;

    const back = ClipProfile.restore(snapshot.stored());

    expect(back!.equals(snapshot)).toBe(true);
  });

  it('reads a record it cannot name as nothing', () => {
    expect(ClipProfile.restore(null)).toBeNull();
    expect(ClipProfile.restore({ id: '', name: 'x', controls: {} })).toBeNull();
  });

  it('calls two snapshots the same only when id, name and every declaration agree', () => {
    const one = ClipProfile.create('p1', 'TV', { logo: 'a' })!;
    const same = ClipProfile.create('p1', 'TV', { logo: 'a' })!;
    const renamed = ClipProfile.create('p1', 'Other TV', { logo: 'a' })!;
    const declared = ClipProfile.create('p1', 'TV', { logo: 'a', addToExport: '' })!;

    expect(one.equals(same)).toBe(true);
    expect(one.equals(renamed)).toBe(false);
    expect(one.equals(declared)).toBe(false);
  });
});