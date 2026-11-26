// The capture, once a share is handed back — where the recent regressions lived — and the
// stand-in devices.
//
// The picker itself is never opened: `getDisplayMedia` needs a gesture and a pane. These
// checks stand in for what comes *back* from one and assert the app's handling — the ask,
// the size it takes the picture at, and the crop — and use Chromium's fake camera and
// microphone for the devices.

import { expect, test, type Page } from '@playwright/test';
import { boot } from '../helpers/app.js';
import { makeTakes } from '../fixtures/takes.js';
import { exportFile, hasSound, probeFile, takeBytes, toneLevel } from '../helpers/exports.js';
import { askedFor, installStandInCamera, installStandInMic, installStandInShare, installSuspendedAudio, webcamAskedFor } from '../helpers/stand-ins.js';
import { pageModule } from '../helpers/page-module.js';
import { watchBubble, previewBubble, lastWebcamDraw, compositedBubble, type BubbleArc } from '../helpers/bubble.js';

const HOOKS = pageModule('e2e/support/app-hooks.ts');

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

/** The focus behaviour the app asked for, if it asked. */
const focusAsked = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __focus?: string[] }).__focus ?? []);

/** Watch the meter for a few seconds and answer the loudest it got, in percent. The bar is
 *  sampled frame by frame, as an eye would see it: a single reading can land between the
 *  beeps of the stand-in microphone and say nothing. */
async function loudestBar(page: Page, ms = 5_000): Promise<number> {
  return page.evaluate(limit => new Promise<number>(resolve => {
    const fill = document.getElementById('vu-fill');
    const started = performance.now();
    let peak = 0;
    const look = () => {
      const value = Number.parseFloat(fill?.style.height ?? '') || 0;
      peak = Math.max(peak, value);
      if (peak > 10 || performance.now() - started > limit) resolve(peak);
      else requestAnimationFrame(look);
    };
    look();
  }), ms);
}

