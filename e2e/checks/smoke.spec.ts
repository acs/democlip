// The app loads in a real browser, is ready, and its page is valid HTML.

import { expect, test } from '@playwright/test';
import { boot } from '../helpers/app.js';

test('the app boots, reads Ready, and its page carries no duplicate element ids', async ({ page }) => {
  await boot(page).goto();
  await expect(page.locator('#s-text')).toHaveText('Ready');

  // Duplicate ids are invalid HTML, and they make `getElementById`/`querySelector`
  // ambiguous: the one the code means may not be the one a rule or a check reaches.
  // `web/index.html` had two `id="t-cut"` — the chip and a stray span in the estimate
  // line — which this catches.
  const duplicates = await page.evaluate(() => {
    const counts = new Map<string, number>();
    for (const element of document.querySelectorAll('[id]')) {
      counts.set(element.id, (counts.get(element.id) ?? 0) + 1);
    }
    return [...counts].filter(([, seen]) => seen > 1).map(([id]) => id).sort();
  });
  expect(duplicates).toEqual([]);
});
