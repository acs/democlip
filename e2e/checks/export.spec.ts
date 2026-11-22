// Export: the file carries a real duration and cue points, not a MediaRecorder's zero.

import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { boot } from '../helpers/app.js';
import { makeTakes } from '../fixtures/takes.js';

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

/** Decode the file's metadata in the page and read its duration. */
async function durationOf(page: Page, bytes: Buffer, mime: string): Promise<number> {
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
    const seconds = video.duration;
    URL.revokeObjectURL(url);
    return seconds;
  }, { base64: bytes.toString('base64'), type: mime });
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

test('exporting WebM writes a file with a real duration', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.seed(takes);
  await app.review();

  const bytes = await exportFile(page, '#exp-webm');
  const duration = await durationOf(page, bytes, 'video/webm');
  expect(duration).toBeGreaterThan(0.5);
  expect(duration).toBeLessThan(2);
});

test('exporting MP4 writes a file with a real duration', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.seed(takes);
  await app.review();

  const supported = await page.evaluate(async () => {
    if (typeof VideoEncoder !== 'function') return false;
    const result = await VideoEncoder.isConfigSupported({
      codec: 'avc1.640028', width: 640, height: 360, bitrate: 4_000_000,
    });
    return !!result.supported;
  });
  test.skip(!supported, 'this browser cannot encode MP4 (AVC) offline');

  const bytes = await exportFile(page, '#exp-mp4');
  const duration = await durationOf(page, bytes, 'video/mp4');
  expect(duration).toBeGreaterThan(0.5);
  expect(duration).toBeLessThan(2);
});

// The regression this change fixes: an 854×480 take used to be encoded at 1280×720,
// six times the bytes and less detail than went in. The file is asked for its own
// track size, not the encoder's default.
test('exporting a small take keeps its own size, not 1280×720', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  const takes = await makeTakes(page, { width: 854, height: 480, seconds: 1 });
  await app.seed(takes);
  await app.review();

  const bytes = await exportFile(page, '#exp-webm');
  expect(await trackSizeOf(page, bytes, 'video/webm')).toEqual({ width: 854, height: 480 });
});

test('exporting a small take to MP4 keeps its own size too', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  const takes = await makeTakes(page, { width: 854, height: 480, seconds: 1 });
  await app.seed(takes);
  await app.review();

  const supported = await page.evaluate(async () => {
    if (typeof VideoEncoder !== 'function') return false;
    const result = await VideoEncoder.isConfigSupported({
      codec: 'avc1.640028', width: 854, height: 480, bitrate: 4_000_000,
    });
    return !!result.supported;
  });
  test.skip(!supported, 'this browser cannot encode MP4 (AVC) offline');

  const bytes = await exportFile(page, '#exp-mp4');
  expect(await trackSizeOf(page, bytes, 'video/mp4')).toEqual({ width: 854, height: 480 });
});

// The card at the head of a file: the clip's title and description over its first frame,
// for three seconds, when the clip asks for it. The file is three seconds longer than the
// clip, and its first frames are the card rather than the recording.
test('a clip that asks for the card gets three seconds of it at the head of the file', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.seed(takes);
  await app.review();

  // Give the clip its words, and turn the card on — through the panel, as a person would.
  await page.locator('#props-btn').click();
  await expect(page.locator('#clip-prop-menu')).toHaveClass(/on/);
  await page.locator('#clip-prop-menu input.prop-input').fill('A short demo');
  await page.locator('#clip-prop-menu textarea').fill('What the clip shows');
  await page.locator('#clip-prop-menu input[type="checkbox"]').check();
  await page.locator('#props-btn').click();

  const bytes = await exportFile(page, '#exp-webm');
  const duration = await durationOf(page, bytes, 'video/webm');
  // One second of clip and three of card: about 3.95s, the export stopping a hair early.
  expect(duration).toBeGreaterThan(3.4);
  expect(duration).toBeLessThan(5);
});
