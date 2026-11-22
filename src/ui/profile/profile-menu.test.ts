import { describe, expect, it } from 'vitest';

import { avatarLetters, avatarTone, AVATAR_TONES, profileRows } from './profile-rows.js';
import { Profile } from '../../domain/profile/Profile.js';
import { Profiles } from '../../domain/profile/Profiles.js';

// The row model, proved in node: what the menu draws and what a check reads are the same
// answer, so the locked and fixed states are decided here rather than in the DOM.

const book = (): Profiles => {
  const tv = Profile.create('tv', 'DemoClipTV', { addToExport: 'true' })!;
  const graditone = Profile.create('gra', 'GraditoneTV')!;
  return Profiles.starting().add(tv)!.add(graditone)!.choose('tv')!;
};

describe('profileRows', () => {
  it('draws one row per profile, the built-in default first, with the active one marked', () => {
    const rows = profileRows(book(), false);
    expect(rows.map(row => row.id)).toEqual([Profiles.DEFAULT_ID, 'tv', 'gra']);
    expect(rows.map(row => row.active)).toEqual([false, true, false]);
  });

  it('shows the one setting a profile carries, and its value', () => {
    const [, tv, graditone] = profileRows(book(), false);
    expect(tv.settings.map(setting => setting.id)).toEqual(['addToExport']);
    expect(tv.settings[0].value).toBe('true');
    expect(graditone.settings[0].value).toBe('');
  });

  it('makes every row choosable while the session has not begun to capture', () => {
    expect(profileRows(book(), false).every(row => row.selectable)).toBe(true);
  });

  it('lets only the active row be chosen once the session has begun to capture', () => {
    const rows = profileRows(book(), true);
    expect(rows.map(row => row.selectable)).toEqual([false, true, false]);
  });

  it('fixes the active profile’s settings once the session has begun to capture, but not another’s', () => {
    const [, tv, graditone] = profileRows(book(), true);
    expect(tv.settings[0].editable).toBe(false);
    expect(graditone.settings[0].editable).toBe(true);
  });

  it('fixes the active profile’s rename and remove once the session has begun to capture, but not another’s', () => {
    const [, tv, graditone] = profileRows(book(), true);
    expect(tv.manageable).toBe(false);
    expect(graditone.manageable).toBe(true);
  });

  it('makes the built-in default fixed: no rename, no remove, no settings', () => {
    const [fallback] = profileRows(book(), false);
    expect(fallback.fixed).toBe(true);
    expect(fallback.manageable).toBe(false);
    expect(fallback.settings[0].editable).toBe(false);
  });
});

describe('the avatar a profile is drawn with', () => {
  it('is the first three letters of the name, with the first capitalised', () => {
    expect(avatarLetters('DemoClipTV')).toBe('Dem');
    expect(avatarLetters('Default')).toBe('Def');
    expect(avatarLetters('GraditoneTV')).toBe('Gra');
    expect(avatarLetters('Ana')).toBe('Ana');
  });

  it('skips the spaces, so a two-word name still fills the pill', () => {
    expect(avatarLetters('My TV')).toBe('MyT');
    expect(avatarLetters('  Ana  ')).toBe('Ana');
    expect(avatarLetters('Acme')).toBe('Acm');
  });

  it('is one of the tones, and the same one for the same profile every time', () => {
    const tone = avatarTone('tv');
    expect(tone).toBeGreaterThanOrEqual(0);
    expect(tone).toBeLessThan(AVATAR_TONES);
    expect(avatarTone('tv')).toBe(tone);
    expect(profileRows(book(), false).map(row => row.avatar)).toEqual(['Def', 'Dem', 'Gra']);
  });
});
