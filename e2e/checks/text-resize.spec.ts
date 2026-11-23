// A text annotation's box, resized down to the smallest size it may be.
//
// The box is the shape the words are: its width is what the line measured and its height is the
// font size, so the grips sit on the text and a press inside the box picks it. Resizing scales
// both by one factor to keep that shape. The smallest size is a box of `MIN_SIZE`, and clamping
// the two edges **one at a time** to it broke the shape: whichever edge reached the floor first
// stopped, the other kept shrinking, and the line ran out past its own box — so at the smallest
// size the grips covered only the first word and the rest of the text could not be picked.
//
// This drives a real corner drag through the canvas down to the floor, then reads the box from the
// clip and the line's drawn width from the canvas and holds the two together.

import { expect, test, type Page } from '@playwright/test';
import { boot } from '../helpers/app.js';
import { makeTakes } from '../fixtures/takes.js';
import { pageModule } from '../helpers/page-module.js';

const HOOKS = pageModule('e2e/support/app-hooks.ts');

/** Bound the whole clip as the section, so the text kind's action is offered and its stretch holds. */
async function wholeClip(page: Page): Promise<void> {
  const strip = await page.locator('#thumbs').boundingBox();
  if (!strip) throw new Error('no thumbnail strip');
  const y = strip.y + strip.height / 2;
  await page.mouse.click(strip.x + 1, y);
  await page.mouse.click(strip.x + strip.width - 1, y);
}

/** Park the playhead in the middle of the clip: the canvas only picks what the moment shows. */
async function parkInside(page: Page): Promise<void> {
  const strip = await page.locator('#thumbs').boundingBox();
  if (!strip) throw new Error('no thumbnail strip');
  await page.mouse.click(strip.x + strip.width * 0.5, strip.y + strip.height / 2);
  await expect.poll(async () => page.evaluate(async url => {
    const { session, player } = await import(/* @vite-ignore */ url);
    return session.clip.annotationsAt(player.time()).length;
  }, HOOKS)).toBe(1);
}

/** The one text annotation: its box, and the width the words are actually drawn at. */
const read = (page: Page) => page.evaluate(async url => {
  const { session } = await import(/* @vite-ignore */ url);
  const cv = document.getElementById('preview') as HTMLCanvasElement;
  const ctx = cv.getContext('2d')!;
  const one = session.clip.annotations.all.find((a: { kind: string }) => a.kind === 'text') as
    { geometry: { text: string; x: number; y: number; width: number; height: number } } | undefined;
  if (!one) return null;
  const g = one.geometry;
  ctx.font = `600 ${g.height * cv.height}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
  return {
    text: g.text,
    boxPx: g.width * cv.width,
    drawnPx: ctx.measureText(g.text).width,
    height: g.height,
    x: g.x, y: g.y, width: g.width,
  };
}, HOOKS);

test('a text keeps the words’ shape when it is resized to the smallest size', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  const takes = await makeTakes(page, { width: 1512, height: 982, seconds: 4 });
  await app.seed(takes);
  await app.review();
  await wholeClip(page);

  await page.locator('[data-act="add"][data-kind="text"]').click();
  await page.locator('#text-entry-input').fill('Africa-Toto');
  await page.locator('#text-entry-add').click();
  // The entry fades out; until it has, its backdrop is still over the picture and takes the press.
  await expect(page.locator('#text-entry')).toBeHidden();
  await parkInside(page);

  const placed = (await read(page))!;
  expect(placed.text).toBe('Africa-Toto');

  // Take hold of the bottom-right grip and drag it in, far past the smallest size.
  const preview = (await page.locator('#preview').boundingBox())!;
  const at = (fx: number, fy: number) => ({ x: preview.x + preview.width * fx, y: preview.y + preview.height * fy });
  const se = at(placed.x + placed.width, placed.y + placed.height);
  const inward = at(placed.x + placed.width * 0.02, placed.y + placed.height * 0.02);
  await page.mouse.move(se.x, se.y);
  await page.mouse.down();
  await page.mouse.move(inward.x, inward.y, { steps: 10 });
  await page.mouse.up();

  // It is at the smallest size it may be — the drag asked for smaller.
  const resized = (await read(page))!;
  expect(resized.height).toBeLessThan(placed.height);
  expect(resized.height).toBeCloseTo(0.02, 3);

  // And the box is still the shape the words are: the whole line is inside it, so its grips sit on
  // the text and any press on the line picks it.
  expect(resized.boxPx).toBeGreaterThan(resized.drawnPx * 0.9);
  expect(resized.boxPx).toBeLessThan(resized.drawnPx * 1.1);
});
