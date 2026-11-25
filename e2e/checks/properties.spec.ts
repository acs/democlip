// The clip's own properties: its title and its description.
//
// The rule lives in node (`src/domain/clip/ClipProperties.test.ts`); what a person must
// be able to see — the panel, the two fields, the values kept with the clip across a
// reload, the card switch waiting for something to draw, and the one undo — is here. The
// publish dialogs read the same values when they open; the prefill itself is reasoned
// rather than booted, because it needs a signed-in account this suite has none of. An
// agent reads and writes the same values through the surface, in `agent.spec.ts`.

import { expect, test, type Page } from '@playwright/test';
import { boot } from '../helpers/app.js';
import { openSettings } from '../helpers/annotations.js';
import { makeTakes } from '../fixtures/takes.js';
import { pageModule } from '../helpers/page-module.js';

const HOOKS = pageModule('e2e/support/app-hooks.ts');

/** The clip's own properties, read from the app's own model. */
const properties = (page: Page): Promise<Record<string, string>> =>
  page.evaluate(async (url) => {
    const { session } = await import(/* @vite-ignore */ url);
    return session.clip.properties.toRecord();
  }, HOOKS);

/** What the clip store has written down for them — the debounced write, awaited. */
const stored = (page: Page): Promise<Record<string, string>> =>
  page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const opened = indexedDB.open('democlip');
      opened.onsuccess = () => resolve(opened.result);
      opened.onerror = () => reject(opened.error);
    });
    const meta = await new Promise<{ properties?: Record<string, string> } | undefined>((resolve, reject) => {
      const request = db.transaction('meta', 'readonly').objectStore('meta').get('current');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return meta?.properties ?? {};
  });

test('the panel gives the clip a title and a description, kept across a reload, with the one undo', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  const takes = await makeTakes(page, { width: 1280, height: 720, seconds: 2 });
  await app.seed(takes);
  await app.review();

  // The settings control is offered in the review, in the corner of the preview, and
  // opens the app's own popover — the annotation inspector's shape, one level up.
  await expect(page.locator('#props-btn')).toBeVisible();
  await page.locator('#props-btn').click();
  await expect(page.locator('#clip-prop-menu')).toHaveClass(/on/);

  // The switch is the three things the card draws, and then their switch: it sits below
  // them all, so a person reads what it will add before asking for it.
  const ids = await page.locator('#clip-prop-menu .prop-row').evaluateAll(rows =>
    rows.map(row => (row as HTMLElement).dataset.id));
  expect(ids).toEqual(['title', 'description', 'logo', 'addToExport', 'annotationColour', 'soundBoost', 'size', 'exportResolution']);

  // With nothing on the card, the switch is drawn disabled — and it says why, so a person
  // reads what to do rather than guessing at the grey. The fields beside it are never
  // disabled: they are what the switch is waiting for.
  const card = page.locator('#clip-prop-menu .prop-row[data-id="addToExport"] input.prop-check');
  const hint = page.locator('#clip-prop-menu .prop-row[data-id="addToExport"] .prop-hint');
  await expect(card).toBeDisabled();
  await expect(hint).toHaveText('Add to export needs something to put on the card — a title, a description or a logo');
  await expect(page.locator('#clip-prop-menu .prop-row[data-id="title"] input')).toBeEnabled();
  await expect(page.locator('#clip-prop-menu .prop-row[data-id="logo"] select')).toBeEnabled();
  // The sound boost is a switch of its own and is never blocked: it needs nothing on the card.
  await expect(page.locator('#clip-prop-menu .prop-row[data-id="soundBoost"] input.prop-check')).toBeEnabled();

  // A title is enough, and the reason goes as the switch comes to life.
  await page.locator('#clip-prop-menu .prop-row[data-id="title"] input').fill('A short demo');
  await page.locator('#clip-prop-menu .prop-row[data-id="title"] input').press('Enter');
  await expect(card).toBeEnabled();
  await expect(hint).toBeHidden();

  await page.locator('#clip-prop-menu textarea').fill('What the clip shows');
  await page.locator('#props-btn').click();
  await expect(page.locator('#clip-prop-menu')).not.toHaveClass(/on/);
  await expect.poll(() => properties(page)).toEqual({ title: 'A short demo', description: 'What the clip shows' });

  // It is kept with the clip — the write is debounced, so wait for the store — and a
  // reload comes back to it, with the panel showing it.
  await expect.poll(() => stored(page)).toEqual({ title: 'A short demo', description: 'What the clip shows' });
  await page.reload();
  await expect.poll(() => properties(page)).toEqual({ title: 'A short demo', description: 'What the clip shows' });
  await page.locator('#props-btn').click();
  await expect(page.locator('#clip-prop-menu .prop-row[data-id="title"] input')).toHaveValue('A short demo');
  await expect(page.locator('#clip-prop-menu textarea')).toHaveValue('What the clip shows');

  // The header's one undo, which takes back whatever was last done — and says what it was.
  await page.locator('#clip-prop-menu .prop-row[data-id="title"] input').fill('A longer demo');
  await page.locator('#props-btn').click();
  await expect(page.locator('#cut-undo')).toBeVisible();
  await expect(page.locator('#t-cut')).toHaveText('TITLE');
  await page.locator('#cut-undo').click();
  await expect.poll(() => properties(page)).toEqual({ title: 'A short demo', description: 'What the clip shows' });
});

