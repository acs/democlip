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
import { askedFor, installStandInShare, installSuspendedAudio } from '../helpers/stand-ins.js';
import { pageModule } from '../helpers/page-module.js';

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

test('the webcam bubble is a whole, undistorted circle, inset from the corner — not a quarter of one cut off by it', async ({ page }) => {
  // The bubble is a clipped circle, and on the live preview it is the only circle the
  // canvas is asked to draw (the crosshair, when idle, is a much smaller one at the
  // centre). Watching those `arc` calls is therefore watching the bubble: the centre
  // and radius it is drawn at, and the picture it has to fit inside. Watching the
  // `drawImage` that paints the camera says whether it was squashed into that square.
  interface Arc { cx: number; cy: number; r: number; w: number; h: number }
  interface Drawn { dw: number; dh: number; sw: number; sh: number }
  await page.addInitScript(() => {
    const win = window as unknown as { __arcs: Arc[]; __webcamDraws: Drawn[] };
    win.__arcs = [];
    win.__webcamDraws = [];
    const arc = CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc = function (
      this: CanvasRenderingContext2D, ...args: Parameters<CanvasRenderingContext2D['arc']>
    ) {
      const [cx, cy, r] = args;
      if (this.canvas.id === 'preview') win.__arcs.push({ cx, cy, r, w: this.canvas.width, h: this.canvas.height });
      return arc.apply(this, args);
    };
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
      const source = args[0];
      // The bubble draws the camera video into a square; the 5-arg form is (image, dx, dy, dw, dh).
      if (this.canvas.id === 'preview' && source instanceof HTMLVideoElement && args.length >= 5) {
        win.__webcamDraws.push({ dw: args[3] as number, dh: args[4] as number, sw: source.videoWidth, sh: source.videoHeight });
      }
      return (drawImage as (...a: unknown[]) => void).apply(this, args);
    };
  });

  await installStandInShare(page, { width: 1280, height: 720 });
  const app = boot(page);
  await app.goto();
  await page.locator('#webcam-btn').click();
  await expect(page.locator('#webcam-btn')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#screen-btn').click();
  await expect(page.locator('#s-text')).toContainText('Live');

  // The mirror paints the bubble every frame; wait for a full-size one to land.
  await page.waitForFunction(() => {
    const arcs = (window as unknown as { __arcs?: { r: number }[] }).__arcs ?? [];
    return arcs.some(one => one.r > 60);
  });
  const bubble = await page.evaluate(() => {
    const arcs = (window as unknown as { __arcs: { cx: number; cy: number; r: number; w: number; h: number }[] }).__arcs;
    return arcs.filter(one => one.r > 60).at(-1)!;
  });
  const drawn = await page.evaluate(() => {
    const draws = (window as unknown as { __webcamDraws: { dw: number; dh: number; sw: number; sh: number }[] }).__webcamDraws;
    return draws.at(-1)!;
  });

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
