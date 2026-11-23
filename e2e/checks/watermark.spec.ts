// The clip's **watermark**: the logo it wears, drawn over the whole of its picture.
//
// A clip that wears a **logo** wears it as a watermark too — an image annotation over the whole
// clip, which the review shows, the lane lists and every export draws. The proof that it is
// *drawn* is a pixel count: two files with the same card and the same clip, one wearing a logo,
// decoded at the same moment of the clip's own body — where the only thing that differs is the
// mark in the corner.

import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { boot } from '../helpers/app.js';
import { makeTakes } from '../fixtures/takes.js';
import { pageModule } from '../helpers/page-module.js';

const HOOKS = pageModule('e2e/support/app-hooks.ts');

/** The band the watermark is drawn in: the top-right corner of the picture. */
const WATERMARK_BAND = { x: 0.78, y: 0, w: 0.22, h: 0.25 };

/** A second into the clip's own body — the card at the head is two seconds long. */
const IN_THE_CLIP = 2.5;

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
 * Decode the same moment of two files and count the pixels of the band that differ. It says
 * nothing about what colour a mark is, only that the corner is not the same picture — so any
 * mark the app ships is held to the same standard.
 */
async function bandDiffers(page: Page, a: Buffer, b: Buffer): Promise<number> {
  return page.evaluate(async ({ left, right, box, at }) => {
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
      video.currentTime = at;
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
    for (let index = 0; index < one.data.length; index += 4) {
      if (Math.abs(one.data[index] - two.data[index]) > 60
        || Math.abs(one.data[index + 1] - two.data[index + 1]) > 60
        || Math.abs(one.data[index + 2] - two.data[index + 2]) > 60) differs++;
    }
    return differs;
  }, { left: a.toString('base64'), right: b.toString('base64'), box: WATERMARK_BAND, at: IN_THE_CLIP });
}

/** Set the clip's own logo, and wait for the watermark to follow it. */
async function setLogo(page: Page, name: string): Promise<void> {
  await page.evaluate(async ([url, value]) => {
    const { session } = await import(/* @vite-ignore */ url);
    session.clip.setProperty('logo', value as string);
  }, [HOOKS, name] as [string, string]);
  await expect.poll(() => page.evaluate(async url => {
    const { session } = await import(/* @vite-ignore */ url);
    return session.clip.watermark() ? 1 : 0;
  }, HOOKS)).toBe(name ? 1 : 0);
}

/** A one-second clip with the title card switched on, so two exports share a shape. */
async function clipWithTheCard(page: Page, app: ReturnType<typeof boot>): Promise<void> {
  await page.evaluate(async url => {
    const { session } = await import(/* @vite-ignore */ url);
    session.clip.setProperty('addToExport', 'true');
  }, HOOKS);
  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.add(takes);
  await app.review();
}

test('a clip that wears a logo wears it as a watermark over the whole clip', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  await clipWithTheCard(page, app);

  const bare = await exportFile(page, '#exp-webm');      // the card, no mark anywhere
  await setLogo(page, 'democlip');
  const marked = await exportFile(page, '#exp-webm');

  // In the clip's own body the corner is not the same picture: the mark is drawn there.
  expect(await bandDiffers(page, bare, marked)).toBeGreaterThan(300);
});

test('clearing the logo takes the watermark away, and the lane lists it while it is worn', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  await clipWithTheCard(page, app);

  await setLogo(page, 'democlip');
  await expect(page.locator('#tl-annots .tl-annot')).toHaveCount(1);

  await setLogo(page, '');
  await expect(page.locator('#tl-annots .tl-annot')).toHaveCount(0);
});

/** The watermark's rect, as fractions of the picture, read from the clip's own model. */
const watermarkRect = (page: Page) => page.evaluate(async url => {
  const { session } = await import(/* @vite-ignore */ url);
  const worn = session.clip.watermark() as {
    geometry: { x: number; y: number; width: number; height: number; logo?: string };
  } | null;
  if (!worn) return null;
  const { x, y, width, height, logo } = worn.geometry;
  return { x, y, width, height, logo };
}, HOOKS);

test('the watermark is picked, moved and resized on the picture like any annotation', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  await clipWithTheCard(page, app);
  await setLogo(page, 'democlip');

  const before = await watermarkRect(page);
  if (!before) throw new Error('no watermark was placed');
  const preview = await page.locator('#preview').boundingBox();
  if (!preview) throw new Error('no preview');
  const at = (fx: number, fy: number) => ({ x: preview.x + preview.width * fx, y: preview.y + preview.height * fy });

  // Drag it by its middle, away from the corner it was placed in.
  const middle = at(before.x + before.width / 2, before.y + before.height / 2);
  const to = at(before.x + before.width / 2 - 0.3, before.y + before.height / 2 + 0.4);
  await page.mouse.move(middle.x, middle.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();

  const moved = await watermarkRect(page);
  expect(moved?.logo).toBe('democlip');
  expect(moved!.x).toBeLessThan(before.x - 0.1);

  // Drag its south-east grip: it resizes, keeping the mark's own proportions.
  const grip = at(moved!.x + moved!.width, moved!.y + moved!.height);
  const wider = at(moved!.x + moved!.width + 0.2, moved!.y + moved!.height + 0.2);
  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  await page.mouse.move(wider.x, wider.y, { steps: 8 });
  await page.mouse.up();

  const resized = await watermarkRect(page);
  expect(resized?.logo).toBe('democlip');
  expect(resized!.width).toBeGreaterThan(moved!.width);
});
