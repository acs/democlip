import { describe, expect, it } from 'vitest';

import { avatarLetters, avatarTone, AVATAR_TONES, defineRows, profileRows } from './profile-rows.js';
import { Profile } from '../../domain/profile/Profile.js';
import { Profiles } from '../../domain/profile/Profiles.js';

// The row models, proved in node: what the selector draws, and what a profile's config sheet
// draws. What the app draws and what a check reads are the same answer, so the states that
// matter — locked, fixed, free, declared — are decided here rather than in the DOM.

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

  it('makes every row choosable while the session has not begun to capture', () => {
    expect(profileRows(book(), false).every(row => row.selectable)).toBe(true);
  });

  it('lets only the active row be chosen once the session has begun to capture', () => {
    expect(profileRows(book(), true).map(row => row.selectable)).toEqual([false, true, false]);
  });

  it('fixes the active profile’s define, rename and remove once the session has begun to capture, but not another’s', () => {
    const rows = profileRows(book(), true);
    const byId = Object.fromEntries(rows.map(row => [row.id, row]));
    expect(byId.tv.manageable).toBe(false);
    expect(byId.gra.manageable).toBe(true);
  });

  it('leaves the built-in default fixed: nothing is done to it', () => {
    const fallback = profileRows(book(), false).find(row => row.id === Profiles.DEFAULT_ID)!;
    expect(fallback.fixed).toBe(true);
    expect(fallback.manageable).toBe(false);
  });

  it('shows a profile’s name as a pill of its first letters', () => {
    expect(profileRows(book(), false).map(row => row.avatar)).toEqual(['Def', 'Dem', 'Gra']);
  });
});

describe('defineRows', () => {
  it('offers one row per item a profile may control', () => {
    const rows = defineRows(book().get('tv')!, { active: true, locked: false });
    expect(rows.map(row => row.id)).toEqual(['addToExport']);
    expect(rows[0]).toMatchObject({ label: 'Add to export', control: 'toggle', free: false, value: 'true', editable: true });
  });

  it('says an item is free when the profile does not control it', () => {
    const rows = defineRows(book().get('gra')!, { active: false, locked: false });
    expect(rows[0]).toMatchObject({ free: true, value: '' });
  });

  it('tells a controlled item fixed off apart from a free one', () => {
    const off = Profile.create('off', 'Off', { addToExport: '' })!;
    const rows = defineRows(off, { active: false, locked: false });
    expect(rows[0].free).toBe(false);
    expect(rows[0].value).toBe('');
  });

  it('is not editable for the active profile while the session has begun to capture', () => {
    const active = defineRows(book().get('tv')!, { active: true, locked: true });
    const other = defineRows(book().get('gra')!, { active: false, locked: true });
    expect(active[0].editable).toBe(false);
    expect(other[0].editable).toBe(true);
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
  });
});
