// Configuration profiles, in a real browser.
//
// The rules live in node (`src/domain/profile/*.test.ts`, `src/application/profiles.test.ts`,
// `src/ui/profile/apply.test.ts`, `profile-menu.test.ts`). What a person must be able to
// see — the pill at the right-most end of the toolbar, the selector, a profile's own config
// sheet, an item a profile fixes being applied and **not changeable**, a free item staying
// the person's, a profile kept across a reload, and a logo a profile fixes **drawn** into
// the encoded file — is here.
//
// The active profile is frozen once the clip holds a take (`profile-flow.ts` `locked()`), so
// a page can only ever show one profile in force: the checks below each start a fresh session
// (`#btn-new`) where the story needs another.

import { expect, test, type Page } from '@playwright/test';
import { boot } from '../helpers/app.js';
import { makeTakes } from '../fixtures/takes.js';
import { exportFile, frameCounts, frameDiff, probeFile } from '../helpers/exports.js';
import { pageModule } from '../helpers/page-module.js';

const HOOKS = pageModule('e2e/support/app-hooks.ts');

const KEY = 'democlip_profiles';

/**
 * The band of the card the logo is drawn in: the top of the picture, above the words. The box
 * itself is `LOGO_BOX` in `src/ui/exporting/intro-text.ts`, inside this band — the check is that
 * the mark is drawn at the head of the card, not that it lands on a particular pixel.
 */
const LOGO_BAND = { x: 0.2, y: 0.03, width: 0.6, height: 0.3 };

/** The band the watermark is drawn in: the top-right corner of the picture. */
const WATERMARK_BAND = { x: 0.78, y: 0, width: 0.22, height: 0.25 };

/** A written book whose DemoClipTV profile fixes the given items. */
const book = (controls: Record<string, string>) => ({
  version: 2,
  activeId: 'tv',
  profiles: [
    { id: 'default', name: 'Default', controls: {} },
    { id: 'tv', name: 'DemoClipTV', controls },
  ],
});

interface Book { activeId: string; profiles: Array<{ name: string; controls: Record<string, string> }> }

const writeBook = (page: Page, state: unknown): Promise<void> =>
  page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [KEY, state]);

const readBook = (page: Page): Promise<Book | null> =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), KEY);

/** Make a profile through the selector, the way a person does. Leaves the selector open. */
async function createProfile(page: Page, name: string): Promise<void> {
  await page.locator('.profile-new-btn').click();
  await page.locator('.profile-new-input').fill(name);
  await page.locator('.profile-new-add').click();
}

/** Fix an item in a profile's own config sheet: the pencil mark, then a choice. */
async function defineIn(page: Page, name: string, item: string, choice: 'free' | 'on' | 'off'): Promise<void> {
  const row = page.locator('.profile-row', { has: page.locator('.profile-name', { hasText: name }) });
  await row.locator('.profile-ico[data-act="define"]').click();
  await expect(page.locator('#profile-def-bd')).toHaveClass(/on/);
  const value = choice === 'free' ? 'free' : choice === 'on' ? 'true' : '';
  await page.locator(`.pdef-row[data-id="${item}"] .pdef-opt[data-value="${value}"]`).click();
  await page.locator('#profile-def-done').click();
  await expect(page.locator('#profile-def-bd')).not.toHaveClass(/on/);
}

/** Set the clip's own logo, and wait for the watermark to follow it — present when the app serves the mark, absent when it does not. */
async function setLogo(page: Page, name: string, wears = true): Promise<void> {
  await page.evaluate(async ([url, value]) => {
    const { session } = await import(/* @vite-ignore */ url);
    session.clip.setProperty('logo', value as string);
  }, [HOOKS, name] as [string, string]);
  await expect.poll(async () => page.evaluate(async url => {
    const { session } = await import(/* @vite-ignore */ url);
    return session.clip.watermarks().some((one: { kind: string }) => one.kind === 'image');
  }, HOOKS)).toBe(wears);
}

