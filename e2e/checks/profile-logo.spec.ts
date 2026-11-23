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
import { pageModule } from '../helpers/page-module.js';

const KEY = 'democlip_profiles';
const HOOKS = pageModule('e2e/support/app-hooks.ts');

/**
 * The band of the card the logo is drawn in: the top of the picture, above the words. The box
 * itself is `LOGO_BOX` in `src/ui/exporting/intro-text.ts`, inside this band — the check is that
 * the mark is drawn at the head of the card, not that it lands on a particular pixel.
 */
const LOGO_BAND = { x: 0.2, y: 0.03, w: 0.6, h: 0.3 };

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
  }, { base64: bytes.toString('base64'), box: LOGO_BAND });
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
  expect(box.bright).toBeGreaterThan(500);
  expect(box.painted).toBeGreaterThan(5000);
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
  expect(box.bright).toBeLessThan(30);
  expect(box.painted).toBeGreaterThan(5000);    // the picture is there; only the mark is not
});

test('the logo a profile fixes is not the person’s to change, and wears a lock naming the profile', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  await clipUnderTheProfile(page, app);

  await page.locator('#props-btn').click();
  const row = page.locator('#clip-prop-menu .prop-row[data-id="logo"]');
  // Shown as the mark is called, not as the name it is kept as, and naming the profile.
  await expect(row.locator('.prop-value')).toHaveText('DemoClip');
  await expect(row.locator('.prop-lock')).toHaveAttribute('title', 'Set by DemoClipTV');
  // No control to pick a different mark from.
  await expect(row.locator('input, select')).toHaveCount(0);
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

  // A switch is three ways — Free, On, Off — and an item the app has a list for is that list,
  // with **Not fixed** above it, which is where a profile starts.
  await expect(page.locator('.pdef-row[data-id="addToExport"] .pdef-opt')).toHaveCount(3);
  const list = page.locator('.pdef-row[data-id="logo"] select');
  await expect(list.locator('option')).toHaveText(['Not fixed', 'None', 'DemoClip', 'Graditone']);
  await expect(list.locator('option:checked')).toHaveText('Not fixed');
  await list.selectOption('democlip');
  await expect(list.locator('option:checked')).toHaveText('DemoClip');
  await page.locator('#profile-def-done').click();
  await expect(page.locator('#profile-def-bd')).not.toHaveClass(/on/);

  // Choose it, and the mark it fixes is applied — and drawn.
  await row.locator('.profile-pick').click();
  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.add(takes);
  await app.review();
  const bytes = await exportFile(page, '#exp-webm');
  expect((await logoBox(page, bytes)).bright).toBeGreaterThan(500);
});

/** Set the clip's own logo — free, because the profile in these checks controls other items. */
const setLogo = (page: Page, name: string): Promise<unknown> =>
  page.evaluate(async ([url, value]) => {
    const { session } = await import(/* @vite-ignore */ url as string);
    return session.clip.setProperty('logo', value as string);
  }, [HOOKS, name] as [string, string]);

/**
 * Decode the same moment of two files and count the pixels of the band that differ.
 *
 * This is the proof that works for **any** mark: it says nothing about what colour a logo is,
 * only that the head of the card is not the same picture as it was without one — so a yellow
 * clef and a white camera are held to the same standard.
 */
async function bandDiffers(page: Page, a: Buffer, b: Buffer): Promise<number> {
  return page.evaluate(async ({ left, right, box }) => {
    const frameAt = async (base64: string): Promise<ImageData> => {
      const binary = atob(base64);
      const data = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([data], { type: 'video/webm' }));
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      video.src = url;
      await new Promise<void>(resolve => {
        video.addEventListener('loadeddata', () => resolve(), { once: true });
        setTimeout(resolve, 3000);
      });
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
      URL.revokeObjectURL(url);
      return context.getImageData(
        Math.round(box.x * canvas.width), Math.round(box.y * canvas.height),
        Math.round(box.w * canvas.width), Math.round(box.h * canvas.height),
      );
    };

    const one = await frameAt(left);
    const two = await frameAt(right);
    let differs = 0;
    for (let at = 0; at < one.data.length; at += 4) {
      if (Math.abs(one.data[at] - two.data[at]) > 60
        || Math.abs(one.data[at + 1] - two.data[at + 1]) > 60
        || Math.abs(one.data[at + 2] - two.data[at + 2]) > 60) differs++;
    }
    return differs;
  }, { left: a.toString('base64'), right: b.toString('base64'), box: LOGO_BAND });
}

test('every mark the app ships draws on the card, and a name it does not serve draws nothing', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  await writeBook(page, book({ addToExport: 'true' }));
  await page.reload();
  await expect(page.locator('#s-text')).toHaveText('Ready');
  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.add(takes);
  await app.review();

  // The card with no mark on it: the frame everything below is held against.
  const bare = await exportFile(page, '#exp-webm');

  // Each mark the app lists, drawn — which is also what proves the file behind the name is
  // really served: a name with no picture behind it would leave the band as it was.
  for (const name of ['democlip', 'graditone']) {
    await setLogo(page, name);
    const marked = await exportFile(page, '#exp-webm');
    expect(await bandDiffers(page, bare, marked), `${name} is not on the card`).toBeGreaterThan(2000);
  }

  // A name the app does not serve: nothing is drawn, and the export is not held up by it.
  await setLogo(page, 'nope');
  const nothing = await exportFile(page, '#exp-webm');
  expect(await bandDiffers(page, bare, nothing)).toBeLessThan(50);
});
