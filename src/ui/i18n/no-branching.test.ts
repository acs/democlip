import { describe, it, expect } from 'vitest';

// The language is the mechanism's business and nothing else's. This proves the two rules
// that make adding a language a two-file change (spec FR-010, FR-011): no module outside
// `src/ui/i18n/` reads the browser's language or resolves a locale — the page entries do
// that, and they live in `web/` — and the domain and the use cases name no locale at all.
//
// The sources are read through Vite's `?raw`, so the check needs no filesystem access.

const files = import.meta.glob('/src/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const MECHANISM = '/src/ui/i18n/';

function sources(prefix: string): Array<[string, string]> {
  return Object.entries(files).filter(
    ([path]) => path.startsWith(prefix) && !path.endsWith('.test.ts'),
  );
}

describe('the language is the mechanism\'s alone', () => {
  it('no module outside src/ui/i18n/ reads the browser language', () => {
    const offenders = sources('/src/')
      .filter(([path, text]) => !path.startsWith(MECHANISM) && /navigator\.languages?/.test(text))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it('no module outside src/ui/i18n/ resolves a locale', () => {
    const offenders = sources('/src/')
      .filter(([path, text]) => !path.startsWith(MECHANISM) && /resolveLocale/.test(text))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it('the domain and the use cases name no locale', () => {
    const offenders = sources('/src/domain/')
      .concat(sources('/src/application/'))
      .filter(([, text]) => /en_UK|es_ES/.test(text))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});
