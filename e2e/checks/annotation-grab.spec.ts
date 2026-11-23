// Picking up an annotation too small to have a body of its own.
//
// The grips are drawn at a shape's corners and take hold within `GRIP_PX` screen pixels of one,
// so a corner can be caught even from just outside. But a shape smaller than its own grips has no
// body left: every press inside it lands within reach of a corner, so the press resizes it and it
// can never be picked up and **moved**. A text dragged down to the smallest size is exactly that —
// a box about 41×8 screen px, with grips reaching 14 px.
//
// The rule: a press **inside** such a shape moves it, and its corners still resize from on them or
// just outside. A shape with no second dimension is not this — an arrow is a line, its ends are its
// whole self — so its grips come first as they always have.
//
// This places a text, drags it down to a size too small for its grips, then presses just inside its
// left edge and drags: the box must **move**, keeping its size, where a grip would have resized it.

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

/** The one text annotation's box, as fractions of the picture. */
const read = (page: Page) => page.evaluate(async url => {
  const { session } = await import(/* @vite-ignore */ url);
  const one = session.clip.annotations.all.find((a: { kind: string }) => a.kind === 'text') as
    { geometry: { x: number; y: number; width: number; height: number } } | undefined;
  return one ? { ...one.geometry } : null;
}, HOOKS);

test('an annotation too small for its grips is moved by a press inside it', async ({ page }) => {
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

  const preview = (await page.locator('#preview').boundingBox())!;
  const at = (fx: number, fy: number) => ({ x: preview.x + preview.width * fx, y: preview.y + preview.height * fy });

  // Drag the bottom-right grip in, down to a box smaller than the grips reach.
  const placed = (await read(page))!;
  const grip = at(placed.x + placed.width, placed.y + placed.height);
  const small = at(placed.x + placed.width * 0.2, placed.y + placed.height * 0.4);
  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  await page.mouse.move(small.x, small.y, { steps: 8 });
  await page.mouse.up();

  const before = (await read(page))!;
  // The box it now is: small enough that a grip reaches across it.
  const boxPx = { w: before.width * preview.width, h: before.height * preview.height };
  expect(boxPx.h).toBeLessThan(28);
  expect(boxPx.w).toBeLessThan(28 * 3);

  // A press just inside the left edge — within a grip's reach of both left corners, and the very
  // press that used to resize it — then dragged away.
  const inside = at(before.x + 5 / preview.width, before.y + before.height / 2);
  const away = at(before.x + 5 / preview.width + 0.08, before.y + before.height / 2 + 0.08);
  await page.mouse.move(inside.x, inside.y);
  await page.mouse.down();
  await page.mouse.move(away.x, away.y, { steps: 8 });
  await page.mouse.up();

  const after = (await read(page))!;
  // It moved, and kept its size: a grip would have resized it in place instead.
  expect(after.x).toBeGreaterThan(before.x + 0.03);
  expect(after.y).toBeGreaterThan(before.y + 0.03);
  expect(Math.abs(after.width - before.width)).toBeLessThan(0.005);
  expect(Math.abs(after.height - before.height)).toBeLessThan(0.005);
});
