// The round trip through the app: a clip leaves for editing and comes back whole.
//
// The export writes two files — the picture alone, and the annotations beside it — and the
// import is handed both. What is asserted is what a person sees: the clip is longer, and
// the annotations are on the timeline lane again, over the take that came back.

import { expect, test, type Download, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { boot } from '../helpers/app.js';
import { makeTakes } from '../fixtures/takes.js';

/** An arrow over the middle of the clip, through the app's own operation. */
async function drawAnArrow(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const surface = (globalThis as { democlip?: { edit: { annotate(kind: string, params: unknown): unknown } } }).democlip;
    await surface?.edit.annotate('arrow', {
      span: { s: 0.2, e: 0.8 },
      from: { x: 0.3, y: 0.4 },
      to: { x: 0.6, y: 0.5 },
    });
  });
}

/** Export for editing, and keep the two files the browser writes. */
async function exportForEditing(page: Page, into: string): Promise<string[]> {
  const taken: Download[] = [];
  page.on('download', download => taken.push(download));

  await page.locator('#btn-exp').click();
  await page.locator('#exp-editing').click();

  await expect.poll(() => taken.length, { timeout: 30_000 }).toBe(2);
  const paths: string[] = [];
  for (const [at, download] of taken.entries()) {
    const path = join(into, `${at}-${download.suggestedFilename()}`);
    await download.saveAs(path);
    paths.push(path);
  }
  return paths;
}

test('a clip exported for editing comes back with its annotations', async ({ page }) => {
  const work = await mkdtemp(join(tmpdir(), 'democlip-round-trip-'));
  try {
    const app = boot(page);
    await app.gotoAgent();
    const takes = await makeTakes(page, { width: 640, height: 360, seconds: 4 });
    await app.seed(takes);
    await app.review();
    await drawAnArrow(page);
    await expect(page.locator('#tl-annots > *')).toHaveCount(1);

    // Out: the picture alone, and the annotations written beside it.
    const files = await exportForEditing(page, work);
    expect(files[0]).toMatch(/\.webm$/);
    expect(files[1]).toMatch(/\.democlip\.json$/);

    // In: the video and the sidecar, chosen together as a person would.
    const chooser = page.waitForEvent('filechooser');
    await page.locator('#file-btn').click();
    await (await chooser).setFiles(files);

    // The take is in the clip — it is the clip's own four seconds plus the file — and the
    // annotations are back: the one that left, over the take it was drawn on, and the
    // file's copy over the stretch the file was given.
    await expect.poll(async () =>
      Number((await page.locator('#t-clip').textContent())?.replace('s', '') ?? 0),
      { timeout: 20_000 },
    ).toBeGreaterThan(7.5);
    await expect(page.locator('#tl-annots > *')).toHaveCount(2);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});
