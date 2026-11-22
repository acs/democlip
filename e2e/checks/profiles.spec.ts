// Configuration profiles, in a real browser.
//
// The rules live in node (`src/domain/profile/*.test.ts`, `src/application/profiles.test.ts`,
// `src/ui/profile/apply.test.ts`, `profile-menu.test.ts`). What a person must be able to see —
// the pill at the right-most end of the toolbar, the selector, a profile's own config sheet,
// an item a profile fixes being applied and **not changeable**, a free item staying the
// person's, and the profiles coming back after a reload — is here.

import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { boot } from '../helpers/app.js';
import { makeTakes } from '../fixtures/takes.js';

const KEY = 'democlip_profiles';

/** A written book whose DemoClipTV profile fixes **Add to export** on. */
const A_BOOK = {
  version: 2,
  activeId: 'tv',
  profiles: [
    { id: 'default', name: 'Default', controls: {} },
    { id: 'tv', name: 'DemoClipTV', controls: { addToExport: 'true' } },
  ],
};

const writeBook = (page: Page, state: unknown): Promise<void> =>
  page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [KEY, state]);

interface Book { activeId: string; profiles: Array<{ name: string; controls: Record<string, string> }> }

const readBook = (page: Page): Promise<Book | null> =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), KEY);

/** Make a profile through the selector, the way a person does. */
async function createProfile(page: Page, name: string): Promise<void> {
  await page.locator('.profile-new-btn').click();
  await page.locator('.profile-new-input').fill(name);
  await page.locator('.profile-new-add').click();
}

/** Fix an item in a profile's own config sheet: the sliders mark, then a choice. */
async function defineIn(page: Page, name: string, item: string, choice: 'free' | 'on' | 'off'): Promise<void> {
  const row = page.locator('.profile-row', { has: page.locator('.profile-name', { hasText: name }) });
  await row.locator('.profile-ico[data-act="define"]').click();
  await expect(page.locator('#profile-def-bd')).toHaveClass(/on/);
  const value = choice === 'free' ? 'free' : choice === 'on' ? 'true' : '';
  await page.locator(`.pdef-row[data-id="${item}"] .pdef-opt[data-value="${value}"]`).click();
  await page.locator('#profile-def-done').click();
  await expect(page.locator('#profile-def-bd')).not.toHaveClass(/on/);
}

/** Pick a target in the Export menu and read the downloaded bytes. */
async function exportFile(page: Page, item: string): Promise<Buffer> {
  await page.locator('#btn-exp').click();
  const download = page.waitForEvent('download');
  await page.locator(item).click();
  const file = await download;
  const path = await file.path();
  if (!path) throw new Error('the export wrote no file');
  return readFile(path);
}

/** Decode the file's metadata in the page and read its duration. */
async function durationOf(page: Page, bytes: Buffer, mime: string): Promise<number> {
  return page.evaluate(async ({ base64, type }) => {
    const binary = atob(base64);
    const data = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i);
    const video = document.createElement('video');
    video.preload = 'metadata';
    const url = URL.createObjectURL(new Blob([data], { type }));
    video.src = url;
    await new Promise<void>(resolve => {
      video.addEventListener('loadedmetadata', () => resolve(), { once: true });
      setTimeout(resolve, 3000);
    });
    const seconds = video.duration;
    URL.revokeObjectURL(url);
    return seconds;
  }, { base64: bytes.toString('base64'), type: mime });
}

// ── A profile's config is applied, and is not the person's to change ─────────────

