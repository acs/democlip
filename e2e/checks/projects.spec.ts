// Projects, in a real browser.
//
// The rules live in node (`src/domain/project/*.test.ts`, `src/application/projects.test.ts`,
// `src/application/recordings.test.ts`). What a person must be able to see — an update that
// keeps the recording they had, a project that gathers recordings, the overview's counts, a
// reload that comes back to them, and a removal that moves a recording to Default without
// destroying it — is here. The agent's path is the second check.

import { expect, test, type Page } from '@playwright/test';
import { boot } from '../helpers/app.js';
import { makeTakes } from '../fixtures/takes.js';
import { pageModule } from '../helpers/page-module.js';

const HOOKS = pageModule('e2e/support/app-hooks.ts');

const DEFAULT_NAME = 'Default';

/** Put a fixture take into the previous version's one-clip stores, and drop the new pointer. */
async function seedLegacyClip(page: Page, title: string): Promise<void> {
  await page.evaluate(async (name) => {
    const store = (window as unknown as { __e2eTakes?: Array<{ blob: Blob; seconds: number }> }).__e2eTakes ?? [];
    const take = store[0];
    if (!take) throw new Error('no fixture take');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const opened = indexedDB.open('democlip', 4);
      opened.onsuccess = () => resolve(opened.result);
      opened.onerror = () => reject(opened.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
        ['app', 'recordingMeta', 'recordingTakes', 'recordingImages', 'meta', 'takes'],
        'readwrite',
      );
      tx.objectStore('app').clear();
      tx.objectStore('recordingMeta').clear();
      tx.objectStore('recordingTakes').clear();
      tx.objectStore('recordingImages').clear();
      tx.objectStore('meta').put({
        version: 1,
        count: 1,
        cuts: [{ s: 0.1, e: 0.2 }],
        annotations: [],
        properties: { title: name },
        watermark: [],
        audio: false,
      }, 'current');
      tx.objectStore('takes').put({
        blob: take.blob,
        duration: take.seconds,
        picture: { width: 320, height: 180 },
        hasAudio: false,
      }, 0);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }, title);
}

async function openProjectMenu(page: Page): Promise<void> {
  await page.locator('#project-btn').click();
  await expect(page.locator('#project-menu')).toHaveClass(/on/);
}

async function openOverview(page: Page, projectName: string): Promise<void> {
  await openProjectMenu(page);
  const row = page.locator('#project-menu .project-row', { hasText: projectName });
  await row.locator('.profile-ico[data-act="overview"]').click();
  await expect(page.locator('#project-ov-bd')).toHaveClass(/on/);
}

async function createProject(page: Page, name: string, motivation: string, objectives: string): Promise<void> {
  await openProjectMenu(page);
  await page.locator('#project-menu .profile-new-btn').click();
  await expect(page.locator('#project-def-bd')).toHaveClass(/on/);
  const fields = page.locator('#project-def-rows .pdef-input');
  await fields.nth(0).fill(name);
  await fields.nth(1).fill(motivation);
  await fields.nth(2).fill(objectives);
  await page.locator('#project-def-done').click();
  await expect(page.locator('#project-def-bd')).not.toHaveClass(/on/);
  await expect(page.locator('#project-initials')).toHaveText(name.slice(0, 3));
}

