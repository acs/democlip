// The timeline and the clip it shows: the strip and the sum of the takes, the one frame a
// clip of differently-sized takes plays and exports in, the clip kept across a reload with
// its size derived rather than set, and a section cut out and taken back.
//
// The takes are edited from the app's own model here, never recorded, so the checks drive
// exactly what a person would see.

import { expect, test, type Page } from '@playwright/test';
import { boot } from '../helpers/app.js';
import { makeTakes } from '../fixtures/takes.js';
import { pageModule } from '../helpers/page-module.js';
import { exportFile, probeFile } from '../helpers/exports.js';

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

test('a clip of fixture takes shows its strip and sum, its frame follows the largest take, and a portrait cell keeps its shape', async ({ page }) => {
  const app = boot(page);
  await app.goto();

  // The length is the sum of the takes, never a field beside them, and the strip is built by
  // seeking the element through the clip: 22 cells.
  const takes = await makeTakes(
    page,
    { width: 600, height: 400, seconds: 1.2 },
    { width: 1280, height: 720, seconds: 1.2 },
  );
  await app.seed(takes);
  await app.review();
  expect(await app.clipLength()).toBeCloseTo(2.4, 2);
  await expect(page.locator('#t-clip')).toHaveText('2.40s');
  await expect(page.locator('#thumbs canvas')).toHaveCount(22);

  // A clip of takes whose own pictures differ plays and exports in one frame: the largest.
  const mixed = await makeTakes(page, { width: 640, height: 360, seconds: 1 }, { width: 960, height: 540, seconds: 1 });
  await app.seed(mixed);
  await app.review();
  await expect.poll(() => clipSize(page)).toBe('960x540');
  await expect.poll(() => canvasSize(page)).toEqual({ width: 960, height: 540 });
  const bytes = await exportFile(page, '#exp-webm');
  expect(await probeFile(page, bytes, 'video/webm')).toMatchObject({ width: 960, height: 540 });

  // A larger take arrives: the clip grows to it and the frame follows. A smaller one does
  // not shrink it.
  const small = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.seed(small);
  await app.review();
  await expect.poll(() => clipSize(page)).toBe('640x360');
  const larger = await makeTakes(page, { width: 1280, height: 720, seconds: 1 });
  await app.add(larger);
  await expect.poll(() => clipSize(page)).toBe('1280x720');
  await expect.poll(() => canvasSize(page)).toEqual({ width: 1280, height: 720 });
  const smaller = await makeTakes(page, { width: 320, height: 180, seconds: 1 });
  await app.add(smaller);
  await expect.poll(() => clipSize(page)).toBe('1280x720');

  // A portrait picture keeps its shape in a cell and is cropped to it, not stretched. The
  // strip's cells are not the picture's shape — a portrait region is an ordinary one.
  const portrait = await makeTakes(page, { width: 360, height: 640, seconds: 1 });
  await app.seed(portrait);
  await app.review();
  const cell = page.locator('#thumbs canvas').first();
  await expect(cell).toBeVisible();
  const bitmap = await cell.evaluate(c => ({ w: c.width, h: c.height }));
  expect(bitmap.h).toBeGreaterThan(bitmap.w);
  expect(bitmap.w / bitmap.h).toBeCloseTo(360 / 640, 2);
  expect(await cell.evaluate(c => getComputedStyle(c).objectFit)).toBe('cover');
});

test('a section becomes a cut, one undo puts it back, and the clip is kept with its size shown', async ({ page }) => {
  const app = boot(page);
  await app.gotoAgent();          // the size is refused to an agent too
  const takes = await makeTakes(page, { width: 1280, height: 720, seconds: 4 });
  await app.seed(takes);
  await app.review();

  // The header names the panel and nothing more: the export's size moved under the Export
  // button, where the button's own word says what the number is.
  await expect(page.locator('#tl-label')).toHaveText('Timeline');

  // The timeline is drawn over the thumbnail strip, so a click is measured there. Two clicks
  // bound a section and the chip names it; the scissors takes it out and the timeline closes up.
  const box = await page.locator('#thumbs').boundingBox();
  if (!box) throw new Error('no thumbnail strip');
  const y = box.y + box.height / 2;
  const clickAt = (fraction: number) => page.mouse.click(box.x + box.width * fraction, y);

  // One mark: the header keeps to the times, and the mark's own tooltip carries the hint
  // to click again — it is not a line beside the times.
  await clickAt(0.25);
  await expect(page.locator('#t-cut')).toHaveText('');
  await expect(page.locator('#t-cut-wrap')).not.toHaveClass(/on/);
  await expect(page.locator('.tl-mark')).toHaveAttribute('title', /click again to close the section/);

  await clickAt(0.5);
  await expect(page.locator('#t-cut')).toContainText('CUT');
  // The section offers the cut alone: the keep/undo button is gone, and a click outside
  // the section is what drops the selection.
  await expect(page.locator('#tl-marks .tl-act')).toHaveCount(1);
  await expect(page.locator('#tl-marks [data-act="keep"]')).toHaveCount(0);
  await page.locator('[data-act="cut"]').click();
  await expect(page.locator('#cut-undo')).toBeVisible();
  await expect(page.locator('#t-clip')).toHaveText('3.00s');   // 1 s of the 4 removed

  // The one undo brings it back.
  await page.locator('#cut-undo').click();
  await expect(page.locator('#t-clip')).toHaveText('4.00s');

  // The size is shown in the panel as a value, not a control — the largest take, both even,
  // never the person's to set — and an agent is refused the same way.
  await expect.poll(() => clipSize(page)).toBe('1280x720');
  await page.locator('#props-btn').click();
  await expect(page.locator('#clip-prop-menu .prop-value')).toHaveText('1280x720');
  const sizeRow = page.locator('#clip-prop-menu .prop-row').filter({ hasText: 'Clip size' });
  await expect(sizeRow.locator('input')).toHaveCount(0);
  await expect(sizeRow.locator('textarea')).toHaveCount(0);
  await page.locator('#props-btn').click();
  const refused = await page.evaluate(async () => {
    const surface = (globalThis as { democlip?: { edit: { setClipProperty(p: string, v: string): unknown } } }).democlip;
    return surface?.edit.setClipProperty('size', '800x600');
  });
  expect(refused).toMatchObject({ ok: false });
  await expect.poll(() => clipSize(page)).toBe('1280x720');

  // It is kept with the clip — the write is debounced, so wait for the store — and a reload
  // comes back to it, frame and all.
  await expect.poll(async () => page.evaluate(async () => {
    const databases = await indexedDB.databases();
    return databases.some(entry => entry.name === 'democlip');
  })).toBe(true);
  await page.reload();
  await expect.poll(() => app.clipLength()).toBeCloseTo(4, 1);
  await expect.poll(() => clipSize(page)).toBe('1280x720');
  await expect.poll(() => canvasSize(page)).toEqual({ width: 1280, height: 720 });
});