// ── An item a profile fixes is applied and is not the person's to change ─────────────

test('an item a profile fixes is applied and locked — on or off — and refused to an agent', async ({ page }) => {
  const app = boot(page);
  await app.gotoAgent();
  await writeBook(page, book({ addToExport: 'true' }));
  await page.reload();
  await expect(page.locator('#s-text')).toHaveText('Ready');

  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.add(takes);
  await app.review();

  // The value is the profile's, the row wears a lock whose tooltip says whose it is, and
  // there is no control to change it. The value reads as what it means, not as the string
  // it is kept as.
  await page.locator('#props-btn').click();
  await expect(page.locator('#clip-prop-menu .prop-lock')).toHaveAttribute('title', 'Set by DemoClipTV');
  await expect(page.locator('#clip-prop-menu input.prop-check')).toHaveCount(0);
  await expect(page.locator('#clip-prop-menu .prop-value').first()).toHaveText('On');
  await page.locator('#props-btn').click();

  // And the export takes the card the profile fixed on: 1 s of clip, and a 2 s card at its head.
  const bytes = await exportFile(page, '#exp-webm');
  expect((await probeFile(page, bytes, 'video/webm')).duration).toBeGreaterThan(2.5);

  // An agent reads it as fixed, and is refused it with the reason.
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

  // A fresh session: the same profile fixing a switch **off** is a fixed off, not the
  // person's to move — the value it holds, and the lock that says so.
  await page.locator('#btn-new').click();
  await expect(page.locator('#btn-new')).toBeHidden();
  await writeBook(page, book({ addToExport: '' }));
  await page.reload();
  await expect(page.locator('#s-text')).toHaveText('Ready');
  const second = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.add(second);
  await app.review();
  await page.locator('#props-btn').click();
  await expect(page.locator('#clip-prop-menu .prop-lock')).toHaveAttribute('title', 'Set by DemoClipTV');
  await expect(page.locator('#clip-prop-menu input.prop-check')).toHaveCount(0);
  await expect(page.locator('#clip-prop-menu .prop-value').first()).toHaveText('Off');
});

// ── The selector, the config sheet, and the book outliving the app ───────────────────

