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
  expect(ids).toEqual(['title', 'description', 'logo', 'addToExport', 'size']);

  // With nothing on the card, the switch is drawn disabled — and it says why, so a person
  // reads what to do rather than guessing at the grey. The fields beside it are never
  // disabled: they are what the switch is waiting for.
  const hint = page.locator('#clip-prop-menu .prop-row[data-id="addToExport"] .prop-hint');
  await expect(page.locator('#clip-prop-menu input.prop-check')).toBeDisabled();
  await expect(hint).toHaveText('Add to export needs something to put on the card — a title, a description or a logo');
  await expect(page.locator('#clip-prop-menu .prop-row[data-id="title"] input')).toBeEnabled();
  await expect(page.locator('#clip-prop-menu .prop-row[data-id="logo"] select')).toBeEnabled();

  // A title is enough, and the reason goes as the switch comes to life.
  await page.locator('#clip-prop-menu .prop-row[data-id="title"] input').fill('A short demo');
  await page.locator('#clip-prop-menu .prop-row[data-id="title"] input').press('Enter');
  await expect(page.locator('#clip-prop-menu input.prop-check')).toBeEnabled();
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
