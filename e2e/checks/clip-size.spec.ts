// Clip size: a clip of takes whose own pictures differ plays and exports in one frame.
//
// The clip's size is the largest take picture (both even) until the person sets one in
// the clip properties panel; every take is fitted whole into it, in the review and in
// the file. The takes are edited from the app's own model here — never recorded — so
// the check drives exactly what a person would see.

import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { boot } from '../helpers/app.js';
import { makeTake, makeTakes } from '../fixtures/takes.js';
import { pageModule } from '../helpers/page-module.js';

const HOOKS = pageModule('e2e/support/app-hooks.ts');

/** The preview canvas's own size — what the review draws every take into. */
const canvasSize = (page: Page): Promise<{ width: number; height: number }> =>
  page.evaluate(() => {
    const canvas = document.getElementById('preview') as HTMLCanvasElement;
    return { width: canvas.width, height: canvas.height };
  });

/** The clip's own size, from the app's model. */
const clipSize = (page: Page): Promise<string | null> =>
  page.evaluate(async (url) => {
    const { session } = await import(/* @vite-ignore */ url);
    return session.clip.size()?.toString() ?? null;
  }, HOOKS);

/** What the clip store has written down for the size — the debounced write, awaited. */
const storedSize = (page: Page): Promise<string | undefined> =>
  page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const opened = indexedDB.open('democlip');
      opened.onsuccess = () => resolve(opened.result);
      opened.onerror = () => reject(opened.error);
    });
    const meta = await new Promise<{ properties?: Record<string, string> } | undefined>((resolve, reject) => {
      const request = db.transaction('meta', 'readonly').objectStore('meta').get('current');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return meta?.properties?.size;
  });

/** Append a take built by the fixture, with the picture size it was encoded at. */
async function addStoredTake(page: Page, index: number, picture: { width: number; height: number }): Promise<void> {
  await page.evaluate(async ({ url, index, picture }) => {
    const { session } = await import(/* @vite-ignore */ url);
    const window_ = window as unknown as { __e2eTakes?: Array<{ blob: Blob; seconds: number }> };
    const take = (window_.__e2eTakes ?? [])[index];
    if (take) session.clip.addTake(take.blob, take.seconds, picture);
  }, { url: HOOKS, index, picture });
}

/** Type a `W×H` into the panel's size row and close it, as a person would. */
async function setSize(page: Page, value: string): Promise<void> {
  const [width, height] = value.split('x');
  if (!(await page.locator('#clip-prop-menu').evaluate(node => node.classList.contains('on')))) {
    await page.locator('#props-btn').click();
  }
  const fields = page.locator('#clip-prop-menu .prop-size input');
  await fields.first().fill(width);
  await fields.nth(1).fill(height);
  await page.locator('#props-btn').click();
}

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

/** Decode the file's metadata in the page and read its video track's size. */
async function trackSizeOf(page: Page, bytes: Buffer, mime: string): Promise<{ width: number; height: number }> {
  return page.evaluate(async ({ base64, type }) => {
    const binary = atob(base64);
    const data = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i);
    const blob = new Blob([data], { type });
    const video = document.createElement('video');
    video.preload = 'metadata';
    const url = URL.createObjectURL(blob);
    video.src = url;
    await new Promise<void>(resolve => {
      video.addEventListener('loadedmetadata', () => resolve(), { once: true });
      setTimeout(resolve, 3000);
    });
    const size = { width: video.videoWidth, height: video.videoHeight };
    URL.revokeObjectURL(url);
    return size;
  }, { base64: bytes.toString('base64'), type: mime });
}

test('a clip of takes of different sizes plays in one frame and exports it', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  const takes = await makeTakes(
    page,
    { width: 640, height: 360, seconds: 1 },
    { width: 960, height: 540, seconds: 1 },
  );
  await app.seed(takes);
  await app.review();

  // The frame is the largest take — the second one — for both of them.
  await expect.poll(() => clipSize(page)).toBe('960x540');
  await expect.poll(() => canvasSize(page)).toEqual({ width: 960, height: 540 });

  const bytes = await exportFile(page, '#exp-webm');
  expect(await trackSizeOf(page, bytes, 'video/webm')).toEqual({ width: 960, height: 540 });
});

test('the clip size is shown and set in the panel, and taken back by the one undo', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  const takes = await makeTakes(page, { width: 1280, height: 720, seconds: 2 });
  await app.seed(takes);
  await app.review();

  await expect.poll(() => clipSize(page)).toBe('1280x720');

  // The panel shows the size the clip will be written at, as two numbers.
  await page.locator('#props-btn').click();
  await expect(page.locator('#clip-prop-menu .prop-size input').first()).toHaveValue('1280');
  await expect(page.locator('#clip-prop-menu .prop-size input').nth(1)).toHaveValue('720');

  await page.locator('#clip-prop-menu .prop-size input').first().fill('800');
  await page.locator('#clip-prop-menu .prop-size input').nth(1).fill('600');
  await page.locator('#props-btn').click();

  await expect.poll(() => clipSize(page)).toBe('800x600');
  await expect.poll(() => canvasSize(page)).toEqual({ width: 800, height: 600 });

  // The header's one undo takes it back.
  await page.locator('#cut-undo').click();
  await expect.poll(() => clipSize(page)).toBe('1280x720');
});

test('the clip size is kept with the clip, and a reload comes back to it', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  const takes = await makeTakes(page, { width: 1280, height: 720, seconds: 2 });
  await app.seed(takes);
  await app.review();

  await setSize(page, '800x600');
  await expect.poll(() => clipSize(page)).toBe('800x600');
  await expect.poll(() => canvasSize(page)).toEqual({ width: 800, height: 600 });

  // The write is debounced, so wait for the store before a reload.
  await expect.poll(() => storedSize(page)).toBe('800x600');
  await page.reload();
  await expect.poll(() => clipSize(page)).toBe('800x600');
  await expect.poll(() => canvasSize(page)).toEqual({ width: 800, height: 600 });
});

test('a larger take grows the clip size, and a size the person set is not moved by it', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.seed(takes);
  await app.review();
  await expect.poll(() => clipSize(page)).toBe('640x360');

  // a larger take arrives: the clip grows to it and the frame follows
  const larger = await makeTake(page, { width: 1280, height: 720, seconds: 1 });
  await addStoredTake(page, larger.index, { width: 1280, height: 720 });
  await expect.poll(() => clipSize(page)).toBe('1280x720');
  await expect.poll(() => canvasSize(page)).toEqual({ width: 1280, height: 720 });

  // once the person sets one, a later larger take does not move it
  await setSize(page, '800x600');
  await expect.poll(() => clipSize(page)).toBe('800x600');

  const biggest = await makeTake(page, { width: 1920, height: 1080, seconds: 1 });
  await addStoredTake(page, biggest.index, { width: 1920, height: 1080 });
  await expect.poll(() => clipSize(page)).toBe('800x600');
});