test('a profile is made in the selector, defined in its own sheet, chosen, kept and let go', async ({ page }) => {
  const app = boot(page);
  await app.goto();

  await page.locator('#profile-btn').click();
  await createProfile(page, 'DemoClipTV');
  const row = page.locator('.profile-row:not([data-id="default"])');
  await expect(row).toHaveCount(1);
  // Nothing in the selector defines or shows config.
  await expect(page.locator('#profile-menu .pdef-row')).toHaveCount(0);
  await expect(page.locator('#profile-menu .profile-setting')).toHaveCount(0);
  // Two marks on a profile of the person's own: the pencil, which opens it, and the bin. Its
  // **name** is set in the profile's own dialog, so nothing here renames it.
  await expect(row.locator('.profile-ico')).toHaveCount(2);
  await expect(row.locator('.profile-ico[data-act="rename"]')).toHaveCount(0);
  await defineIn(page, 'DemoClipTV', 'addToExport', 'on');

  // Choose it: the clip is made under it.
  await row.locator('.profile-pick').click();
  await expect(page.locator('#profile-initials')).toHaveText('Dem');

  // A reload finds it whole — the profile, what it controls, and that it is the one in use.
  await page.reload();
  await expect(page.locator('#s-text')).toHaveText('Ready');
  await expect(page.locator('#profile-initials')).toHaveText('Dem');
  const saved = await readBook(page);
  expect(saved?.activeId).not.toBe('default');
  expect(saved?.profiles.find(profile => profile.name === 'DemoClipTV')?.controls).toEqual({ addToExport: 'true' });

  // The built-in default offers no pencil mark and no bin.
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

  // Let it go: the active profile becomes the default.
  await page.locator('.profile-row.active .profile-ico[data-act="remove"]').click();
  await expect(page.locator('.profile-row.active')).toHaveAttribute('data-id', 'default');
  await expect(page.locator('.profile-row')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('#profile-initials')).toHaveText('Def');
  expect((await readBook(page))?.activeId).toBe('default');

  // The item is the person's again: the value the profile left is still there and it moves.
  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.add(takes);
  await app.review();
  await page.locator('#props-btn').click();
  await expect(page.locator('#clip-prop-menu .prop-lock')).toHaveCount(0);
  await expect(page.locator('#clip-prop-menu input.prop-check')).toBeChecked();
  await page.locator('#clip-prop-menu input.prop-check').uncheck();
  await expect(page.locator('#clip-prop-menu input.prop-check')).not.toBeChecked();
  // With nothing on the card the switch is disabled — a title is what it is waiting for.
  await expect(page.locator('#clip-prop-menu input.prop-check')).toBeDisabled();
  await page.locator('#clip-prop-menu .prop-row[data-id="title"] input').fill('A short demo');
  await page.locator('#clip-prop-menu .prop-row[data-id="title"] input').press('Enter');
  await expect(page.locator('#clip-prop-menu input.prop-check')).toBeEnabled();
  await page.locator('#props-btn').click();

  // The choice is fixed once the session has begun to capture: another profile's pick is
  // refused, the active one's stands, and the reason is shown.
  await page.locator('#profile-btn').click();
  await createProfile(page, 'Later');
  await expect(page.locator('.profile-row:not(.active) .profile-pick')).toBeDisabled();
  await expect(page.locator('.profile-row.active .profile-pick')).toBeEnabled();
  await expect(page.locator('.profile-lock')).toBeVisible();
});

// ── A logo a profile fixes is drawn into the file ────────────────────────────────────

test('a logo a profile fixes is drawn on the card, and is not the person’s to change', async ({ page }) => {
  const app = boot(page);
  await app.goto();

  // A logo is defined in the profile's own sheet, and reaches the export from there.
  await page.locator('#profile-btn').click();
  await createProfile(page, 'SheetTV');
  const made = page.locator('.profile-row', { has: page.locator('.profile-name', { hasText: 'SheetTV' }) });
  await made.locator('.profile-ico[data-act="define"]').click();
  await expect(page.locator('#profile-def-bd')).toHaveClass(/on/);
  // A switch is three ways — Free, On, Off — and an item the app has a list for is that list,
  // with **Not fixed** above it, which is where a profile starts.
  await expect(page.locator('.pdef-row[data-id="addToExport"] .pdef-opt')).toHaveCount(3);
  const list = page.locator('.pdef-row[data-id="logo"] select');
  await expect(list.locator('option')).toHaveText(['Not fixed', 'None', 'DemoClip', 'Graditone']);
  await expect(list.locator('option:checked')).toHaveText('Not fixed');
  await list.selectOption('democlip');
  await expect(list.locator('option:checked')).toHaveText('DemoClip');
  await page.locator('#profile-def-done').click();
  await made.locator('.profile-pick').click();

  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.add(takes);
  await app.review();
  const edited = await exportFile(page, '#exp-webm');
  expect((await frameCounts(page, edited, 'video/webm', 0.5, LOGO_BAND)).light).toBeGreaterThan(500);

  // A book that fixes the logo **and** the card, so the mark sits on the card's head: the
  // value shown as the mark is called, the lock naming the profile, and no control.
  await page.locator('#btn-new').click();
  await expect(page.locator('#btn-new')).toBeHidden();
  await writeBook(page, book({ addToExport: 'true', logo: 'democlip' }));
  await page.reload();
  await expect(page.locator('#s-text')).toHaveText('Ready');
  const more = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.add(more);
  await app.review();

  await page.locator('#props-btn').click();
  const row = page.locator('#clip-prop-menu .prop-row[data-id="logo"]');
  await expect(row.locator('.prop-value')).toHaveText('DemoClip');
  await expect(row.locator('.prop-lock')).toHaveAttribute('title', 'Set by DemoClipTV');
  await expect(row.locator('input, select')).toHaveCount(0);
  await page.locator('#props-btn').click();

  // The mark the app ships is drawn where the card puts a logo — over a picture that is
  // itself there, so a blank frame cannot pass for this.
  const box = await frameCounts(page, await exportFile(page, '#exp-webm'), 'video/webm', 0.5, LOGO_BAND);
  expect(box.light).toBeGreaterThan(500);
  expect(box.painted).toBeGreaterThan(5000);

  // A card with no logo puts nothing there: the same card, the same clip, one thing different.
  await page.locator('#btn-new').click();
  await expect(page.locator('#btn-new')).toBeHidden();
  await writeBook(page, book({ addToExport: 'true' }));
  await page.reload();
  await expect(page.locator('#s-text')).toHaveText('Ready');
  const plain = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.add(plain);
  await app.review();
  const bare = await frameCounts(page, await exportFile(page, '#exp-webm'), 'video/webm', 0.5, LOGO_BAND);
  expect(bare.light).toBeLessThan(30);
  expect(bare.painted).toBeGreaterThan(5000);    // the picture is there; only the mark is not
});

