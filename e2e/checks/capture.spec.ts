// The capture, once a share is handed back — where the recent regressions lived.
//
// The picker itself is never opened: `getDisplayMedia` needs a gesture and a pane.
// These checks stand in for what comes back from one and assert the app's handling.

import { expect, test } from '@playwright/test';
import { boot } from '../helpers/app.js';
import { makeTakes } from '../fixtures/takes.js';
import { askedFor, installStandInShare } from '../helpers/stand-ins.js';
import { pageModule } from '../helpers/page-module.js';

const HOOKS = pageModule('e2e/support/app-hooks.ts');

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

test('the crop box is drawn, and a pause before the drag does not lose it', async ({ page }) => {
  // The box is painted by the preview's own loop. A press before the pointer has moved
  // makes the drag box a bare point; building a `CropRegion` from it threw, the throw
  // ended the loop, and the box was never drawn again — the crosshair stayed and the
  // crop still landed, which is how it looked: no box, but a region all the same. A
  // pause between the press and the drag is what a hand does, so the check pauses.
  await installStandInShare(page, { width: 1280, height: 720 });
  const app = boot(page);
  await app.goto();
  await page.locator('#screen-btn').click();
  await expect(page.locator('#s-text')).toContainText('Live');

  const boxPixels = (): Promise<number> => page.evaluate(() => {
    const cv = document.getElementById('preview') as HTMLCanvasElement;
    const { data } = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height);
    let n = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] > 140 && data[i + 1] < 110 && data[i + 2] < 110) n++;
    return n;
  });

  // The box over the whole frame, once the share is live.
  await expect.poll(boxPixels).toBeGreaterThan(0);

  const rect = await page.locator('#preview').boundingBox();
  if (!rect) throw new Error('the preview has no box to drag on');
  await page.mouse.move(rect.x + rect.width * 0.3, rect.y + rect.height * 0.3);
  await page.mouse.down();
  await page.waitForTimeout(300);            // the hand pauses before it moves
  await page.mouse.move(rect.x + rect.width * 0.7, rect.y + rect.height * 0.7, { steps: 8 });

  // The dragged box is drawn — it does not vanish, and the preview keeps drawing.
  await expect.poll(boxPixels).toBeGreaterThan(0);
  await page.mouse.up();
  await expect.poll(boxPixels).toBeGreaterThan(0);
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

test('the camera is croppable, and the take is the cropped picture', async ({ page }) => {
  const app = boot(page);
  await app.goto();

  // The camera alone is the whole picture, and the crop box is over it.
  await page.locator('#webcam-btn').click();
  await expect(page.locator('#s-text')).toContainText('Live');
  await expect.poll(async () => page.evaluate(() => {
    const wcv = document.getElementById('wcv') as HTMLVideoElement;
    return wcv.videoWidth > 0 ? wcv.videoWidth : null;
  })).not.toBeNull();
  const camera = await page.evaluate(() => {
    const wcv = document.getElementById('wcv') as HTMLVideoElement;
    return { width: wcv.videoWidth, height: wcv.videoHeight };
  });

  // Drag a region over the camera: three tenths of its width, four of its height.
  const rect = await page.locator('#preview').boundingBox();
  if (!rect) throw new Error('the preview has no box to drag on');
  await page.mouse.move(rect.x + rect.width * 0.25, rect.y + rect.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width * 0.55, rect.y + rect.height * 0.65, { steps: 8 });
  await page.mouse.up();

  // Record the take, and read the picture it holds.
  await page.locator('#rec-btn').click();
  await expect(page.locator('#s-text')).toContainText('Recording');
  await expect(page.locator('#t-live-time')).not.toHaveText('00:00');
  await page.locator('#rec-btn').click();
  await expect.poll(() => app.clipLength(), { timeout: 10_000 }).toBeGreaterThan(0.2);

  const take = await page.evaluate(async (url) => {
    const { session } = await import(/* @vite-ignore */ url);
    const first = session.clip.takes.at(0);
    if (!first) return null;
    const video = document.createElement('video');
    video.muted = true;
    video.src = first.url;
    await new Promise<void>(resolve => {
      video.addEventListener('loadedmetadata', () => resolve(), { once: true });
      setTimeout(resolve, 3000);
    });
    return { width: video.videoWidth, height: video.videoHeight };
  }, HOOKS);

  // The take is the cropped camera frame, at the region's own size.
  expect(take).toEqual({
    width: Math.round(camera.width * 0.3),
    height: Math.round(camera.height * 0.4),
  });
});
