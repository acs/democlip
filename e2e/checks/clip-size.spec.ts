// Clip size: a clip of takes whose own pictures differ plays and exports in one frame.
//
// The clip's size is the largest take picture (both even), derived — never the person's
// to set — and every take is fitted whole into it, in the review and in the file. The
// takes are edited from the app's own model here, never recorded, so the check drives
// exactly what a person would see.

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

/** Append a take built by the fixture, with the picture size it was encoded at. */
async function addStoredTake(page: Page, index: number, picture: { width: number; height: number }): Promise<void> {
  await page.evaluate(async ({ url, index, picture }) => {
    const { session } = await import(/* @vite-ignore */ url);
    const window_ = window as unknown as { __e2eTakes?: Array<{ blob: Blob; seconds: number }> };
    const take = (window_.__e2eTakes ?? [])[index];
    if (take) session.clip.addTake(take.blob, take.seconds, picture);
  }, { url: HOOKS, index, picture });
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

test('the clip size is shown in the panel, and there is nothing to edit it with', async ({ page }) => {
  const app = boot(page);
  await app.gotoAgent();
  const takes = await makeTakes(page, { width: 1280, height: 720, seconds: 2 });
  await app.seed(takes);
  await app.review();

  await expect.poll(() => clipSize(page)).toBe('1280x720');

  // The panel shows the size the clip will be written at — as a value, not a control.
  await page.locator('#props-btn').click();
  await expect(page.locator('#clip-prop-menu .prop-value')).toHaveText('1280x720');
  const sizeRow = page.locator('#clip-prop-menu .prop-row').filter({ hasText: 'Clip size' });
  await expect(sizeRow.locator('input')).toHaveCount(0);
  await expect(sizeRow.locator('textarea')).toHaveCount(0);
  await page.locator('#props-btn').click();

  // And an agent is refused the same way: the size is not the person's to set.
  const refused = await page.evaluate(async () => {
    const surface = (globalThis as { democlip?: { edit: { setClipProperty(p: string, v: string): unknown } } }).democlip;
    return surface?.edit.setClipProperty('size', '800x600');
  });
  expect(refused).toMatchObject({ ok: false });
  await expect.poll(() => clipSize(page)).toBe('1280x720');
});

test('the clip size follows the takes, and a reload comes back to it', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  const takes = await makeTakes(page, { width: 1280, height: 720, seconds: 2 });
  await app.seed(takes);
  await app.review();

  await expect.poll(() => clipSize(page)).toBe('1280x720');

  // The takes carry their own picture sizes, so the derived size comes back with them.
  await page.reload();
  await expect.poll(() => clipSize(page)).toBe('1280x720');
  await expect.poll(() => canvasSize(page)).toEqual({ width: 1280, height: 720 });
});

test('a larger take grows the clip size, and a smaller one does not shrink it', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.seed(takes);
  await app.review();
  await expect.poll(() => clipSize(page)).toBe('640x360');

  // A larger take arrives: the clip grows to it and the frame follows.
  const larger = await makeTake(page, { width: 1280, height: 720, seconds: 1 });
  await addStoredTake(page, larger.index, { width: 1280, height: 720 });
  await expect.poll(() => clipSize(page)).toBe('1280x720');
  await expect.poll(() => canvasSize(page)).toEqual({ width: 1280, height: 720 });

  // A smaller one does not shrink it.
  const smaller = await makeTake(page, { width: 320, height: 180, seconds: 1 });
  await addStoredTake(page, smaller.index, { width: 320, height: 180 });
  await expect.poll(() => clipSize(page)).toBe('1280x720');
});
