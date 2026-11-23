// The help dialog, and the complete guide it links to.
//
// The dialog holds the brief, step-by-step tutorial — its text is its own file
// (`src/ui/shell/help-steps.html`) put into the dialog at startup — and a link to
// the full guide, which is a page of its own (`web/help.html`). This guards the
// split: the tutorial stays brief, and the guide keeps the long-form sections.

import { expect, test } from '@playwright/test';
import { boot } from '../helpers/app.js';

test('the help dialog shows the brief tutorial and links to the full guide', async ({ page }) => {
  await boot(page).goto();
  await page.locator('#help-btn').click();
  await expect(page.locator('#help-bd')).toHaveClass(/\bon\b/);

  // The tutorial is the four steps, high level — step 5 (install) belongs to the
  // guide alone.
  const steps = page.locator('#help-steps .help-step');
  await expect(steps).toHaveCount(4);
  await expect(steps.nth(0).locator('.help-step-title')).toHaveText('Choose what to record');
  await expect(steps.nth(1).locator('.help-step-title')).toHaveText('Hit record');
  await expect(steps.nth(2).locator('.help-step-title')).toHaveText('Stop and cut');
  await expect(steps.nth(3).locator('.help-step-title')).toHaveText('Export and publish');

  // And the way to the long-form text.
  await expect(page.locator('#help-more')).toHaveAttribute('href', 'help.html');
});

test('the full guide is a page of its own, with every section', async ({ page }) => {
  await page.goto('/help.html');
  const sections = page.locator('.guide-section');
  await expect(sections).toHaveCount(5);
  await expect(sections.first().locator('h2')).toContainText('Choose what to record');
  await expect(sections.last().locator('h2')).toContainText('Install as a desktop app');
});
