// The clip's **watermark**: the logo it wears, drawn over the whole of its picture.
//
// A clip that wears a **logo** wears it as a watermark too — an image annotation over the whole
// clip, which the review shows, the lane lists and every export draws — and under it, at half its
// height, its **title**, in the clip's **annotation colour** like any other text. The proof that
// each is *drawn* is a pixel count: two files with the same card and the same clip, decoded at the
// same moment of the clip's own body — where the only thing that differs is the mark, or the line.

import { expect, test, type Page } from '@playwright/test';
import { boot } from '../helpers/app.js';
import { makeTakes } from '../fixtures/takes.js';
import { pageModule } from '../helpers/page-module.js';
import { exportFile, frameDiff } from '../helpers/exports.js';

const HOOKS = pageModule('e2e/support/app-hooks.ts');

/** The band the watermark is drawn in: the top-right corner of the picture. */
const WATERMARK_BAND = { x: 0.78, y: 0, width: 0.22, height: 0.25 };

/** The band the title line is drawn in: under the mark, in the same corner. */
const TITLE_BAND = { x: 0.55, y: 0.11, width: 0.45, height: 0.14 };

/** A second into the clip's own body — the card at the head is two seconds long. */
const IN_THE_CLIP = 2.5;

/** Set the clip's own logo, and wait for the mark to follow it. */
async function setLogo(page: Page, name: string): Promise<void> {
  await page.evaluate(async ([url, value]) => {
    const { session } = await import(/* @vite-ignore */ url);
    session.clip.setProperty('logo', value as string);
  }, [HOOKS, name] as [string, string]);
  await expect.poll(() => worn(page, 'image')).toBe(name !== '');
}

/** Set the clip's own title, and wait for the line under the mark to follow it. */
async function setTitle(page: Page, text: string): Promise<void> {
  await page.evaluate(async ([url, value]) => {
    const { session } = await import(/* @vite-ignore */ url);
    session.clip.setProperty('title', value as string);
  }, [HOOKS, text] as [string, string]);
  await expect.poll(() => worn(page, 'text')).toBe(text !== '');
}

/** Set the colour every new annotation is made in, and wait for the clip to hold it. */
async function setAnnotationColour(page: Page, value: string): Promise<void> {
  await page.evaluate(async ([url, colour]) => {
    const { session } = await import(/* @vite-ignore */ url);
    session.clip.setProperty('annotationColour', colour as string);
  }, [HOOKS, value] as [string, string]);
  await expect.poll(() => page.evaluate(async url => {
    const { session } = await import(/* @vite-ignore */ url);
    return session.clip.properties.get('annotationColour');
  }, HOOKS)).toBe(value);
}

/** The colour the watermark's title line is drawn in, read from the clip's own model. */
const watermarkTitleColour = (page: Page): Promise<string | null> => page.evaluate(async url => {
  const { session } = await import(/* @vite-ignore */ url);
  const worn = session.clip.watermarks().find((one: { kind: string }) => one.kind === 'text') as
    { colour: string } | undefined;
  return worn?.colour ?? null;
}, HOOKS);

/** Is one of the watermark's annotations of this kind on the clip? */
const worn = (page: Page, kind: string): Promise<boolean> =>
  page.evaluate(async ([url, wanted]) => {
    const { session } = await import(/* @vite-ignore */ url);
    return session.clip.watermarks().some((one: { kind: string }) => one.kind === wanted);
  }, [HOOKS, kind] as [string, string]);

/** A one-second clip with the title card switched on, so two exports share a shape. */
async function clipWithTheCard(page: Page, app: ReturnType<typeof boot>): Promise<void> {
  await page.evaluate(async url => {
    const { session } = await import(/* @vite-ignore */ url);
    session.clip.setProperty('addToExport', 'true');
  }, HOOKS);
  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.add(takes);
  await app.review();
}

/** The mark's rect, as fractions of the picture, read from the clip's own model. */
const watermarkRect = (page: Page) => page.evaluate(async url => {
  const { session } = await import(/* @vite-ignore */ url);
  const worn = session.clip.watermarks().find((one: { kind: string }) => one.kind === 'image') as {
    geometry: { x: number; y: number; width: number; height: number; imageId: string };
  } | undefined;
  if (!worn) return null;
  const { x, y, width, height, imageId } = worn.geometry;
  return { x, y, width, height, imageId };
}, HOOKS);

/** The title line's box, as fractions of the picture, read from the clip's own model. */
const watermarkTitleRect = (page: Page) => page.evaluate(async url => {
  const { session } = await import(/* @vite-ignore */ url);
  const worn = session.clip.watermarks().find((one: { kind: string }) => one.kind === 'text') as {
    geometry: { x: number; y: number; width: number; height: number; text: string };
  } | undefined;
  if (!worn) return null;
  const { x, y, width, height, text } = worn.geometry;
  return { x, y, width, height, text };
}, HOOKS);