// ── The mark itself, and where the app is served from ────────────────────────────────

test('every mark the app ships draws on the card, and a name it does not serve draws nothing', async ({ page }) => {
  const app = boot(page);
  await app.goto();

  // A profile that fixes only the card, so the clip's own logo stays the person's to set.
  await writeBook(page, book({ addToExport: 'true' }));
  await page.reload();
  await expect(page.locator('#s-text')).toHaveText('Ready');
  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.add(takes);
  await app.review();

  // The card with no mark on it: the frame everything below is held against.
  const bare = await exportFile(page, '#exp-webm');

  // Each mark the app lists, drawn — which is also what proves the file behind the name is
  // really served: a name with no picture behind it would leave the band as it was.
  for (const name of ['democlip', 'graditone']) {
    await setLogo(page, name);
    const marked = await exportFile(page, '#exp-webm');
    expect(await frameDiff(page, bare, marked, 'video/webm', 0.5, LOGO_BAND), `${name} is not on the card`)
      .toBeGreaterThan(2000);
  }
  // A name the app does not serve: nothing is drawn, and the export is not held up by it.
  await setLogo(page, 'nope', false);
  expect(await frameDiff(page, bare, await exportFile(page, '#exp-webm'), 'video/webm', 0.5, LOGO_BAND))
    .toBeLessThan(50);

  // And served under a **subpath** — the shape a GitHub Pages project page has — the mark
  // still draws from beside the app, not from the domain root, where the file is not.
  await serveUnderSubpath(page);
  await page.goto('/democlip/');
  await expect(page.locator('#s-text')).toHaveText('Ready');
  const under = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.add(under);
  await app.review();
  const plain = await exportFile(page, '#exp-webm');
  await setLogo(page, 'graditone');
  const marked = await exportFile(page, '#exp-webm');
  expect(await frameDiff(page, plain, marked, 'video/webm', 2.5, WATERMARK_BAND)).toBeGreaterThan(200);
});

/**
 * Serve the app under a subpath, with the **domain root not the app** — the shape a GitHub
 * Pages project page has. A file asked for under the subpath is passed on to the app's own
 * folder; one asked for at the domain root is refused, which is what the deployment does. The
 * dev server mounts the app at the root, so this stands in for the subpath.
 */
async function serveUnderSubpath(page: Page): Promise<void> {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/democlip/logos/')) {
      url.pathname = url.pathname.slice('/democlip'.length);
      return route.continue({ url: url.href });
    }
    if (url.pathname.startsWith('/logos/')) {
      return route.fulfill({ status: 404, body: 'not here' });
    }
    return route.continue();
  });
}