// ── On a phone, where a field's keyboard takes the viewport ─────────────────────

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('the panel stays open and usable when the keyboard takes the viewport', async ({ page }) => {
    const app = boot(page);
    await app.goto();
    const takes = await makeTakes(page, { width: 1280, height: 720, seconds: 2 });
    await app.seed(takes);
    await app.review();

    // A press opens the panel.
    await page.locator('#props-btn').tap();
    const menu = page.locator('#clip-prop-menu');
    const title = menu.locator('.prop-row[data-id="title"] input');
    await expect(menu).toHaveClass(/on/);

    // The keyboard shrinks the visible viewport — the change that used to close the
    // panel and leave the person with a keyboard and nothing to type into.
    await page.setViewportSize({ width: 390, height: 400 });
    // Let the browser deliver the resize before asking, so the assertion sees what the
    // person would rather than the moment before the app has answered it. And let the panel's
    // own slide finish: it is measured where it rests, not while it is still moving.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(menu).toHaveClass(/on/);
    await expect(menu).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');

    // The fields are the person's to choose: a focus on opening would summon the
    // keyboard over the panel before it had been read.
    await expect(title).not.toBeFocused();

    // It sits inside what can be seen…
    const box = await menu.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(8);
    expect(box!.y + box!.height).toBeLessThanOrEqual(392.5);

    // …and the person can still type a field and have the edit land on the clip.
    await title.tap();
    await title.fill('A short demo');
    await title.blur();
    await expect.poll(() => properties(page)).toEqual({ title: 'A short demo' });
    await expect(menu).toHaveClass(/on/);
  });
});

// A 1×1 PNG: enough for the image kind to decode and place.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** The picked annotation's duration, in seconds of the clip, from the app's own model. */
const durationOf = (page: Page): Promise<number> =>
  page.evaluate(async url => {
    const { session } = await import(/* @vite-ignore */ url);
    const one = session.clip.annotations.all[0];
    return one ? one.span.length * session.clip.total() : 0;
  }, HOOKS);

/** The played time on the joined clip, in seconds — where the playhead holds. */
const playerTime = (page: Page): Promise<number> =>
  page.evaluate(async url => {
    const { player } = await import(/* @vite-ignore */ url);
    return player.time();
  }, HOOKS);

/** Wait until the playhead has stopped moving — a seek in flight would move it under a click. */
async function settled(page: Page): Promise<void> {
  await expect.poll(async () => {
    const before = await playerTime(page);
    await page.waitForTimeout(150);
    const after = await playerTime(page);
    return Math.abs(before - after) < 0.05;
  }, { timeout: 5_000 }).toBe(true);
}

/** Click the timeline until the playhead settles near `seconds` — a click that lands before
 *  the take is ready is the machine's, not a change in what the app does. */
async function parkAt(page: Page, seconds: number): Promise<void> {
  const strip = (await page.locator('#thumbs').boundingBox())!;
  const y = strip.y + strip.height / 2;
  const fraction = seconds / 10;
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.mouse.click(strip.x + strip.width * fraction, y);
    try {
      await expect.poll(() => playerTime(page), { timeout: 3_000 }).toBeCloseTo(seconds, 0);
      return;
    } catch { /* the click landed before the take was ready; ask again */ }
  }
  expect(await playerTime(page)).toBeCloseTo(seconds, 0);
}

test('a picked annotation’s duration is a seconds value in its preferences, kept by the one undo', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  const takes = await makeTakes(page, { width: 1280, height: 720, seconds: 10 });
  await app.seed(takes);
  await app.review();

  // An arrow placed with nothing selected starts at the default two seconds. The playhead is
  // put a third of the way in and left to settle, so the annotation's own moment is known.
  await settled(page);
  await parkAt(page, 3);
  await settled(page);

  await page.locator('#annotate-bar .annotate-row[data-kind="arrow"]').click();
  const preview = (await page.locator('#preview').boundingBox())!;
  await page.mouse.move(preview.x + preview.width * 0.3, preview.y + preview.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(preview.x + preview.width * 0.7, preview.y + preview.height * 0.7, { steps: 8 });
  await page.mouse.up();
  await settled(page);

  // Its settings control opens the properties, with the shared duration row.
  await openSettings(page, preview);
  const row = page.locator('#prop-menu .prop-row[data-id="duration"]');
  await expect(row).toBeVisible();
  const readout = row.locator('.prop-duration-text');
  await expect(readout).toHaveText('2.00s');

  // Stepping up lengthens the annotation; the one undo takes that last step back.
  await row.locator('.prop-step[aria-label="Longer"]').click();
  await expect(readout).toHaveText('2.10s');
  expect(await durationOf(page)).toBeCloseTo(2.1, 1);

  await page.locator('#cut-undo').click();
  await expect(readout).toHaveText('2.00s');
  expect(await durationOf(page)).toBeCloseTo(2, 1);

  // The image declared no property of its own but now offers the duration, so it too has a
  // settings control and a panel — the shared descriptor, proved on the kind that had none.
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#annotate-bar .annotate-row[data-kind="image"]').click();
  await (await chooser).setFiles({ name: 'dot.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.locator('#tl-annots > *')).toHaveCount(2);   // the image is placed and picked
  await settled(page);
  await openSettings(page, preview);
  await expect(page.locator('#prop-menu .prop-row[data-id="duration"]')).toBeVisible();
});