test('a clip that wears a logo wears it as a watermark, with its title under it, and the lane lists both', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  await clipWithTheCard(page, app);

  const bare = await exportFile(page, '#exp-webm');      // the card, no mark anywhere

  // The mark: the lane lists it while it is worn, and it is drawn over the whole clip.
  await setLogo(page, 'democlip');
  await expect(page.locator('#tl-annots .tl-annot')).toHaveCount(1);
  const marked = await exportFile(page, '#exp-webm');
  expect(await frameDiff(page, bare, marked, 'video/webm', IN_THE_CLIP, WATERMARK_BAND)).toBeGreaterThan(300);

  // The line: under the mark, half its height, right-aligned with it so the block reads as
  // one — a subtitle to the mark, not a second heading beside it.
  await setTitle(page, 'A demo');
  await expect(page.locator('#tl-annots .tl-annot')).toHaveCount(2);
  const mark = await watermarkRect(page);
  const title = await watermarkTitleRect(page);
  if (!mark || !title) throw new Error('no watermark');
  expect(title.text).toBe('A demo');
  expect(title.y).toBeGreaterThanOrEqual(mark.y + mark.height);
  expect(title.height).toBeCloseTo(mark.height * 0.5, 5);
  expect(title.x + title.width).toBeCloseTo(mark.x + mark.width, 5);

  // And it is drawn: the band under the mark is not the same picture any more.
  const withTitle = await exportFile(page, '#exp-webm');
  expect(await frameDiff(page, marked, withTitle, 'video/webm', IN_THE_CLIP, TITLE_BAND)).toBeGreaterThan(100);

  // The line is a text, and follows the clip's annotation colour like any other: it is made in
  // the red a new text takes, and a change to the colour repaints it where it stands rather than
  // placing another.
  expect(await watermarkTitleColour(page)).toBe('#e53e3e');
  await setAnnotationColour(page, '#3182ce');
  await expect.poll(() => watermarkTitleColour(page)).toBe('#3182ce');
  const repainted = await watermarkTitleRect(page);
  expect(repainted).toMatchObject({ text: 'A demo' });
  expect(repainted!.x).toBeCloseTo(title.x, 5);
  expect(repainted!.y).toBeCloseTo(title.y, 5);

  // And the file carries the new colour: exported again, the band the line is drawn in differs
  // from the red line's own file.
  const recoloured = await exportFile(page, '#exp-webm');
  expect(await frameDiff(page, withTitle, recoloured, 'video/webm', IN_THE_CLIP, TITLE_BAND)).toBeGreaterThan(50);

  // It goes with the title: cleared, the line goes and the mark stays.
  await setTitle(page, '');
  expect(await watermarkTitleRect(page)).toBeNull();
  expect(await watermarkRect(page)).not.toBeNull();

  // Clearing the logo takes the watermark away; the lane lists it only while it is worn.
  await setLogo(page, '');
  await expect(page.locator('#tl-annots .tl-annot')).toHaveCount(0);

  // A title with no logo wears the line alone, in the corner; a logo joins it, above it.
  await setTitle(page, 'A demo');
  await expect.poll(() => watermarkTitleRect(page)).not.toBeNull();
  // Placed after the colour changed, so it is made in that colour.
  expect(await watermarkTitleColour(page)).toBe('#3182ce');
  expect(await watermarkRect(page)).toBeNull();
  await setLogo(page, 'democlip');
  const alone = await watermarkRect(page);
  const under = await watermarkTitleRect(page);
  expect(alone).not.toBeNull();
  expect(under!.y).toBeGreaterThanOrEqual(alone!.y + alone!.height);

  // And clearing the logo takes only the mark, leaving the line.
  await setLogo(page, '');
  expect(await watermarkRect(page)).toBeNull();
  expect(await watermarkTitleRect(page)).not.toBeNull();
});

test('a part of the watermark taken away stays away, and the mark is picked, moved and resized', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  await clipWithTheCard(page, app);
  await setLogo(page, 'democlip');

  // It is an ordinary annotation: picked by its middle and moved, keeping its proportions.
  const before = await watermarkRect(page);
  if (!before) throw new Error('no watermark was placed');
  const preview = await page.locator('#preview').boundingBox();
  if (!preview) throw new Error('no preview');
  const at = (fx: number, fy: number) => ({ x: preview.x + preview.width * fx, y: preview.y + preview.height * fy });

  const middle = at(before.x + before.width / 2, before.y + before.height / 2);
  const to = at(before.x + before.width / 2 - 0.3, before.y + before.height / 2 + 0.4);
  await page.mouse.move(middle.x, middle.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();

  const moved = await watermarkRect(page);
  expect(moved?.imageId).toBe('logo:democlip');
  expect(moved!.x).toBeLessThan(before.x - 0.1);

  // Dragged by its south-east grip, it resizes.
  const grip = at(moved!.x + moved!.width, moved!.y + moved!.height);
  const wider = at(moved!.x + moved!.width + 0.2, moved!.y + moved!.height + 0.2);
  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  await page.mouse.move(wider.x, wider.y, { steps: 8 });
  await page.mouse.up();

  const resized = await watermarkRect(page);
  expect(resized?.imageId).toBe('logo:democlip');
  expect(resized!.width).toBeGreaterThan(moved!.width);

  // A part the person takes away stays away: the title line is removed while the mark is worn.
  await setTitle(page, 'A demo');
  await expect(page.locator('#tl-annots .tl-annot')).toHaveCount(2);
  await page.evaluate(async url => {
    const { session } = await import(/* @vite-ignore */ url);
    session.clip.removeAnnotation('watermark-title');
  }, HOOKS);
  await expect.poll(() => watermarkTitleRect(page)).toBeNull();

  // A change to the **other** property does not put it back...
  await setLogo(page, 'graditone');
  await page.waitForTimeout(400);
  expect(await watermarkTitleRect(page)).toBeNull();

  // ...nor does opening the clip again.
  await page.reload();
  await expect(page.locator('#s-text')).toHaveText('Ready');
  await page.waitForTimeout(800);
  expect(await watermarkTitleRect(page)).toBeNull();
  expect(await watermarkRect(page)).not.toBeNull();

  // But the title moving puts it back, under the mark.
  await setTitle(page, 'A demo again');
  await expect.poll(async () => (await watermarkTitleRect(page))?.text ?? null).toBe('A demo again');
});
