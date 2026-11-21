// Import: a video file already on the machine becomes a take.
//
// The file is built in the page (a real, decodable WebM or MP4) and handed to the
// app's own file input through a real file chooser, exactly as a person choosing a
// file would. Which containers are taken in, and the refusal of the ones that are
// not, is a rule with a unit test beside it and is not repeated here — a check is a
// browser boot, so only what needs a browser gets one.

import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { boot } from '../helpers/app.js';
import { makeFile, type FixtureFile } from '../fixtures/takes.js';

/** Choose a file through the Import button, the way a person does. */
async function importFile(page: Page, file: FixtureFile): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#file-btn').click();
  await (await chooser).setFiles(file);
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

test('a video file becomes a take, with its own sound', async ({ page }) => {
  const app = boot(page);
  await app.goto();

  const file = await makeFile(page, {
    name: 'clip.webm', mimeType: 'video/webm', width: 640, height: 360, seconds: 1, hasAudio: true,
  });
  await importFile(page, file);

  // The file joined the clip as one take, holding its own length...
  await expect.poll(() => app.clipLength(), { timeout: 15_000 }).toBeCloseTo(1, 1);
  // ...and the review opened on it: the timeline is up and the export is offered.
  await expect(page.locator('#thumbs canvas').first()).toBeVisible();
  await expect(page.locator('#btn-exp')).toBeVisible();
  // ...and its own sound came with it, so the audio track is drawn.
  await expect(page.locator('#waveform')).toBeVisible();
  await expect(page.locator('#s-text')).toHaveText('Ready');
});

test('an imported MP4 is read back by the export', async ({ page }) => {
  const app = boot(page);
  await app.goto();

  const file = await makeFile(page, {
    name: 'clip.mp4', mimeType: 'video/mp4', container: 'mp4', width: 640, height: 360, seconds: 1,
  });
  await importFile(page, file);
  await expect.poll(() => app.clipLength(), { timeout: 15_000 }).toBeCloseTo(1, 1);

  // The export decodes the takes it writes; an MP4 take has to come back as a file
  // with a real duration, not a broken one.
  const bytes = await exportFile(page, '#exp-webm');
  const duration = await page.evaluate(async (base64) => {
    const binary = atob(base64);
    const data = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i);
    const video = document.createElement('video');
    video.preload = 'metadata';
    const url = URL.createObjectURL(new Blob([data], { type: 'video/webm' }));
    video.src = url;
    await new Promise<void>(resolve => {
      video.addEventListener('loadedmetadata', () => resolve(), { once: true });
      setTimeout(resolve, 3000);
    });
    const seconds = video.duration;
    URL.revokeObjectURL(url);
    return seconds;
  }, bytes.toString('base64'));
  expect(duration).toBeGreaterThan(0.5);
  expect(duration).toBeLessThan(2);
});
