import { describe, expect, it } from 'vitest';

import { LOGOS, logoFile } from './logos.js';

// The logos the app ships, and the rules that matter to the rest of the app: a name resolves to
// a file, and a name the app does not ship resolves to nothing — which is what a clip property
// refuses on. That every listed mark *has* a file is the browser's business, and the check in
// `e2e/checks/profile-logo.spec.ts` proves it by drawing one: a name with no picture behind it
// would leave the card bare.

describe('the app’s logos', () => {
  it('resolves a name to the file the app serves it from', () => {
    expect(logoFile('democlip')).toBe('/logos/democlip.png');
    expect(logoFile('graditone')).toBe('/logos/graditone.png');
  });

  it('offers nothing for a name the app does not ship, or for nothing', () => {
    expect(logoFile('nope')).toBeNull();
    expect(logoFile('')).toBeNull();
  });

  it('ships each logo once, from the app’s own folder', () => {
    const names = LOGOS.map(logo => logo.name);
    expect(new Set(names).size).toBe(names.length);
    for (const logo of LOGOS) expect(logo.file.startsWith('/logos/')).toBe(true);
  });
});