test('an item a profile controls is applied, and shown as fixed rather than as a switch', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  await writeBook(page, A_BOOK);
  await page.reload();
  await expect(page.locator('#s-text')).toHaveText('Ready');

  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.add(takes);
  await app.review();

  // The value is the profile's, the row says whose it is, and there is no control to change it.
  await page.locator('#props-btn').click();
  await expect(page.locator('#clip-prop-menu .prop-note')).toHaveText('set by DemoClipTV');
  await expect(page.locator('#clip-prop-menu input.prop-check')).toHaveCount(0);
  // And the value reads as what it means, not as the string it is kept as.
  await expect(page.locator('#clip-prop-menu .prop-value').first()).toHaveText('On');
  await page.locator('#props-btn').click();

  // And the export takes the title card: 1 s of clip, and a 2 s card at its head.
  const bytes = await exportFile(page, '#exp-webm');
  expect(await durationOf(page, bytes, 'video/webm')).toBeGreaterThan(2.5);
});

test('an agent is refused a property a profile fixes, with the reason', async ({ page }) => {
  const app = boot(page);
  await app.gotoAgent();
  await writeBook(page, A_BOOK);
  await page.reload();
  await expect(page.locator('#s-text')).toHaveText('Ready');

  const described = await page.evaluate(() => {
    const surface = (globalThis as { democlip?: { describe(): { properties: Array<{ id: string; readOnly: boolean }> } } }).democlip;
    return surface?.describe().properties.find(property => property.id === 'addToExport');
  });
  expect(described?.readOnly).toBe(true);

  const refused = await page.evaluate(() => {
    const surface = (globalThis as { democlip?: { edit: { setClipProperty(p: string, v: string): unknown } } }).democlip;
    return surface?.edit.setClipProperty('addToExport', '');
  });
  expect(refused).toMatchObject({ ok: false });
  expect((refused as { reason: string }).reason).toMatch(/DemoClipTV fixes add to export/);
});

// ── A profile that controls nothing leaves everything the person's ───────────────

test('the built-in default controls nothing, so a property is the person’s as always', async ({ page }) => {
  const app = boot(page);
  await app.goto();

  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.add(takes);
  await app.review();

  await page.locator('#props-btn').click();
  await expect(page.locator('#clip-prop-menu .prop-note')).toHaveCount(0);
  await expect(page.locator('#clip-prop-menu input.prop-check')).not.toBeChecked();
  await page.locator('#clip-prop-menu input.prop-check').check();
  await expect(page.locator('#clip-prop-menu input.prop-check')).toBeChecked();
});

// ── The selector selects; a profile's config is defined in its own sheet ─────────

test('a profile is defined in its own sheet, and the selector shows no config', async ({ page }) => {
  const app = boot(page);
  await app.goto();

  await page.locator('#profile-btn').click();
  await createProfile(page, 'DemoClipTV');
  const row = page.locator('.profile-row:not([data-id="default"])');
  await expect(row).toHaveCount(1);
  // Nothing in the selector defines or shows config.
  await expect(page.locator('#profile-menu .pdef-row')).toHaveCount(0);
  await expect(page.locator('#profile-menu .profile-setting')).toHaveCount(0);

  // Two marks on a profile of the person's own: the sliders, which open it, and the bin. Its
  // **name** is set in the profile's own dialog, so nothing here renames it.
  await expect(row.locator('.profile-ico')).toHaveCount(2);
  await expect(row.locator('.profile-ico[data-act="rename"]')).toHaveCount(0);
  await defineIn(page, 'DemoClipTV', 'addToExport', 'on');

  // Choose it: the clip is made under it and the item is fixed.
  await row.locator('.profile-pick').click();
  await expect(page.locator('#profile-initials')).toHaveText('Dem');

  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.add(takes);
  await app.review();
  await page.locator('#props-btn').click();
  await expect(page.locator('#clip-prop-menu .prop-note')).toHaveText('set by DemoClipTV');
  await expect(page.locator('#clip-prop-menu input.prop-check')).toHaveCount(0);
});

