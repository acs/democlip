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

// ── The brand's red ────────────────────────────────────────────────────────────

test('the wordmark, the guide link and the guide wear the record button’s red, in both themes', async ({ page }) => {
  await boot(page).goto();

  // The default theme is dark, where the brand is the record button's own crimson.
  await expect(page.locator('.logo-title-accent')).toHaveCSS('color', 'rgb(229, 62, 62)');
  await expect(page.locator('#help-more')).toHaveCSS('color', 'rgb(229, 62, 62)');

  // The light theme deepens the one token, so the 11px link still reads.
  await page.locator('#theme-btn').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.logo-title-accent')).toHaveCSS('color', 'rgb(198, 40, 40)');
  await expect(page.locator('#help-more')).toHaveCSS('color', 'rgb(198, 40, 40)');

  // And the guide, a page of its own, wears the same red in the theme the person chose.
  await page.goto('help.html');
  await expect(page.locator('.guide-title')).toHaveCSS('color', 'rgb(198, 40, 40)');
});

// ── On a phone, where the header has only one row of room ─────────────────────

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('the header fits, with the build under the name and no capture size repeated', async ({ page }) => {
    await boot(page).goto();

    // The build's version holds the line the "Screen · WebM" subtitle used to, and
    // goes to the project's own page.
    await expect(page.locator('.logo-sub')).toHaveCount(0);
    const ver = page.locator('#ver');
    await expect(ver).toBeVisible();
    await expect(ver).toHaveText(/^v\d+\.\d+\.\d+$/);
    await expect(ver).toHaveAttribute('href', 'https://github.com/acs/democlip');
    await expect(ver).toHaveAttribute('target', '_blank');
    const titleBox = await page.locator('.logo-title').boundingBox();
    const verBox = await ver.boundingBox();
    expect(verBox!.y).toBeGreaterThan(titleBox!.y);

    // The capture's size is the clip properties panel's, not the header's.
    await expect(page.locator('#res-badge')).toHaveCount(0);

    // The status is announced rather than drawn: no chip in the header, and the text
    // lives in the page's live region.
    await expect(page.locator('.status-chip')).toHaveCount(0);
    await expect(page.locator('.hdr #s-text')).toHaveCount(0);
    await expect(page.locator('.status-live')).toHaveAttribute('aria-live', 'polite');
    await expect(page.locator('#s-text')).toHaveText('Ready');

    // The header no longer overflows a 390px phone: the profile pill, its last control,
    // is wholly inside the window.
    const pill = await page.locator('#profile-btn').boundingBox();
    expect(pill).not.toBeNull();
    expect(pill!.x).toBeGreaterThanOrEqual(0);
    expect(pill!.x + pill!.width).toBeLessThanOrEqual(390);
  });
});