/** The picture the first take holds, as the element that plays it sees it. */
const takeSize = (page: Page): Promise<{ width: number; height: number } | null> =>
  page.evaluate(async (url) => {
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

test('the capture asks for the cursor, the frame rate and the focus, forces no pane, and reports a silent share', async ({ page }) => {
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

  const asked = await askedFor(page);
  expect(JSON.stringify(asked)).toContain('"cursor":"always"');
  expect(JSON.stringify(asked)).toContain('"frameRate"');
  // The picker is left to open on whatever pane it likes: `displaySurface` used to point it
  // at the screen, which works against recording a tab or a window.
  expect(JSON.stringify(asked)).not.toContain('displaySurface');
  // And the app asks the browser to leave the focus where it is, so the controls do not go
  // behind the very tab or window it is recording.
  await expect.poll(() => focusAsked(page)).toEqual(['no-focus-change']);

  // A share with no audio comes back silent, and the app says so.
  await installStandInShare(page, { silent: true });
  await app.goto();
  await page.locator('#screen-btn').click();
  await expect(page.locator('#s-text')).toContainText('no audio shared');
});

test('the picture is sized from what is shown, not the track’s settings or the screen it followed', async ({ page }) => {
  const app = boot(page);

  // A display track reports the display's size until a tab's first frame lands, and the
  // status line reports the picture's own, not the settings'.
  await installStandInShare(page, { width: 1280, height: 720, settingsSize: { width: 1920, height: 1080 } });
  await app.goto();
  await page.locator('#screen-btn').click();
  await expect(page.locator('#s-text')).toContainText('1280×720');
  await expect(page.locator('#s-text')).not.toContainText('1920×1080');

  // The recorded take is that size too, even with a webcam composited in: a 1280x720 picture
  // whose track claimed 1920x1080 used to be recorded at 1920x1080.
  await installStandInShare(page, { width: 640, height: 360, settingsSize: { width: 1920, height: 1080 } });
  await app.goto();
  await page.locator('#webcam-btn').click();
  await expect(page.locator('#s-text')).toContainText('Live');
  await page.locator('#screen-btn').click();
  await expect(page.locator('#s-text')).toContainText('Live');
  await page.locator('#rec-btn').click();
  await expect(page.locator('#s-text')).toHaveText('Recording');
  await expect(page.locator('#t-live-time')).not.toHaveText('00:00');
  await page.locator('#rec-btn').click();
  await expect.poll(() => app.clipLength(), { timeout: 10_000 }).toBeGreaterThan(0.2);
  expect(await takeSize(page)).toEqual({ width: 640, height: 360 });

  // A screen capture leaves its size in the adapter; a webcam-only picture used to be
  // stretched into it. The preview follows the source that is actually showing — the webcam
  // once the screen is let go.
  await installStandInShare(page, { width: 1920, height: 1080 });
  await app.goto();
  await page.locator('#screen-btn').click();
  await expect(page.locator('#s-text')).toContainText('1920×1080');
  await page.locator('#webcam-btn').click();
  await expect(page.locator('#webcam-btn')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#screen-btn').click();
  await expect.poll(async () => page.evaluate(() => {
    const preview = document.getElementById('preview') as HTMLCanvasElement;
    const webcam = document.getElementById('wcv') as HTMLVideoElement;
    if (webcam.videoWidth === 0 || webcam.videoHeight === 0) return null;
    return { preview: `${preview.width}x${preview.height}`, webcam: `${webcam.videoWidth}x${webcam.videoHeight}` };
  }).then(size => size && size.preview === size.webcam)).toBe(true);
  await expect(page.locator('#s-text')).not.toContainText('1920×1080');

  // And the review is not resized when the sources change: a webcam-only take after a larger
  // clip used to be drawn into the clip's size while it recorded — deformed on the preview,
  // though the take itself was the webcam's own.
  await app.goto();
  const takes = await makeTakes(page, { width: 1280, height: 720, seconds: 1 });
  await app.seed(takes);
  await app.review();
  await expect.poll(async () => page.evaluate(() => {
    const preview = document.getElementById('preview') as HTMLCanvasElement;
    return `${preview.width}x${preview.height}`;
  })).toBe('1280x720');
  await page.locator('#webcam-btn').click();
  await expect(page.locator('#webcam-btn')).toHaveAttribute('aria-pressed', 'true');
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

test('the crop is the take, and its box stays drawn through a paused drag', async ({ page }) => {
  const app = boot(page);

  // The box is painted by the preview's own loop. A press before the pointer has moved makes
  // the drag box a bare point; building a `CropRegion` from it threw, the throw ended the
  // loop, and the box was never drawn again. A pause between the press and the drag is what
  // a hand does, so the check pauses.
  await installStandInShare(page, { width: 1280, height: 720 });
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

  await expect.poll(boxPixels).toBeGreaterThan(0);
  const rect = await page.locator('#preview').boundingBox();
  if (!rect) throw new Error('the preview has no box to drag on');
  await page.mouse.move(rect.x + rect.width * 0.3, rect.y + rect.height * 0.3);
  await page.mouse.down();
  await page.waitForTimeout(300);            // the hand pauses before it moves
  await page.mouse.move(rect.x + rect.width * 0.7, rect.y + rect.height * 0.7, { steps: 8 });
  await expect.poll(boxPixels).toBeGreaterThan(0);
  await page.mouse.up();
  await expect.poll(boxPixels).toBeGreaterThan(0);

  // The camera alone is the whole picture, and the crop box is over it. Drag three tenths of
  // its width and four of its height, and the take is that cropped picture.
  await app.goto();
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

  const cameraRect = await page.locator('#preview').boundingBox();
  if (!cameraRect) throw new Error('the preview has no box to drag on');
  await page.mouse.move(cameraRect.x + cameraRect.width * 0.25, cameraRect.y + cameraRect.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(cameraRect.x + cameraRect.width * 0.55, cameraRect.y + cameraRect.height * 0.65, { steps: 8 });
  await page.mouse.up();

  await page.locator('#rec-btn').click();
  await expect(page.locator('#s-text')).toContainText('Recording');
  await expect(page.locator('#t-live-time')).not.toHaveText('00:00');
  await page.locator('#rec-btn').click();
  await expect.poll(() => app.clipLength(), { timeout: 10_000 }).toBeGreaterThan(0.2);

  expect(await takeSize(page)).toEqual({
    width: Math.round(camera.width * 0.3),
    height: Math.round(camera.height * 0.4),
  });
});

test('a stand-in device records a take, and the meter follows the voice though its context starts suspended', async ({ page }) => {
  const app = boot(page);
  await app.goto();

  // The webcam records a short take on Chromium's fake device, and the live timer is the
  // visible signal that it is running.
  await expect(page.locator('#webcam-btn')).toBeEnabled();
  await page.locator('#webcam-btn').click();
  await expect(page.locator('#s-text')).toContainText('Live');
  await page.locator('#rec-btn').click();
  await expect(page.locator('#s-text')).toHaveText('Recording');
  await expect(page.locator('#t-live-time')).not.toHaveText('00:00');
  await page.locator('#rec-btn').click();
  await expect.poll(() => app.clipLength(), { timeout: 10_000 }).toBeGreaterThan(0.2);

  // The microphone's meter. A browser strict about autoplay hands an AudioContext back
  // suspended, and the meter is built outside the click that asked for the microphone; a
  // suspended context feeds its analyser nothing, so the bars sat on the floor while a
  // perfectly good microphone recorded. The stand-in gives every context that start.
  await installSuspendedAudio(page);
  await app.goto();
  await expect(page.locator('#mic-btn')).toBeEnabled();
  await page.locator('#mic-btn').click();
  await expect(page.locator('#mic-btn')).toHaveAttribute('aria-pressed', 'true');
  expect(await loudestBar(page)).toBeGreaterThan(10);
});

test('the camera is asked for a size it may decline, and a modest camera records its own', async ({ page }) => {
  // The app used to ask for `video: true` and nothing more, so the browser answered with
  // its default — 640×480 on every camera for years — however much the hardware could do.
  // The ask is now a size, and a *preferred* one: `ideal` is what lets a phone whose camera
  // tops out lower keep working, where `min` or `exact` would fail it outright.
  await installStandInCamera(page);          // the real device, with its ask kept
  const app = boot(page);
  await app.goto();
  await expect(page.locator('#webcam-btn')).toBeEnabled();
  await page.locator('#webcam-btn').click();
  await expect(page.locator('#webcam-btn')).toHaveAttribute('aria-pressed', 'true');

  // Chromium's fake camera honours an ideal size the way a real one picks its nearest mode.
  await expect(page.locator('#s-text')).toContainText('Live — 1280×720');
  const ask = await webcamAskedFor(page);
  expect(ask?.width).toEqual({ ideal: 1280 });
  expect(ask?.height).toEqual({ ideal: 720 });
  // No `min` and no `exact` around them: the objects above say the whole of both.

  await page.locator('#rec-btn').click();
  await expect(page.locator('#s-text')).toHaveText('Recording');
  await expect(page.locator('#t-live-time')).not.toHaveText('00:00');
  await page.locator('#rec-btn').click();
  await expect.poll(() => app.clipLength(), { timeout: 10_000 }).toBeGreaterThan(0.2);
  expect(await takeSize(page)).toEqual({ width: 1280, height: 720 });

  // A camera that tops out at 640×480 still opens — the ask is a preference — and the
  // take is that camera's own size, not stretched into the one that was asked for.
  // Part 1's take comes back on the reload in review, so New ends that clip first.
  await installStandInCamera(page, { topOut: { width: 640, height: 480 } });
  await app.goto();
  await page.locator('#btn-new').click();
  await expect(page.locator('#webcam-btn')).toBeEnabled();
  await page.locator('#webcam-btn').click();
  await expect(page.locator('#webcam-btn')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#s-text')).toContainText('Live — 640×480');
  expect(await webcamAskedFor(page)).toMatchObject({ width: { ideal: 1280 }, height: { ideal: 720 } });

  await page.locator('#rec-btn').click();
  await expect(page.locator('#s-text')).toHaveText('Recording');
  await expect(page.locator('#t-live-time')).not.toHaveText('00:00');
  await page.locator('#rec-btn').click();
  await expect.poll(() => app.clipLength(), { timeout: 10_000 }).toBeGreaterThan(0.2);
  expect(await takeSize(page)).toEqual({ width: 640, height: 480 });
});

test('the webcam bubble is a whole, undistorted circle, inset from the corner — not a quarter of one cut off by it', async ({ page }) => {
  // `watchBubble` sees every circle and camera draw; the helper readers pick out the
  // bubble's — its centre and radius, and the picture it has to fit inside.
  await watchBubble(page);
  await installStandInShare(page, { width: 1280, height: 720 });
  const app = boot(page);
  await app.goto();
  await page.locator('#webcam-btn').click();
  await expect(page.locator('#webcam-btn')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#screen-btn').click();
  await expect(page.locator('#s-text')).toContainText('Live');

  // The mirror paints the bubble every frame; wait for a full-size one to land.
  await page.waitForFunction(() => {
    const arcs = (window as unknown as { __bubbleArcs?: { r: number }[] }).__bubbleArcs ?? [];
    return arcs.some(one => one.r > 60);
  });
  const bubble = await previewBubble(page);
  const drawn = await lastWebcamDraw(page);

  // The whole circle is inside the picture. Before the fix its centre was placed 0.2 of
  // the diameter from each edge — inside the radius — so the crop cut the bubble down to
  // the sliver in the corner.
  expect(bubble.cx - bubble.r).toBeGreaterThanOrEqual(0);
  expect(bubble.cy - bubble.r).toBeGreaterThanOrEqual(0);
  expect(bubble.cx + bubble.r).toBeLessThanOrEqual(bubble.w);
  expect(bubble.cy + bubble.r).toBeLessThanOrEqual(bubble.h);

  // And it is the corner bubble: in the bottom-right of the picture, not the crosshair.
  expect(bubble.cx).toBeGreaterThan(bubble.w / 2);
  expect(bubble.cy).toBeGreaterThan(bubble.h / 2);

  // The camera covers the circle. Before the fix it was drawn into a square — the picture
  // the same size each way, whatever shape the camera sends — so a face came out squashed.
  // The camera is not square to begin with, or this would prove nothing.
  expect(drawn.sw).not.toBe(drawn.sh);
  expect(drawn.dw / drawn.dh).toBeCloseTo(drawn.sw / drawn.sh, 2);
});

/** Is the whole circle inside the region it was drawn on? */
const whole = (arc: BubbleArc): boolean =>
  arc.cx - arc.r >= -0.5 && arc.cy - arc.r >= -0.5 &&
  arc.cx + arc.r <= arc.w + 0.5 && arc.cy + arc.r <= arc.h + 0.5;

/** Is the crop the whole picture? The canvas does not say it, so the model is asked. */
const regionIsFull = (page: Page): Promise<boolean> =>
  page.evaluate(async (url) => {
    const { capture } = await import(/* @vite-ignore */ url);
    return capture.region.isFull;
  }, HOOKS);

test('the webcam bubble is moved and resized in the live preview, and a take records it there', async ({ page }) => {
  await watchBubble(page);
  await installStandInShare(page, { width: 1280, height: 720 });
  const app = boot(page);
  await app.goto();
  await page.locator('#webcam-btn').click();
  await expect(page.locator('#webcam-btn')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#screen-btn').click();
  await expect(page.locator('#s-text')).toContainText('Live');
  await page.waitForFunction(() => {
    const arcs = (window as unknown as { __bubbleArcs?: { r: number }[] }).__bubbleArcs ?? [];
    return arcs.some(one => one.r > 60);
  });

  let rect = await page.locator('#preview').boundingBox();
  if (!rect) throw new Error('the preview has no box to drag on');
  let frame = await previewBubble(page);
  const at = (x: number, y: number) => ({ x: rect.x + rect.width * x / frame.w, y: rect.y + rect.height * y / frame.h });
  const drag = async (from: { x: number; y: number }, to: { x: number; y: number }) => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await page.mouse.up();
  };

  // A drag away from the bubble is still a crop — the routing did not take the crop away.
  await drag(at(frame.w * 0.05, frame.h * 0.05), at(frame.w * 0.45, frame.h * 0.45));
  await expect.poll(() => regionIsFull(page)).toBe(false);

  // A plain click resets the crop to the whole screen, so the take below is full-size.
  await page.mouse.move(at(frame.w * 0.05, frame.h * 0.05).x, at(frame.w * 0.05, frame.h * 0.05).y);
  await page.mouse.down();
  await page.mouse.up();
  await expect.poll(() => regionIsFull(page)).toBe(true);

  const before = await previewBubble(page);
  frame = before;
  expect(before.cx).toBeGreaterThan(before.w / 2);
  expect(before.cy).toBeGreaterThan(before.h / 2);

  // Drag the bubble to the upper-left third: it moves, stays whole, and never crops.
  await drag(at(before.cx, before.cy), at(before.w * 0.3, before.h * 0.3));
  await expect.poll(async () => (await previewBubble(page)).cx).toBeLessThan(before.w * 0.4);
  const moved = await previewBubble(page);
  expect(whole(moved)).toBe(true);
  expect(await regionIsFull(page)).toBe(true);

  // Pressing the visible edge — a little *inside* it — resizes the bubble rather than
  // moving it: aiming at the line used to read as the middle and shunt the circle across.
  await drag(at(moved.cx + moved.r * 0.9, moved.cy), at(moved.cx + moved.r * 1.8, moved.cy));
  await expect.poll(async () => (await previewBubble(page)).r).toBeGreaterThan(moved.r + 20);
  const sized = await previewBubble(page);
  frame = sized;
  expect(sized.cx).toBeCloseTo(moved.cx, 0);   // the centre held: it resized, it did not move
  expect(sized.cy).toBeCloseTo(moved.cy, 0);
  const drawn = await lastWebcamDraw(page);
  expect(drawn.sw).not.toBe(drawn.sh);
  expect(drawn.dw / drawn.dh).toBeCloseTo(drawn.sw / drawn.sh, 2);

  // The take records the bubble exactly where and at the size the preview showed it.
  await page.locator('#rec-btn').click();
  await expect(page.locator('#s-text')).toHaveText('Recording');
  await expect.poll(async () => (await compositedBubble(page))?.r ?? 0, { timeout: 10_000 }).toBeGreaterThan(moved.r + 20);
  await expect(page.locator('#t-live-time')).not.toHaveText('00:00');
  const record = await compositedBubble(page);
  expect(record).not.toBeNull();
  expect(record!.cx).toBeCloseTo(sized.cx, 0);
  expect(record!.cy).toBeCloseTo(sized.cy, 0);
  expect(record!.r).toBeCloseTo(sized.r, 0);
  await page.locator('#rec-btn').click();
  await expect.poll(() => app.clipLength(), { timeout: 10_000 }).toBeGreaterThan(0.2);

  // The placement lasts the sitting and is forgotten at New: the corner again.
  await app.goto();
  await page.locator('#webcam-btn').click();
  await expect(page.locator('#webcam-btn')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#screen-btn').click();
  await expect(page.locator('#s-text')).toContainText('Live');
  await page.waitForFunction(() => {
    const arcs = (window as unknown as { __bubbleArcs?: { r: number }[] }).__bubbleArcs ?? [];
    return arcs.some(one => one.r > 60);
  });
  const fresh = await previewBubble(page);
  expect(fresh.cx).toBeGreaterThan(fresh.w / 2);
  expect(fresh.cy).toBeGreaterThan(fresh.h / 2);
  expect(fresh.r).toBeCloseTo(before.r, 0);

  // ...and, in the same way, at New: the sitting ends and the corner is where it starts.
  // The preview's box is read now the sources are on, not while the page was idle: the
  // layout narrows when they come on, and a drag has to map against the box it is drawn in.
  rect = await page.locator('#preview').boundingBox() ?? rect;
  frame = fresh;
  await drag(at(fresh.cx, fresh.cy), at(fresh.w * 0.3, fresh.h * 0.3));
  await expect.poll(async () => (await previewBubble(page)).cx).toBeLessThan(fresh.w * 0.4);
  await page.locator('#btn-new').click();
  await expect(page.locator('#s-text')).toContainText('Live');
  // The watcher's list is not reset by New, so wait for a fresh default frame to land.
  await expect.poll(async () => (await previewBubble(page)).cx).toBeGreaterThan(fresh.w / 2);
  const afterNew = await previewBubble(page);
  expect(afterNew.cy).toBeGreaterThan(afterNew.h / 2);
  expect(afterNew.r).toBeCloseTo(before.r, 0);
});

test('the first frame of a composited take is the picture, not a blank canvas', async ({ page }) => {
  // A screen with a webcam bubble is drawn on a canvas. The compositor's own element has
  // no frame when the take opens, so the canvas used to start on its blank self and the
  // bubble alone: the first frame — the review's first thumbnail and the title card's
  // background — was an artificial blank screen. The picture the app is already showing
  // is the frame the capture starts on.
  const app = boot(page);
  await installStandInShare(page, { width: 1280, height: 720 });
  await app.goto();

  await page.locator('#webcam-btn').click();
  await expect(page.locator('#webcam-btn')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#screen-btn').click();
  await expect(page.locator('#s-text')).toContainText('Live');

  await page.locator('#rec-btn').click();
  await expect(page.locator('#s-text')).toHaveText('Recording');
  await page.waitForTimeout(1200);
  await page.locator('#rec-btn').click();
  await expect.poll(() => app.clipLength(), { timeout: 10_000 }).toBeGreaterThan(0.2);
  await expect(page.locator('#thumbs canvas')).toHaveCount(22);

  // The review's first cell is the clip's first frame. The webcam bubble sits in the
  // bottom-right, so a blank screen with only the bubble leaves the other quadrants empty.
  const quadrants = (): Promise<{ topLeft: number; topRight: number; bottomLeft: number; bottomRight: number } | null> =>
    page.evaluate(() => {
      const canvas = document.querySelector('#thumbs canvas') as HTMLCanvasElement | null;
      if (!canvas) return null;
      const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
      const painted = (x0: number, y0: number, x1: number, y1: number) => {
        let n = 0;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const i = (y * canvas.width + x) * 4;
            if (Math.max(data[i], data[i + 1], data[i + 2]) > 40) n++;
          }
        }
        return n;
      };
      const w = canvas.width, h = canvas.height;
      return {
        topLeft: painted(0, 0, w >> 1, h >> 1),
        topRight: painted(w >> 1, 0, w, h >> 1),
        bottomLeft: painted(0, h >> 1, w >> 1, h),
        bottomRight: painted(w >> 1, h >> 1, w, h),
      };
    });

  // Wait for the strip's first cell to be drawn; the bubble alone is enough to pass this,
  // so the quadrants below are what prove the screen is there.
  await expect.poll(async () => {
    const q = await quadrants();
    return q ? q.topLeft + q.topRight + q.bottomLeft + q.bottomRight : 0;
  }).toBeGreaterThan(0);

  const q = await quadrants();
  expect(q?.topLeft ?? 0).toBeGreaterThan(0);
  expect(q?.topRight ?? 0).toBeGreaterThan(0);
  expect(q?.bottomLeft ?? 0).toBeGreaterThan(0);
  expect(q?.bottomRight ?? 0).toBeGreaterThan(0);
});

test('the microphone alone records a sound-only take', async ({ page }) => {
  // No picture source at all: the microphone is the whole take, so the review is a
  // waveform and the timeline has no thumbnails to show.
  const app = boot(page);
  await app.goto();
  await expect(page.locator('#mic-btn')).toBeEnabled();
  await page.locator('#mic-btn').click();
  await expect(page.locator('#mic-btn')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#s-text')).toContainText('sound only');

  await page.locator('#rec-btn').click();
  await expect(page.locator('#s-text')).toHaveText('Recording — sound only');
  await expect(page.locator('#t-live-time')).not.toHaveText('00:00');
  await page.locator('#rec-btn').click();
  await expect.poll(() => app.clipLength(), { timeout: 10_000 }).toBeGreaterThan(0.2);

  // The review is the sound: the waveform has the strip's room, and the size line under the Export
  // button is a bare figure in MB — no label, no container. It is the **sound's**: a picture of the
  // same length would come to far more a second (about 0.41MB at the app's default 1280×720), so a
  // figure under that is the sound rule having been read.
  await expect(page.locator('#timeline')).toHaveClass(/sound-only/);
  await expect(page.locator('#waveform')).toBeVisible();
  await expect(page.locator('#t-size')).toHaveText(/^\d+\.\dMB$/);
  const estimated = Number(((await page.locator('#t-size').textContent()) ?? '').replace('MB', ''));
  expect(estimated).toBeLessThan(0.41 * (await app.clipLength()));

  // The transport plays the sound: the sound-only clip is a clip like any other, and
  // the element it plays from has no picture to draw.
  await page.locator('#play-btn').click();
  await expect(page.locator('#play-btn')).toHaveAttribute('aria-label', 'Pause');
  await page.waitForTimeout(200);
  await page.locator('#play-btn').click();
  await expect(page.locator('#play-btn')).toHaveAttribute('aria-label', 'Play');

  // The waveform is the track: two clicks mark a section and the scissors cut the sound,
  // exactly as they do over a picture.
  const kept = async (): Promise<number> =>
    Number((await page.locator('#t-clip').textContent())?.replace('s', '') ?? 0);
  const beforeCut = await kept();
  const wave = await page.locator('#waveform').boundingBox();
  if (!wave) throw new Error('the sound-only timeline has no waveform to click');
  await page.mouse.click(wave.x + wave.width * 0.25, wave.y + wave.height / 2);
  await page.mouse.click(wave.x + wave.width * 0.6, wave.y + wave.height / 2);
  await expect(page.locator('#t-cut')).toContainText('CUT');
  // There is no picture to annotate, so the section offers the cut and no annotation tool.
  await expect(page.locator('#tl-marks .tl-act.ann')).toHaveCount(0);
  await page.locator('#tl-marks .tl-act.ok').click();
  await expect.poll(kept).toBeLessThan(beforeCut);
  const cutLength = await kept();
  expect(cutLength).toBeGreaterThan(0.2);

  // The clip is kept like any other: a reload brings it back in the sound-only review,
  // with the cut.
  await page.waitForTimeout(500);            // the store's write is serialized behind the take
  await page.reload();
  await expect(page.locator('#timeline')).toHaveClass(/sound-only/, { timeout: 10_000 });
  await expect(page.locator('#waveform')).toBeVisible();
  await expect.poll(kept).toBeGreaterThan(0.2);
  expect(Math.abs((await kept()) - cutLength)).toBeLessThan(0.05);   // the cut came back too

  // The file is the sound alone: no video track, and a sound track that decodes. The
  // blob's own type is `audio/webm`, and a `<video>` asked for its picture reports none.
  const webmBytes = await exportFile(page, '#exp-webm');
  const webm = await probeFile(page, webmBytes, 'audio/webm');
  expect(webm.duration).toBeGreaterThan(0.2);
  expect({ width: webm.width, height: webm.height }).toEqual({ width: 0, height: 0 });
  expect(await hasSound(page, webmBytes)).toBe(true);

  // MP4 is the same sound in the other container, where the browser can write AAC.
  const canEncodeAac = await page.evaluate(async () => {
    if (typeof AudioEncoder !== 'function') return false;
    const result = await AudioEncoder.isConfigSupported({
      codec: 'mp4a.40.2', sampleRate: 48_000, numberOfChannels: 2, bitrate: 128_000,
    });
    return !!result.supported;
  });
  if (canEncodeAac) {
    const mp4 = await probeFile(page, await exportFile(page, '#exp-mp4'), 'audio/mp4');
    expect(mp4.duration).toBeGreaterThan(0.2);
    expect({ width: mp4.width, height: mp4.height }).toEqual({ width: 0, height: 0 });
  }

  // A video service takes a video: its two entries are out for a clip with no picture.
  await page.locator('#btn-exp').click();
  await expect(page.locator('#exp-bluesky')).toBeDisabled();
  await expect(page.locator('#exp-youtube')).toBeDisabled();

  // The sound file comes back through Import: the same bytes become a take with no
  // picture, appended to the clip and opened in the sound-only review.
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#file-btn').click();
  await (await chooser).setFiles({ name: 'voice.webm', mimeType: 'audio/webm', buffer: webmBytes });
  await expect.poll(kept, { timeout: 15_000 }).toBeGreaterThan(cutLength);
  await expect(page.locator('#timeline')).toHaveClass(/sound-only/);
  await expect(page.locator('#waveform')).toBeVisible();
});

test('a silent picture take after a sound take does not lose the sound', async ({ page }) => {
  // The clip's sound is a fact of its takes, not of the last take: a sound-only take
  // followed by a webcam take with the mic off is still a clip with sound.
  const app = boot(page);
  await app.goto();
  await page.locator('#mic-btn').click();
  await expect(page.locator('#mic-btn')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#rec-btn').click();
  await expect(page.locator('#s-text')).toHaveText('Recording — sound only');
  await expect(page.locator('#t-live-time')).not.toHaveText('00:00');
  await page.locator('#rec-btn').click();
  await expect.poll(() => app.clipLength(), { timeout: 10_000 }).toBeGreaterThan(0.2);
  const firstLength = await app.clipLength();

  // The second take has a picture and no sound at all.
  await page.locator('#mic-btn').click();
  await expect(page.locator('#mic-btn')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#webcam-btn').click();
  await expect(page.locator('#webcam-btn')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#rec-btn').click();
  await expect(page.locator('#s-text')).toHaveText('Recording');
  await expect(page.locator('#t-live-time')).not.toHaveText('00:00');
  await page.locator('#rec-btn').click();
  await expect.poll(() => app.clipLength(), { timeout: 10_000 }).toBeGreaterThan(firstLength + 0.2);

  // The review has a picture and a waveform: the sound take is still heard.
  await expect(page.locator('#thumbs canvas').first()).toBeVisible();
  await expect(page.locator('#waveform')).toBeVisible();

  // The file is a video, and it carries the sound-only take's audio.
  const bytes = await exportFile(page, '#exp-webm');
  const file = await probeFile(page, bytes, 'video/webm');
  expect(file.width).toBeGreaterThan(0);
  expect(await hasSound(page, bytes)).toBe(true);
});

// A shared tab's audio is mastered loud while a voice is quiet, so the mix trims the tab
// (×0.4) and lifts the microphone (×3, then a compressor, so the lift cannot clip).
//
// That balance was lost once: the module move that rewrote the mix carried its *shape* over and
// not its two numbers — the mic came out about 15.6 dB down against the tab — so a voice
// recorded beside a video could not be heard. Nothing caught it, because no check had ever put a
// **known** voice and a **known** tab together and read the two levels back out.
//
// So the two are made distinguishable on purpose: the stand-in share's audio is its own tone
// (440 Hz, full scale), the stand-in microphone's is another (700 Hz, quiet), and each one's
// amplitude in the recording is read on its own.
test('the microphone is lifted over the shared tab’s audio, and the tab is trimmed', async ({ page }) => {
  await installStandInShare(page);                                       // 440 Hz, full scale
  await installStandInMic(page, { frequency: 700, amplitude: 0.05 });    // a quiet voice
  const app = boot(page);
  await app.goto();

  await page.locator('#screen-btn').click();
  await expect(page.locator('#s-text')).toContainText('Live');
  await expect(page.locator('#mic-btn')).toBeEnabled();
  await page.locator('#mic-btn').click();
  await expect(page.locator('#mic-btn')).toHaveAttribute('aria-pressed', 'true');

  await page.locator('#rec-btn').click();
  await expect(page.locator('#s-text')).toHaveText('Recording');
  await page.waitForTimeout(1_500);
  await page.locator('#rec-btn').click();
  await expect.poll(() => app.clipLength(), { timeout: 10_000 }).toBeGreaterThan(0.2);

  // The recording itself, before any export: the sound boost puts one gain over the whole mix
  // and would hide the balance this is about.
  const bytes = await takeBytes(page);
  const tab = await toneLevel(page, bytes, 440);
  const voice = await toneLevel(page, bytes, 700);

  // What the two constants come to, measured: the tab at about **0.40** — a full-scale tone
  // through ×0.4 — and the voice at about **0.20**, which is the quiet 0.05 through ×3 and a
  // couple of decibels more from the compressor's own makeup gain (what that node does, and
  // what e73b71f tuned by ear). The bounds allow a decibel or two of drift through a lossy
  // encode and a level read in windows; the pre-fix mix (0.78 and 0.05) misses both widely.
  expect(tab).toBeGreaterThan(0.32);
  expect(tab).toBeLessThan(0.52);
  expect(voice).toBeGreaterThan(0.13);
  expect(voice).toBeLessThan(0.27);
  // Which is the whole point of both: the voice stands over the tab it was played under.
  expect(voice).toBeGreaterThan(tab * 0.25);
});
