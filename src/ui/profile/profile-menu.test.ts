import { describe, expect, it } from 'vitest';

import { avatarLetters, avatarTone, AVATAR_TONES, badgeInk, defineRows, profileColour, profileRows } from './profile-rows.js';
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
    expect(rows.map(row => row.id)).toEqual(['logo', 'addToExport', 'annotationColour', 'soundBoost']);
    // A list rather than a switch, and free when the profile says nothing about it. The choices
    // are the property's own, so the sheet draws them without knowing what they are.
    expect(rows[0]).toMatchObject({ label: 'Logo', control: 'choice', free: true, value: '', editable: true });
    expect(rows[0].choices.map(choice => choice.value)).toEqual(['', 'democlip', 'graditone']);
    expect(rows[1]).toMatchObject({ label: 'Add to export', control: 'toggle', free: false, value: 'true', editable: true });
    // The colour a new annotation is made in: another list, its own entries, free until fixed.
    expect(rows[2]).toMatchObject({ label: 'Annotation colour', control: 'colour', free: true, value: '', editable: true });
    expect(rows[2].choices.map(choice => choice.label)).toEqual(['Red', 'Orange', 'White', 'Yellow', 'Green', 'Blue', 'Black']);
    // And the sound boost: the second switch, free here, which the sheet draws exactly as it
    // draws the card's — so the profile can be told to fix it on, off, or not at all.
    expect(rows[3]).toMatchObject({ label: 'Boost the sound', control: 'toggle', free: true, value: '', editable: true });
  });

  it('says an item is free when the profile does not control it', () => {
    const rows = defineRows(book().get('gra')!, { active: false, locked: false });
    expect(rows.map(row => row.free)).toEqual([true, true, true, true]);
  });

  it('tells a controlled sound boost apart from a free one, in the sheet and on the clip', () => {
    // The switch is the first whose default is **on**, so its off is a stored `'false'` and its
    // on is the empty value the sheet writes: the three states stay apart.
    const off = Profile.create('off', 'Off', { soundBoost: '' })!;
    expect(defineRows(off, { active: false, locked: false }).find(row => row.id === 'soundBoost'))
      .toMatchObject({ free: false, value: '' });
    const on = Profile.create('on', 'On', { soundBoost: 'true' })!;
    expect(defineRows(on, { active: false, locked: false }).find(row => row.id === 'soundBoost'))
      .toMatchObject({ free: false, value: 'true' });
  });

  it('offers what a profile does control at the value it fixes', () => {
    const wears = Profile.create('wears', 'Wears', { logo: 'democlip' })!;
    const rows = defineRows(wears, { active: false, locked: false });
    expect(rows.find(row => row.id === 'logo')).toMatchObject({ free: false, value: 'democlip' });
  });

  it('tells a controlled item fixed off apart from a free one', () => {
    const off = Profile.create('off', 'Off', { addToExport: '' })!;
    const rows = defineRows(off, { active: false, locked: false });
    const row = rows.find(candidate => candidate.id === 'addToExport')!;
    expect(row.free).toBe(false);
    expect(row.value).toBe('');
  });

  it('is not editable for the active profile while the session has begun to capture', () => {
    const active = defineRows(book().get('tv')!, { active: true, locked: true });
    const other = defineRows(book().get('gra')!, { active: false, locked: true });
    expect(active.every(row => !row.editable)).toBe(true);
    expect(other.every(row => row.editable)).toBe(true);
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

  it('wears the profile\'s annotation colour when it fixes one, instead of its tone', () => {
    const coloured = Profile.create('tv', 'DemoClipTV', { annotationColour: '#ff6c23' })!;
    const book = Profiles.starting().add(coloured)!.add(Profile.create('gra', 'GraditoneTV')!)!;
    const rows = profileRows(book, false);
    const tv = rows.find(row => row.id === 'tv')!;
    expect(tv.colour).toBe('#ff6c23');
    expect(tv.ink).toBe('#08091A');        // dark initials read on the orange
    // A profile that fixes no colour keeps one of the app's own tones.
    const gra = rows.find(row => row.id === 'gra')!;
    expect(gra.colour).toBeNull();
    expect(gra.tone).toBe(avatarTone('gra'));
    expect(rows.find(row => row.id === Profiles.DEFAULT_ID)!.colour).toBeNull();
  });

  it('ignores a colour the palette does not hold, rather than wearing it', () => {
    const odd = Profile.create('odd', 'Odd', { annotationColour: '#123456' })!;
    expect(profileColour(odd)).toBeNull();
    expect(profileRows(Profiles.starting().add(odd)!, false).find(row => row.id === 'odd')!.colour).toBeNull();
  });

  it('gives the badge an ink that reads on the colour it wears', () => {
    // Dark initials on the light colours, white on the near-black one.
    for (const colour of ['#e53e3e', '#ff6c23', '#ffffff', '#f6e05e', '#38a169', '#3182ce'] as const) {
      expect(badgeInk(colour)).toBe('#08091A');
    }
    expect(badgeInk('#111827')).toBe('#FFFFFF');
  });
});
