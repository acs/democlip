// Annotations: each kind is placed over a section through the real canvas and made in the
// clip's annotation colour, and a text's box stays the shape of its own words however small
// it is dragged — including small enough that its grips reach across it, where a press inside
// moves it rather than resizing it.

import { expect, test, type Page } from '@playwright/test';
import { boot } from '../helpers/app.js';
import { makeTakes } from '../fixtures/takes.js';
import { pageModule } from '../helpers/page-module.js';

const HOOKS = pageModule('e2e/support/app-hooks.ts');

// A 1×1 PNG: enough for the image kind to decode and place.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Bound a section on the timeline, so the kind's action is offered. */
async function section(page: Page): Promise<void> {
  const strip = await page.locator('#thumbs').boundingBox();
  if (!strip) throw new Error('no thumbnail strip');
  const y = strip.y + strip.height / 2;
  await page.mouse.click(strip.x + strip.width * 0.25, y);
  await page.mouse.click(strip.x + strip.width * 0.5, y);
}

/** The colour an annotation of this kind is drawn in, read from the clip's own annotation. */
const colourOf = (page: Page, kind: string) => page.evaluate(async ([url, wanted]: [string, string]) => {
  const { session } = await import(/* @vite-ignore */ url);
  const one = session.clip.annotations.all.find((annotation: { kind: string }) => annotation.kind === wanted) as
    { colour?: string } | undefined;
  return one?.colour ?? null;
}, [HOOKS, kind] as [string, string]);

test('each annotation kind — arrow, image and text — is placed over a section, in the clip’s colour, and shown on the lane', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  const takes = await makeTakes(page, { width: 1280, height: 720, seconds: 4 });
  await app.seed(takes);
  await app.review();

  // The clip's own panel offers the colour every new annotation is made in, and starts at the
  // app's red.
  await page.locator('#props-btn').click();
  const colour = page.locator('#clip-prop-menu .prop-row[data-id="annotationColour"] select');
  await expect(colour).toHaveValue('#e53e3e');
  await colour.selectOption('#38a169');
  await page.locator('#props-btn').click();

  // An arrow, drawn across the picture — and in the clip's colour, not the kind's own red.
  await section(page);
  await page.locator('[data-act="add"][data-kind="arrow"]').click();
  const preview = await page.locator('#preview').boundingBox();
  if (!preview) throw new Error('no preview');
  const at = (fx: number, fy: number) => ({ x: preview.x + preview.width * fx, y: preview.y + preview.height * fy });
  const from = at(0.3, 0.3);
  const to = at(0.7, 0.7);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  // The annotation lane shows where the annotation is.
  await expect(page.locator('#tl-annots > *')).toHaveCount(1);
  expect(await colourOf(page, 'arrow')).toBe('#38a169');

  // An image, chosen from a file.
  await section(page);
  const chooser = page.waitForEvent('filechooser');
  await page.locator('[data-act="add"][data-kind="image"]').click();
  await (await chooser).setFiles({ name: 'dot.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.locator('#tl-annots > *')).toHaveCount(2);

  // Text, typed into the app's own entry rather than the browser's prompt — in the colour the
  // clip's panel is left holding: neither the white a text used to fall back to nor the
  // arrow's.
  await page.locator('#props-btn').click();
  await colour.selectOption('#3182ce');
  await page.locator('#props-btn').click();
  await section(page);
  await page.locator('[data-act="add"][data-kind="text"]').click();
  await page.locator('#text-entry-input').fill('Hello');
  await page.locator('#text-entry-add').click();
  await expect(page.locator('#tl-annots > *')).toHaveCount(3);
  expect(await colourOf(page, 'text')).toBe('#3182ce');
});

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

test('a text keeps the words’ shape when it is dragged small, and a press inside it moves it', async ({ page }) => {
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
  const preview = (await page.locator('#preview').boundingBox())!;
  const at = (fx: number, fy: number) => ({ x: preview.x + preview.width * fx, y: preview.y + preview.height * fy });

  // Drag the bottom-right grip in, far past the smallest size it may be: it stops at the
  // floor, and stays the shape the words are.
  const se = at(placed.x + placed.width, placed.y + placed.height);
  const inward = at(placed.x + placed.width * 0.02, placed.y + placed.height * 0.02);
  await page.mouse.move(se.x, se.y);
  await page.mouse.down();
  await page.mouse.move(inward.x, inward.y, { steps: 10 });
  await page.mouse.up();

  const floored = (await read(page))!;
  // At the floor — the drag asked for smaller — with the whole line still inside its box,
  // so the box is the shape the words are.
  expect(floored.height).toBeLessThan(placed.height);
  expect(floored.height).toBeCloseTo(0.02, 3);
  expect(floored.boxPx).toBeGreaterThan(floored.drawnPx * 0.9);
  expect(floored.boxPx).toBeLessThan(floored.drawnPx * 1.1);

  // Which is small enough that a grip reaches across it: the box has no body left.
  expect(floored.height * preview.height).toBeLessThan(28);
  expect(floored.width * preview.width).toBeLessThan(28 * 3);

  // So a press just inside its left edge — within a grip's reach of both left corners, and
  // the very press that used to resize it — moves it instead, keeping its size.
  const inside = at(floored.x + 5 / preview.width, floored.y + floored.height / 2);
  const away = at(floored.x + 5 / preview.width + 0.08, floored.y + floored.height / 2 + 0.08);
  await page.mouse.move(inside.x, inside.y);
  await page.mouse.down();
  await page.mouse.move(away.x, away.y, { steps: 8 });
  await page.mouse.up();

  const moved = (await read(page))!;
  expect(moved.x).toBeGreaterThan(floored.x + 0.03);
  expect(moved.y).toBeGreaterThan(floored.y + 0.03);
  expect(Math.abs(moved.width - floored.width)).toBeLessThan(0.005);
  expect(Math.abs(moved.height - floored.height)).toBeLessThan(0.005);
  // And it is still the shape of the words where it landed.
  expect(moved.boxPx).toBeGreaterThan(moved.drawnPx * 0.9);
  expect(moved.boxPx).toBeLessThan(moved.drawnPx * 1.1);
});
