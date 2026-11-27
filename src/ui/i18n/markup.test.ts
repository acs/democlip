import { describe, it, expect } from 'vitest';
// The pages are read through Vite's `?raw`, so no filesystem access is needed and the same
// declaration `help.ts` uses covers them.
import indexHtml from '../../../web/index.html?raw';
import guideHtml from '../../../web/help.html?raw';
import helpStepsHtml from '../shell/help-steps.html?raw';
import { en_UK } from './catalogs/en_UK.js';
import { es_ES } from './catalogs/es_ES.js';

// The static pages keep their English text as the pre-paint content and name each sentence
// with a key. This is the guard between the two: a key marked in the markup but forgotten in
// a catalogue is caught here, before it can show a blank or a raw key to a person.

const ATTRS = [
  'data-i18n',
  'data-i18n-html',
  'data-i18n-aria-label',
  'data-i18n-title',
  'data-i18n-placeholder',
];

function markedKeys(html: string): string[] {
  const keys: string[] = [];
  for (const attr of ATTRS) {
    const pattern = new RegExp(`${attr}="([^"]+)"`, 'g');
    for (const match of html.matchAll(pattern)) keys.push(match[1] as string);
  }
  return keys;
}

describe('every key marked in the static pages exists in both catalogues', () => {
  const pages: ReadonlyArray<[string, string]> = [
    ['web/index.html', indexHtml],
    ['web/help.html', guideHtml],
    ['src/ui/shell/help-steps.html', helpStepsHtml],
  ];

  for (const [path, html] of pages) {
    it(path, () => {
      const keys = markedKeys(html);
      expect(keys.length).toBeGreaterThan(0);
      const en = en_UK as Record<string, string>;
      const es = es_ES as Record<string, string>;
      expect(keys.filter((key) => !(key in en))).toEqual([]);
      expect(keys.filter((key) => !(key in es))).toEqual([]);
    });
  }
});