test('an update keeps the recording, a project gathers new ones, and a removal moves one to Default', async ({ page }) => {
  const app = boot(page);
  await app.goto();

  // Both toolbar pills carry an icon and the colour of the entry they open, so the two
  // are told apart before either is pressed.
  await expect(page.locator('#project-btn .pill-ico')).toBeVisible();
  await expect(page.locator('#profile-btn .pill-ico')).toBeVisible();
  await expect(page.locator('#project-btn')).toHaveClass(/wears-colour/);
  await expect(page.locator('#profile-btn')).toHaveClass(/wears-colour/);

  // The previous version's clip: a real take, a title, and the old stores.
  await makeTakes(page, { width: 320, height: 180, seconds: 2 });
  await seedLegacyClip(page, 'Kept');
  await page.reload();
  await expect(page.locator('#s-text')).toHaveText('Ready');

  // The cut came back with it: two seconds of recording, a fifth of it removed.
  const kept = await page.evaluate(async (url) => {
    const { session } = await import(/* @vite-ignore */ url);
    return (session as { clip: { keptLength(): number } }).clip.keptLength();
  }, HOOKS);
  expect(kept).toBeCloseTo(1.8, 5);

  // It is in Default, and it is the session that came back — in progress, not lost.
  await openOverview(page, DEFAULT_NAME);
  await expect(page.locator('#project-ov-progress')).toHaveText('0 of 1 finished');
  await expect(page.locator('.proj-row-title')).toHaveText(['Kept']);
  await page.locator('#project-ov-close').click();

  // End its session: the recording is finished, and the next draft is in the same project.
  await page.locator('#btn-new').click();
  await expect.poll(() => app.clipLength()).toBe(0);
  await expect(page.locator('#s-text')).toHaveText('Ready');

  await createProject(page, 'Launch', 'The launch needs one video.', 'Explain the feature');
  await expect(page.locator('#project-initials')).toHaveText('Lau');

  // A recording made in it belongs to it.
  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 2 });
  await app.add(takes);
  await app.review();
  await page.locator('#btn-new').click();
  await expect.poll(() => app.clipLength()).toBe(0);
  await expect(page.locator('#s-text')).toHaveText('Ready');

  await openOverview(page, 'Launch');
  await expect(page.locator('#project-ov-desc')).toContainText('The launch needs one video.');
  await expect(page.locator('#project-ov-desc')).toContainText('Explain the feature');
  await expect(page.locator('#project-ov-progress')).toHaveText('1 of 1 finished');
  await expect(page.locator('#project-ov-stamp')).toHaveText('Every recording in this project is finished.');
  await page.locator('#project-ov-close').click();

  // A reload comes back to the project, and the recording is still there, finished.
  await page.reload();
  await expect(page.locator('#s-text')).toHaveText('Ready');
  await expect(page.locator('#project-initials')).toHaveText('Lau');
  await openOverview(page, 'Launch');
  await expect(page.locator('#project-ov-progress')).toHaveText('1 of 1 finished');

  // Remove it: it leaves Launch, and Default keeps it whole.
  await page.locator('.proj-row').first().locator('.proj-btn', { hasText: 'Remove' }).click();
  await expect(page.locator('#project-ov-progress')).toHaveText('No recordings yet.');
  await page.locator('#project-ov-close').click();

  await openOverview(page, DEFAULT_NAME);
  await expect(page.locator('.proj-row-title')).toHaveCount(2);
  await expect(page.locator('.proj-row-title', { hasText: 'Kept' })).toHaveCount(1);
  // The removed one has no title, so its fallback starts with the project it now lives in.
  const removed = page.locator('.proj-row').filter({ hasNotText: 'Kept' });
  page.once('dialog', dialog => dialog.accept());
  await removed.locator('.proj-btn', { hasText: 'Delete' }).click();
  await expect(page.locator('.proj-row-title')).toHaveText(['Kept']);
});interface SurfaceWindow {
  democlip?: Record<string, unknown>;
}

/** Reach the automation surface in the page and call one of its operations. */
async function call<T>(page: Page, path: string, ...args: unknown[]): Promise<T> {
  return page.evaluate(
    ({ path, args }) => {
      const surface = (globalThis as unknown as SurfaceWindow).democlip;
      if (!surface) throw new Error('the page has no automation surface');
      const parts = path.split('.');
      let owner: unknown = surface;
      for (const part of parts.slice(0, -1)) owner = (owner as Record<string, unknown> | undefined)?.[part];
      const value = (owner as Record<string, unknown> | undefined)?.[parts[parts.length - 1]];
      if (typeof value !== 'function') throw new Error(`the app offers no ${path}`);
      return (value as (...a: unknown[]) => unknown).apply(owner, args) as unknown;
    },
    { path, args },
  ) as Promise<T>;
}

test('the agent organises projects, and the person’s window follows', async ({ page }) => {
  const app = boot(page);
  await app.gotoAgent();

  const created = await call<{ ok: boolean; id: string; current: boolean }>(page, 'projects.create', {
    name: 'Agent launch',
    motivation: 'From the chat',
    objectives: 'Show the feature',
  });
  expect(created.ok).toBe(true);
  expect(created.current).toBe(true);
  // The person's pill follows without a reload.
  await expect(page.locator('#project-initials')).toHaveText('Age');

  // A recording made while it is current belongs to it.
  const takes = await makeTakes(page, { width: 320, height: 180, seconds: 1 });
  await app.add(takes);
  await app.review();
  await page.locator('#btn-new').click();
  await expect.poll(() => app.clipLength()).toBe(0);
  await expect(page.locator('#s-text')).toHaveText('Ready');

  const read = await call<{
    ok: boolean;
    recordings: Array<{ id: string; state: string }>;
    progress: { total: number; finished: number; inProgress: number };
  }>(page, 'projects.read', created.id);
  expect(read.ok).toBe(true);
  expect(read.recordings).toHaveLength(1);
  expect(read.recordings[0]!.state).toBe('finished');
  expect(read.progress).toEqual({ total: 1, finished: 1, inProgress: 0 });

  // Move it to Default: removing it from the project, still whole.
  const moved = await call<{ ok: boolean }>(page, 'projects.move', read.recordings[0]!.id, 'default');
  expect(moved.ok).toBe(true);

  await openOverview(page, 'Agent launch');
  await expect(page.locator('#project-ov-progress')).toHaveText('No recordings yet.');
  await page.locator('#project-ov-close').click();
  await openOverview(page, DEFAULT_NAME);
  await expect(page.locator('.proj-row-title')).toHaveCount(1);

  // The surface has no deletion and no project removal: the tool list is the boundary.
  const keys = await page.evaluate(() => {
    const projects = (globalThis as unknown as SurfaceWindow).democlip?.projects as Record<string, unknown> | undefined;
    return projects ? Object.keys(projects) : [];
  });
  expect(keys).not.toContain('delete');
  expect(keys).not.toContain('remove');
});