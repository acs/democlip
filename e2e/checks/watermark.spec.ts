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

/** The band the title line is drawn in: under the mark, in the same corner. */
const TITLE_BAND = { x: 0.55, y: 0.11, w: 0.45, h: 0.14 };

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
async function bandDiffers(page: Page, a: Buffer, b: Buffer, box = WATERMARK_BAND): Promise<number> {
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
  }, { left: a.toString('base64'), right: b.toString('base64'), box, at: IN_THE_CLIP });
}

/** Set the clip's own logo, and wait for the mark to follow it. */
async function setLogo(page: Page, name: string): Promise<void> {
  await page.evaluate(async ([url, value]) => {
    const { session } = await import(/* @vite-ignore */ url);
    session.clip.setProperty('logo', value as string);
  }, [HOOKS, name] as [string, string]);
  await expect.poll(() => worn(page, 'image')).toBe(name !== '');
}

/** Set the clip's own title, and wait for the line under the mark to follow it. */
async function setTitle(page: Page, text: string): Promise<void> {
  await page.evaluate(async ([url, value]) => {
    const { session } = await import(/* @vite-ignore */ url);
    session.clip.setProperty('title', value as string);
  }, [HOOKS, text] as [string, string]);
  await expect.poll(() => worn(page, 'text')).toBe(text !== '');
}

/** Is one of the watermark's annotations of this kind on the clip? */
const worn = (page: Page, kind: string): Promise<boolean> =>
  page.evaluate(async ([url, wanted]) => {
    const { session } = await import(/* @vite-ignore */ url);
    return session.clip.watermarks().some((one: { kind: string }) => one.kind === wanted);
  }, [HOOKS, kind] as [string, string]);

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

test('the clip’s title is worn under the mark, 20% smaller, and drawn there', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  await clipWithTheCard(page, app);
  await setLogo(page, 'democlip');

  // With the mark alone, the band under it is the picture.
  const withoutTitle = await exportFile(page, '#exp-webm');

  await setTitle(page, 'A demo');
  const mark = await watermarkRect(page);
  const title = await watermarkTitleRect(page);
  if (!mark || !title) throw new Error('no watermark');

  // The line's box: under the mark, 20% smaller, right-aligned with it so the block reads as one.
  expect(title.text).toBe('A demo');
  expect(title.y).toBeGreaterThanOrEqual(mark.y + mark.height);
  expect(title.height).toBeCloseTo(mark.height * 0.8, 5);
  expect(title.x + title.width).toBeCloseTo(mark.x + mark.width, 5);

  // And it is drawn: the band under the mark is not the same picture any more.
  const withTitle = await exportFile(page, '#exp-webm');
  expect(await bandDiffers(page, withoutTitle, withTitle, TITLE_BAND)).toBeGreaterThan(100);

  // It goes with the title: cleared, the line goes and the mark stays.
  await setTitle(page, '');
  expect(await watermarkTitleRect(page)).toBeNull();
  expect(await watermarkRect(page)).not.toBeNull();
});

test('a part of the watermark the person takes away stays away', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  await clipWithTheCard(page, app);
  await setLogo(page, 'democlip');
  await setTitle(page, 'A demo');
  await expect(page.locator('#tl-annots .tl-annot')).toHaveCount(2);

  // The person takes the title line away.
  await page.evaluate(async url => {
    const { session } = await import(/* @vite-ignore */ url);
    session.clip.removeAnnotation('watermark-title');
  }, HOOKS);
  await expect.poll(() => watermarkTitleRect(page)).toBeNull();

  // A change to the **other** property does not put it back...
  await setLogo(page, 'graditone');
  await page.waitForTimeout(400);
  expect(await watermarkTitleRect(page)).toBeNull();

  // ...nor does opening the clip again.
  await page.reload();
  await expect(page.locator('#s-text')).toHaveText('Ready');
  await page.waitForTimeout(800);
  expect(await watermarkTitleRect(page)).toBeNull();
  expect(await watermarkRect(page)).not.toBeNull();

  // But the title moving puts it back, under the mark.
  await setTitle(page, 'A demo again');
  await expect.poll(async () => (await watermarkTitleRect(page))?.text ?? null).toBe('A demo again');
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

/** The mark's rect, as fractions of the picture, read from the clip's own model. */
const watermarkRect = (page: Page) => page.evaluate(async url => {
  const { session } = await import(/* @vite-ignore */ url);
  const worn = session.clip.watermarks().find((one: { kind: string }) => one.kind === 'image') as {
    geometry: { x: number; y: number; width: number; height: number; imageId: string };
  } | undefined;
  if (!worn) return null;
  const { x, y, width, height, imageId } = worn.geometry;
  return { x, y, width, height, imageId };
}, HOOKS);

/** The title line's box, as fractions of the picture, read from the clip's own model. */
const watermarkTitleRect = (page: Page) => page.evaluate(async url => {
  const { session } = await import(/* @vite-ignore */ url);
  const worn = session.clip.watermarks().find((one: { kind: string }) => one.kind === 'text') as {
    geometry: { x: number; y: number; width: number; height: number; text: string };
  } | undefined;
  if (!worn) return null;
  const { x, y, width, height, text } = worn.geometry;
  return { x, y, width, height, text };
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
  expect(moved?.imageId).toBe('logo:democlip');
  expect(moved!.x).toBeLessThan(before.x - 0.1);

  // Drag its south-east grip: it resizes, keeping the mark's own proportions.
  const grip = at(moved!.x + moved!.width, moved!.y + moved!.height);
  const wider = at(moved!.x + moved!.width + 0.2, moved!.y + moved!.height + 0.2);
  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  await page.mouse.move(wider.x, wider.y, { steps: 8 });
  await page.mouse.up();

  const resized = await watermarkRect(page);
  expect(resized?.imageId).toBe('logo:democlip');
  expect(resized!.width).toBeGreaterThan(moved!.width);
});
