// Conditional Focus: the app stays in front of whatever it is recording.
//
// Sharing a **tab** or a window otherwise brings it to the front, and the app — whose
// preview is where the share is watched — goes behind it, so the person's controls
// disappear. Chrome's `CaptureController` says which surface keeps the focus, and the
// app asks for no change. What the browser then does with the focus is its own
// decision, which no check can read; what a check can hold is the **ask**, which is
// what the app is responsible for.

import { expect, test } from '@playwright/test';
import { boot } from '../helpers/app.js';
import { installStandInShare } from '../helpers/stand-ins.js';

/** Watch the focus behaviour the app asks for, before the app runs. */
const watchFocus = (): void => {
  const win = window as unknown as { __focus?: string[] };
  win.__focus = [];
  const Controller = (window as unknown as { CaptureController?: { prototype: Record<string, unknown> } }).CaptureController;
  if (!Controller) return;
  const asked = Controller.prototype.setFocusBehavior as (behavior: string) => void;
  Controller.prototype.setFocusBehavior = function (this: unknown, behavior: string) {
    win.__focus?.push(behavior);
    return asked.call(this, behavior);
  };
};

const asked = (page: import('@playwright/test').Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __focus?: string[] }).__focus ?? []);

test('the capture asks to keep the focus, so the app stays in front', async ({ page }) => {
  await page.addInitScript(watchFocus);

  await installStandInShare(page);
  const app = boot(page);
  await app.goto();

  const hasController = await page.evaluate(
    () => typeof (window as unknown as { CaptureController?: unknown }).CaptureController === 'function',
  );
  test.skip(!hasController, 'this browser has no CaptureController, so there is nothing to ask');

  await page.locator('#screen-btn').click();
  await expect(page.locator('#s-text')).toContainText('Live');

  // The app made a controller and asked it to leave the focus where it is.
  await expect.poll(() => asked(page)).toEqual(['no-focus-change']);
});
