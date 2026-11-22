// A profile that fixes a **logo**: the use case that pulls the whole feature through.
//
// The logo is a clip property that is not a switch — the name of a file the app itself serves
// — so it exercises a different part of the machinery from **Add to export**: a value with an
// empty case, refused when it names something the app does not ship, applied by a profile,
// locked while that profile is in force, and drawn into the encoded file.
//
// The proof that it is *drawn* is a pixel count: the exported file's first frame is decoded in
// the page and the pixels where the logo goes are counted. A card with no logo puts nothing
// there, so the two runs are the same frame with one thing added.

import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { boot } from '../helpers/app.js';
import { makeTakes } from '../fixtures/takes.js';

const KEY = 'democlip_profiles';

/** Where the card puts a logo, as fractions of the picture — `LOGO_BOX` in `intro-text.ts`. */
const LOGO_BOX = { x: 0.37, y: 0.09, w: 0.26, h: 0.15 };

/** A written book whose DemoClipTV profile fixes **Add to export** — and a logo, or not. */
const book = (controls: Record<string, string>) => ({
  version: 2,
  activeId: 'tv',
  profiles: [
    { id: 'default', name: 'Default', controls: {} },
    { id: 'tv', name: 'DemoClipTV', controls },
  ],
});

const writeBook = (page: Page, state: unknown): Promise<void> =>
  page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [KEY, state]);

/** Pick a target in the Export menu and read the downloaded bytes. */
async function exportFile(page: Page, item: string): Promise<Buffer> {
  await page.locator('#btn-exp').click();
  const download = page.waitForEvent('download');
  await page.locator(item).click();
  const file = await download;
  const path = await file.path();
  if (!path) throw new Error('the export wrote no file');
  return readFile(path);
}

/**
 * Decode the file a little way in — inside the card at its head — and read the pixels where the
 * logo goes. `bright` counts what the mark draws; `painted` counts the picture being there at
 * all, so a frame that failed to decode cannot pass for a card with no logo.
 */
async function logoBox(page: Page, bytes: Buffer): Promise<{ bright: number; painted: number }> {
  return page.evaluate(async ({ base64, box }) => {
    const binary = atob(base64);
    const data = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    const url = URL.createObjectURL(new Blob([data], { type: 'video/webm' }));
    video.src = url;
    await new Promise<void>(resolve => {
      video.addEventListener('loadeddata', () => resolve(), { once: true });
      setTimeout(resolve, 3000);
    });
    // A little way into the card, so the frame is the card at the head and not the join to
    // the clip — sought rather than played, which is what makes it the same frame every run.
    video.currentTime = 0.5;
    await new Promise<void>(resolve => {
      video.addEventListener('seeked', () => resolve(), { once: true });
      setTimeout(resolve, 3000);
    });
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d')!;
    context.drawImage(video, 0, 0);
    const x = Math.round(box.x * canvas.width);
    const y = Math.round(box.y * canvas.height);
    const w = Math.round(box.w * canvas.width);
    const h = Math.round(box.h * canvas.height);
    const pixels = context.getImageData(x, y, w, h).data;
    let bright = 0;
    let painted = 0;
    for (let at = 0; at < pixels.length; at += 4) {
      if (pixels[at] > 200 && pixels[at + 1] > 200 && pixels[at + 2] > 200) bright++;
      if (Math.max(pixels[at], pixels[at + 1], pixels[at + 2]) > 40) painted++;
    }
    URL.revokeObjectURL(url);
    return { bright, painted };
  }, { base64: bytes.toString('base64'), box: LOGO_BOX });
}

/** A clip of one second, made under the profile the book has active. */
async function clipUnderTheProfile(page: Page, app: ReturnType<typeof boot>): Promise<Buffer> {
  await writeBook(page, book({ addToExport: 'true', logo: 'democlip' }));
  await page.reload();
  await expect(page.locator('#s-text')).toHaveText('Ready');
  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.add(takes);
  await app.review();
  return exportFile(page, '#exp-webm');
}

test('a profile that fixes a logo puts it on the head of the export', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  const bytes = await clipUnderTheProfile(page, app);

  // The mark the app ships is drawn where the card puts a logo — over a picture that is
  // itself there, so a blank frame cannot pass for this.
  const box = await logoBox(page, bytes);
  expect(box.bright).toBeGreaterThan(200);
  expect(box.painted).toBeGreaterThan(1000);
});

test('a card with no logo puts nothing there, so the count is the picture alone', async ({ page }) => {
  const app = boot(page);
  await app.goto();

  // The same card, the same clip, one thing different: no logo.
  await writeBook(page, book({ addToExport: 'true' }));
  await page.reload();
  await expect(page.locator('#s-text')).toHaveText('Ready');
  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.add(takes);
  await app.review();

  const bytes = await exportFile(page, '#exp-webm');
  const box = await logoBox(page, bytes);
  expect(box.bright).toBeLessThan(20);
  expect(box.painted).toBeGreaterThan(1000);    // the picture is there; only the mark is not
});

test('the logo a profile fixes is not the person’s to change, and names the profile', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  await clipUnderTheProfile(page, app);

  await page.locator('#props-btn').click();
  const row = page.locator('#clip-prop-menu .prop-row[data-id="logo"]');
  await expect(row.locator('.prop-value')).toHaveText('democlip');
  await expect(row.locator('.prop-note')).toHaveText('set by DemoClipTV');
  // No field to type a different mark into.
  await expect(row.locator('input')).toHaveCount(0);
});

test('a logo is defined in the profile’s own sheet, and reaches the export from there', async ({ page }) => {
  const app = boot(page);
  await app.goto();

  // A profile of the person's own, defined in its own sheet rather than in the list.
  await page.locator('#profile-btn').click();
  await page.locator('.profile-new-btn').click();
  await page.locator('.profile-new-input').fill('DemoClipTV');
  await page.locator('.profile-new-add').click();
  const row = page.locator('.profile-row:not([data-id="default"])');
  await row.locator('.profile-ico[data-act="define"]').click();
  await expect(page.locator('#profile-def-bd')).toHaveClass(/on/);

  // A switch is three ways — Free, On, Off — and a value is a field, empty for nothing.
  await expect(page.locator('.pdef-row[data-id="addToExport"] .pdef-opt')).toHaveCount(3);
  const field = page.locator('.pdef-row[data-id="logo"] input');
  await expect(field).toHaveValue('');
  await field.fill('democlip');
  await field.press('Tab');
  await page.locator('#profile-def-done').click();
  await expect(page.locator('#profile-def-bd')).not.toHaveClass(/on/);

  // Choose it, and the mark it fixes is applied — and drawn.
  await row.locator('.profile-pick').click();
  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.add(takes);
  await app.review();
  const bytes = await exportFile(page, '#exp-webm');
  expect((await logoBox(page, bytes)).bright).toBeGreaterThan(200);
});
