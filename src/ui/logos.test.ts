import { describe, expect, it } from 'vitest';

import { LOGOS, logoFile } from './logos.js';

// The logos the app ships, and the rules that matter to the rest of the app: a name resolves to
// a file, and a name the app does not ship resolves to nothing — which is what a clip property
// refuses on. That every listed mark *has* a file is the browser's business, and the check in
// `e2e/checks/profile-logo.spec.ts` proves it by drawing one: a name with no picture behind it
// would leave the card bare. That the file is addressed **beside the app** is the rule this
// module owns and a browser check under a subpath (`e2e/checks/logo-base.spec.ts`) proves the
// consequence of — a `/logos/...` path at the domain root is a 404 on a project page.

describe('the app’s logos', () => {
  it('resolves a name to the file the app serves it from', () => {
    expect(logoFile('democlip')).toBe('./logos/democlip.png');
    expect(logoFile('graditone')).toBe('./logos/graditone.png');
  });

  it('offers nothing for a name the app does not ship, or for nothing', () => {
    expect(logoFile('nope')).toBeNull();
    expect(logoFile('')).toBeNull();
  });

  it('ships each logo once, from the app’s own folder', () => {
    const names = LOGOS.map(logo => logo.name);
    expect(new Set(names).size).toBe(names.length);
    for (const logo of LOGOS) expect(logo.file.startsWith('./logos/')).toBe(true);
  });

  it('addresses every file beside the app, never from the domain root', () => {
    // A path that begins `/` is resolved against the domain root, not the app, so it 404s
    // wherever the app is served from a subpath — a GitHub Pages project page. The file is
    // named relative to the app instead, which is what makes it follow any base.
    for (const logo of LOGOS) {
      expect(logo.file.startsWith('/')).toBe(false);
      expect(logo.file.startsWith('./')).toBe(true);
    }
  });
});
