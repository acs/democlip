// The clip's own properties: its title and its description.
//
// The rule lives in node (`src/domain/clip/ClipProperties.test.ts`); what a person must
// be able to see — the panel, the two fields, the values kept with the clip across a
// reload, and the one undo — is here. The publish dialogs read the same values when they
// open; the prefill itself is reasoned rather than booted, because it needs a signed-in
// account this suite has none of.

import { expect, test, type Page } from '@playwright/test';
import { boot } from '../helpers/app.js';
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

test('a clip is given a title and a description, and they come back after a reload', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  const takes = await makeTakes(page, { width: 1280, height: 720, seconds: 2 });
  await app.seed(takes);
  await app.review();

  // The settings control is offered in the review, beside the clip's length, and opens
  // the app's own popover — the annotation inspector's shape, one level up.
  await expect(page.locator('#props-btn')).toBeVisible();
  await page.locator('#props-btn').click();
  await expect(page.locator('#clip-prop-menu')).toHaveClass(/on/);

  await page.locator('#clip-prop-menu input').fill('A short demo');
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
  await expect(page.locator('#clip-prop-menu input')).toHaveValue('A short demo');
  await expect(page.locator('#clip-prop-menu textarea')).toHaveValue('What the clip shows');
});

test('the one undo takes a clip property back', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  const takes = await makeTakes(page, { width: 1280, height: 720, seconds: 2 });
  await app.seed(takes);
  await app.review();

  await page.locator('#props-btn').click();
  await page.locator('#clip-prop-menu input').fill('A short demo');
  await page.locator('#props-btn').click();
  await expect.poll(() => properties(page)).toEqual({ title: 'A short demo' });

  // The header's one undo, which takes back whatever was last done — and says what it was.
  await expect(page.locator('#cut-undo')).toBeVisible();
  await expect(page.locator('#t-cut')).toHaveText('TITLE');
  await page.locator('#cut-undo').click();
  await expect.poll(() => properties(page)).toEqual({});
});

test('an agent sets a clip property, and reads it back, through the surface', async ({ page }) => {
  const app = boot(page);
  await app.gotoAgent();
  const takes = await makeTakes(page, { width: 1280, height: 720, seconds: 2 });
  await app.seed(takes);
  await app.review();

  const set = await page.evaluate(async () => {
    const surface = (globalThis as { democlip?: { edit: { setClipProperty(p: string, v: string): unknown } } }).democlip;
    return surface?.edit.setClipProperty('title', 'Set by an agent');
  });
  expect(set).toEqual({ ok: true, value: 'Set by an agent' });

  const described = await page.evaluate(async () => {
    const surface = (globalThis as { democlip?: { describe(): { properties: Array<{ id: string; value: string }> } } }).democlip;
    return surface?.describe().properties;
  });
  expect(described?.find(property => property.id === 'title')).toMatchObject({ value: 'Set by an agent' });
});
