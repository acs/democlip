// Configuration profiles, in a real browser.
//
// The rules live in node (`src/domain/profile/*.test.ts`, `src/application/profiles.test.ts`,
// `src/ui/profile/seed.test.ts`). What a person must be able to see — the icon at the
// right-most end of the toolbar, the menu, a profile created and chosen, a clip seeded, the
// refusal once the session has begun to capture, and the profiles coming back after a
// reload — is here.

import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { boot } from '../helpers/app.js';
import { makeTakes } from '../fixtures/takes.js';

const KEY = 'democlip_profiles';

/** A written book, as the app's own store would hold it. */
const A_BOOK = {
  version: 1,
  activeId: 'tv',
  profiles: [
    { id: 'default', name: 'Default', values: {} },
    { id: 'tv', name: 'DemoClipTV', values: { addToExport: 'true' } },
  ],
};

const writeBook = (page: Page, state: unknown): Promise<void> =>
  page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [KEY, state]);

const readBook = (page: Page): Promise<{ activeId: string } | null> =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), KEY);

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

// ── User Story 1: a new clip already carries the profile's settings ──────────────

test('a profile gives a new clip its Add to export, and the export takes the card', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  await writeBook(page, A_BOOK);
  await page.reload();
  await expect(page.locator('#s-text')).toHaveText('Ready');

  // A clip is started under DemoClipTV: the setting is already on, before any take.
  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.add(takes);
  await app.review();

  await page.locator('#props-btn').click();
  await expect(page.locator('#clip-prop-menu input.prop-check')).toBeChecked();
  await page.locator('#props-btn').click();

  // And the export opens with the title card: 1 s of clip, and a 2 s card at its head.
  const bytes = await exportFile(page, '#exp-webm');
  expect(await durationOf(page, bytes, 'video/webm')).toBeGreaterThan(2.5);
});

test('the clip keeps its own value: turning it off does not change the profile', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  await writeBook(page, A_BOOK);
  await page.reload();
  await expect(page.locator('#s-text')).toHaveText('Ready');

  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.add(takes);
  await app.review();

  await page.locator('#props-btn').click();
  await page.locator('#clip-prop-menu input.prop-check').uncheck();
  await page.locator('#props-btn').click();
  await expect(page.locator('#clip-prop-menu input.prop-check')).not.toBeChecked();

  // The profile is unmoved, and the next session under it starts on again.
  expect((await readBook(page))?.activeId).toBe('tv');
  await page.locator('#btn-new').click();
  await page.locator('#profile-btn').click();
  await expect(page.locator('.profile-row.active .profile-setting input')).toBeChecked();
});

// ── User Story 2: choose a profile, or make a new one, from the toolbar ──────────

test('the icon is right-most, and a profile is created, set up and chosen', async ({ page }) => {
  const app = boot(page);
  await app.goto();

  // The toolbar's right-most control.
  const last = await page.evaluate(() => document.querySelector('.hdr-actions')?.lastElementChild?.id);
  expect(last).toBe('profile-btn');

  await page.locator('#profile-btn').click();
  await expect(page.locator('#profile-menu')).toHaveClass(/on/);
  await expect(page.locator('.profile-row')).toHaveCount(1);
  await expect(page.locator('.profile-row.active')).toHaveAttribute('data-id', 'default');

  // Create one, turn its Add to export on, and choose it.
  await page.locator('.profile-new-input').fill('DemoClipTV');
  await page.locator('.profile-new-add').click();
  const row = page.locator('.profile-row:not([data-id="default"])');
  await expect(row).toHaveCount(1);
  await row.locator('.profile-setting input').check();
  await row.locator('.profile-pick').click();
  await expect(page.locator('#profile-menu')).not.toHaveClass(/on/);

  // It is the active one, with its setting, and a new clip carries it.
  await page.locator('#profile-btn').click();
  await expect(page.locator('.profile-row.active .profile-pick-name')).toHaveText('DemoClipTV');
  await expect(page.locator('.profile-row.active .profile-setting input')).toBeChecked();
  await page.locator('#profile-btn').click();

  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.add(takes);
  await app.review();
  await page.locator('#props-btn').click();
  await expect(page.locator('#clip-prop-menu input.prop-check')).toBeChecked();
});

test('a profile cannot be chosen once the session has begun to capture', async ({ page }) => {
  const app = boot(page);
  await app.goto();

  // A profile to switch to, made while nothing has been captured.
  await page.locator('#profile-btn').click();
  await page.locator('.profile-new-input').fill('DemoClipTV');
  await page.locator('.profile-new-add').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#profile-menu')).not.toHaveClass(/on/);

  // A take in the session: capture has begun, so the active profile is fixed.
  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.add(takes);
  await app.review();

  await page.locator('#profile-btn').click();
  await expect(page.locator('.profile-row:not(.active) .profile-pick')).toBeDisabled();
  await expect(page.locator('.profile-row.active .profile-pick')).toBeEnabled();
  await expect(page.locator('.profile-lock')).toBeVisible();

  // A new profile may still be created — it just does not become active.
  await page.locator('.profile-new-input').fill('GraditoneTV');
  await page.locator('.profile-new-add').click();
  await expect(page.locator('.profile-row')).toHaveCount(3);
  await expect(page.locator('.profile-row.active')).toHaveAttribute('data-id', 'default');
});

// ── User Story 3: profiles outlive the app and are the person's to keep ──────────

test('profiles come back after a reload, and are the person’s to keep', async ({ page }) => {
  const app = boot(page);
  await app.goto();

  await page.locator('#profile-btn').click();
  await page.locator('.profile-new-input').fill('DemoClipTV');
  await page.locator('.profile-new-add').click();
  await page.locator('.profile-row:not([data-id="default"]) .profile-setting input').check();
  await page.locator('.profile-row:not([data-id="default"]) .profile-pick').click();

  // A reload finds it whole, and still active.
  await page.reload();
  await expect(page.locator('#s-text')).toHaveText('Ready');
  await page.locator('#profile-btn').click();
  await expect(page.locator('.profile-row.active .profile-pick-name')).toHaveText('DemoClipTV');
  await expect(page.locator('.profile-row.active .profile-setting input')).toBeChecked();

  // The built-in default offers no rename and no remove.
  await expect(page.locator('.profile-row[data-id="default"] .profile-act')).toHaveCount(0);

  // Rename the person's own profile.
  await page.locator('.profile-row.active .profile-act', { hasText: 'Rename' }).click();
  await page.locator('.profile-rename-input').fill('GraditoneTV');
  await page.locator('.profile-rename-input').press('Enter');
  await expect(page.locator('.profile-row.active .profile-pick-name')).toHaveText('GraditoneTV');

  // Removing the active one falls back to the built-in default.
  await page.locator('.profile-row.active .profile-act', { hasText: 'Remove' }).click();
  await expect(page.locator('.profile-row.active')).toHaveAttribute('data-id', 'default');
  await expect(page.locator('.profile-row')).toHaveCount(1);
});

test('a first load, with nothing set up, works under the built-in default', async ({ page }) => {
  const app = boot(page);
  await app.goto();

  await page.locator('#profile-btn').click();
  await expect(page.locator('.profile-row')).toHaveCount(1);
  await expect(page.locator('.profile-row.active .profile-pick-name')).toHaveText('Default');
  await page.keyboard.press('Escape');    // close the menu before driving the app

  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.add(takes);
  await app.review();
  await page.locator('#props-btn').click();
  await expect(page.locator('#clip-prop-menu input.prop-check')).not.toBeChecked();
});