test('a profile can fix a switch off, which is not the same as leaving it free', async ({ page }) => {
  const app = boot(page);
  await app.goto();

  await page.locator('#profile-btn').click();
  await createProfile(page, 'Quiet');
  await defineIn(page, 'Quiet', 'addToExport', 'off');
  await page.locator('.profile-row:not([data-id="default"]) .profile-pick').click();

  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.add(takes);
  await app.review();
  await page.locator('#props-btn').click();
  // Fixed, so no control — even though the value is the same as a free, off item would be.
  await expect(page.locator('#clip-prop-menu .prop-note')).toHaveText('set by Quiet');
  await expect(page.locator('#clip-prop-menu input.prop-check')).toHaveCount(0);
  await expect(page.locator('#clip-prop-menu .prop-value').first()).toHaveText('Off');
});

// ── The choice is fixed once the session has begun to capture ────────────────────

test('a profile cannot be chosen once the session has begun to capture', async ({ page }) => {
  const app = boot(page);
  await app.goto();

  await page.locator('#profile-btn').click();
  await createProfile(page, 'DemoClipTV');
  await page.keyboard.press('Escape');
  await expect(page.locator('#profile-menu')).not.toHaveClass(/on/);

  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.add(takes);
  await app.review();

  await page.locator('#profile-btn').click();
  await expect(page.locator('.profile-row:not(.active) .profile-pick')).toBeDisabled();
  await expect(page.locator('.profile-row.active .profile-pick')).toBeEnabled();
  await expect(page.locator('.profile-lock')).toBeVisible();
});

// ── Profiles outlive the app, and are the person's to keep ───────────────────────

test('a profile and what it controls come back after a reload, and it can be let go', async ({ page }) => {
  const app = boot(page);
  await app.goto();

  await page.locator('#profile-btn').click();
  await createProfile(page, 'DemoClipTV');
  await defineIn(page, 'DemoClipTV', 'addToExport', 'on');
  await page.locator('.profile-row:not([data-id="default"]) .profile-pick').click();

  // A reload finds it whole — the profile, what it controls, and that it is the one in use.
  await page.reload();
  await expect(page.locator('#s-text')).toHaveText('Ready');
  await expect(page.locator('#profile-initials')).toHaveText('Dem');
  const book = await readBook(page);
  expect(book?.activeId).not.toBe('default');
  expect(book?.profiles.find(profile => profile.name === 'DemoClipTV')?.controls).toEqual({ addToExport: 'true' });

  // The built-in default offers no sliders mark and no bin.
  await page.locator('#profile-btn').click();
  await expect(page.locator('.profile-row[data-id="default"] .profile-ico')).toHaveCount(0);

  // Its name is set in its own dialog — the same dialog that holds what it controls — and the
  // list behind it follows.
  await page.locator('.profile-row.active .profile-ico[data-act="define"]').click();
  await expect(page.locator('#profile-def-bd')).toHaveClass(/on/);
  const name = page.locator('.pdef-who input');
  await expect(name).toHaveValue('DemoClipTV');
  await name.fill('GraditoneTV');
  await name.press('Tab');
  await page.locator('#profile-def-done').click();
  await expect(page.locator('#profile-def-bd')).not.toHaveClass(/on/);
  await expect(page.locator('.profile-row.active .profile-name')).toHaveText('GraditoneTV');

  await page.locator('.profile-row.active .profile-ico[data-act="remove"]').click();
  await expect(page.locator('.profile-row.active')).toHaveAttribute('data-id', 'default');
  await expect(page.locator('.profile-row')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('#profile-initials')).toHaveText('Def');
  expect((await readBook(page))?.activeId).toBe('default');

  // And the item is the person's again: the value it fixed is still there, and it moves.
  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.add(takes);
  await app.review();
  await page.locator('#props-btn').click();
  await expect(page.locator('#clip-prop-menu .prop-note')).toHaveCount(0);
  await expect(page.locator('#clip-prop-menu input.prop-check')).toBeChecked();
  await page.locator('#clip-prop-menu input.prop-check').uncheck();
  await expect(page.locator('#clip-prop-menu input.prop-check')).not.toBeChecked();
});

