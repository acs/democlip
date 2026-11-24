// Annotations: each kind is placed over a section through the real canvas, and a text's
// box stays the shape of its own words however small it is dragged — including small
// enough that its grips reach across it, where a press inside moves it rather than
// resizing it.

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

test('each annotation kind — arrow, image and text — is placed over a section and shown on the lane', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  const takes = await makeTakes(page, { width: 1280, height: 720, seconds: 4 });
  await app.seed(takes);
  await app.review();

  // An arrow, drawn across the picture.
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

  // An image, chosen from a file.
  await section(page);
  const chooser = page.waitForEvent('filechooser');
  await page.locator('[data-act="add"][data-kind="image"]').click();
  await (await chooser).setFiles({ name: 'dot.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.locator('#tl-annots > *')).toHaveCount(2);

  // Text, typed into the app's own entry rather than the browser's prompt.
  await section(page);
  await page.locator('[data-act="add"][data-kind="text"]').click();
  await page.locator('#text-entry-input').fill('Hello');
  await page.locator('#text-entry-add').click();
  await expect(page.locator('#tl-annots > *')).toHaveCount(3);
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
  const shown = () => page.evaluate(async url => {
    const { session, player } = await import(/* @vite-ignore */ url);
    return session.clip.annotationsAt(player.time()).length;
  }, HOOKS);
  // A click that misses the strip leaves the playhead where it was, so it is asked again —
  // a miss under load is the machine's, not a change in what the app does.
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.mouse.click(strip.x + strip.width * 0.5, strip.y + strip.height / 2);
    try {
      await expect.poll(shown, { timeout: 4_000 }).toBe(1);
      return;
    } catch { /* the click missed the strip; ask again */ }
  }
  expect(await shown()).toBe(1);
}

/** A press-and-drag of the mouse, from one point to another. */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
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
    count: session.clip.annotations.all.length,
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
  // A grip is pressed a few px **outside** its corner. A press a hair inside a box with no body
  // would be taken as a press to move it, which is the rule this check is about — so the grips
  // are aimed at from the outside, where the corner still reaches 14 px.
  const grip = (box: { x: number; y: number; width: number; height: number }) =>
    at(box.x + box.width + 3 / preview.width, box.y + box.height);

  // Drag the bottom-right grip in, to a box smaller than the grips reach across — one with no
  // body of its own — but not down to the smallest size: the taller it is, the more room a
  // press has to land inside it, and anything under 28 screen px is still no body (the grips
  // reach 14 px, so a height that small puts the middle within a grip's reach of both corners).
  await drag(
    page,
    grip(placed),
    at(placed.x + placed.width * 0.45, placed.y + placed.height * 0.45),
  );

  const small = (await read(page))!;
  expect(small.height).toBeLessThan(placed.height);
  expect(small.height * preview.height).toBeLessThan(28);
  // Still the shape the words are, so the whole line is inside its own box.
  expect(small.boxPx).toBeGreaterThan(small.drawnPx * 0.9);
  expect(small.boxPx).toBeLessThan(small.drawnPx * 1.1);

  // A press only lands on an annotation the playhead is showing — both the move and a grip
  // are looked for among `annotationsAt(player.time())` — so the playhead is put back on the
  // clip's middle before a press, whatever a previous drag left it at.
  await parkInside(page);

  // A press just inside its left edge — within a grip's reach of both left corners, and the
  // very press that would otherwise resize it — **moves** it, keeping its size. The edge is
  // read again here, and 3 px in: the picked shape's own controls sit a fixed 22 px to either
  // side of that edge, so the press is kept well clear of them.
  const fresh = (await page.locator('#preview').boundingBox())!;
  const inside = { x: fresh.x + fresh.width * small.x + 3, y: fresh.y + fresh.height * (small.y + small.height / 2) };
  const away = { x: inside.x + fresh.width * 0.08, y: inside.y + fresh.height * 0.08 };
  await drag(page, inside, away);

  const moved = (await read(page))!;
  expect(moved.count).toBe(small.count);          // moved, not copied or removed
  expect(moved.x).toBeGreaterThan(small.x + 0.03);
  expect(moved.y).toBeGreaterThan(small.y + 0.03);
  expect(Math.abs(moved.width - small.width)).toBeLessThan(0.005);
  expect(Math.abs(moved.height - small.height)).toBeLessThan(0.005);
  expect(moved.boxPx).toBeGreaterThan(moved.drawnPx * 0.9);
  expect(moved.boxPx).toBeLessThan(moved.drawnPx * 1.1);

  // Dragged on past the smallest size it may be, it stops at the floor — the drag asked for
  // smaller — and stays the shape the words are there too. The playhead is put back first, so
  // the grip is one of the annotations the moment shows.
  await parkInside(page);
  await drag(
    page,
    grip(moved),
    at(moved.x + moved.width * 0.02, moved.y + moved.height * 0.02),
  );

  const floored = (await read(page))!;
  expect(floored.height).toBeLessThan(moved.height);
  expect(floored.height).toBeCloseTo(0.02, 3);
  expect(floored.boxPx).toBeGreaterThan(floored.drawnPx * 0.9);
  expect(floored.boxPx).toBeLessThan(floored.drawnPx * 1.1);
});
