import { describe, expect, it } from 'vitest';

import { LOGOS, logoFile } from './logos.js';

// The logos the app ships, and the one rule that matters to the rest of the app: a name
// resolves to a file, and a name the app does not ship resolves to nothing.

describe('the app’s logos', () => {
  it('resolves a name to the file the app serves it from', () => {
    expect(logoFile('democlip')).toBe('/logos/democlip.png');
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
