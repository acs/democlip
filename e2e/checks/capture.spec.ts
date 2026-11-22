// The capture, once a share is handed back — where the recent regressions lived.
//
// The picker itself is never opened: `getDisplayMedia` needs a gesture and a pane.
// These checks stand in for what comes back from one and assert the app's handling.

import { expect, test } from '@playwright/test';
import { boot } from '../helpers/app.js';
import { makeTakes } from '../fixtures/takes.js';
import { askedFor, installStandInShare } from '../helpers/stand-ins.js';

test('the capture asks for the cursor and the frame rate, and forces no pane', async ({ page }) => {
  await installStandInShare(page);
  const app = boot(page);
  await app.goto();

  await page.locator('#screen-btn').click();
  await expect.poll(async () => (await askedFor(page)) !== null).toBe(true);

  const asked = await askedFor(page);
  expect(JSON.stringify(asked)).toContain('"cursor":"always"');
  expect(JSON.stringify(asked)).toContain('"frameRate"');
  // The picker is left to open on whatever pane it likes: `displaySurface` used to
  // point it at the screen, which works against recording a tab or a window.
  expect(JSON.stringify(asked)).not.toContain('displaySurface');
});

test('a silent share is reported', async ({ page }) => {
  await installStandInShare(page, { silent: true });
  const app = boot(page);
  await app.goto();

  await page.locator('#screen-btn').click();
  await expect(page.locator('#s-text')).toContainText('no audio shared');
});

test('the capture is sized from the picture, not from the track settings', async ({ page }) => {
  // A display track reports the display's size until a tab's first frame lands.
  await installStandInShare(page, {
    width: 1280,
    height: 720,
    settingsSize: { width: 1920, height: 1080 },
  });
  const app = boot(page);
  await app.goto();

  await page.locator('#screen-btn').click();
  await expect(page.locator('#s-text')).toContainText('1280×720');
  await expect(page.locator('#s-text')).not.toContainText('1920×1080');
});

test('the webcam alone is the webcam’s size, not the screen it followed', async ({ page }) => {
  // A screen capture leaves its size in the adapter; a webcam-only picture used to be
  // stretched into it on the preview. The preview follows the source that is actually
  // showing — the webcam once the screen is let go.
  await installStandInShare(page, { width: 1920, height: 1080 });
  const app = boot(page);
  await app.goto();

  await page.locator('#screen-btn').click();
  await expect(page.locator('#s-text')).toContainText('1920×1080');

  // The webcam on as a bubble, then the screen let go: the webcam is the whole picture.
  await page.locator('#webcam-btn').click();
  await expect(page.locator('#webcam-btn')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#screen-btn').click();

  // The preview is the webcam's own size — whatever the fake camera gives — and not the
  // 1920×1080 the screen left behind.
  await expect.poll(async () => page.evaluate(() => {
    const preview = document.getElementById('preview') as HTMLCanvasElement;
    const webcam = document.getElementById('wcv') as HTMLVideoElement;
    if (webcam.videoWidth === 0 || webcam.videoHeight === 0) return null;
    return { preview: `${preview.width}x${preview.height}`, webcam: `${webcam.videoWidth}x${webcam.videoHeight}` };
  }).then(size => size && size.preview === size.webcam)).toBe(true);
  await expect(page.locator('#s-text')).not.toContainText('1920×1080');
});

test('a take recorded after a larger clip keeps the webcam’s own size on the preview', async ({ page }) => {
  // The review is not resized when the sources change, so a webcam-only take after a
  // larger clip used to be drawn into the clip's size while it recorded — deformed on
  // the preview, though the take itself was the webcam's own.
  const app = boot(page);
  await app.goto();
  // A larger clip already open in the review, as after a big screen take.
  const takes = await makeTakes(page, { width: 1280, height: 720, seconds: 1 });
  await app.seed(takes);
  await app.review();
  await expect.poll(async () => page.evaluate(() => {
    const preview = document.getElementById('preview') as HTMLCanvasElement;
    return `${preview.width}x${preview.height}`;
  })).toBe('1280x720');

  // The webcam on: it is now the whole picture.
  await page.locator('#webcam-btn').click();
  await expect(page.locator('#webcam-btn')).toHaveAttribute('aria-pressed', 'true');

  // Record the webcam take: what it records is drawn at the webcam's own size, not the
  // 1280×720 the clip left behind.
  await page.locator('#rec-btn').click();
  await expect(page.locator('#s-text')).toContainText('Recording');
  await expect.poll(async () => page.evaluate(() => {
    const preview = document.getElementById('preview') as HTMLCanvasElement;
    const webcam = document.getElementById('wcv') as HTMLVideoElement;
    if (webcam.videoWidth === 0 || webcam.videoHeight === 0) return null;
    return preview.width === webcam.videoWidth && preview.height === webcam.videoHeight;
  })).toBe(true);
  await page.locator('#rec-btn').click();
});
