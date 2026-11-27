// The boot helper: load the real app, wait for it to be ready, seed a clip.
//
// It changes no application code. A check reaches the app through the dev server's
// own module URLs — the same module instances the app loaded — exactly as a browser
// would, so no test hook is added to the app.
//
// The imports go through `e2e/support/app-hooks.ts`. The Vite root is `web/`, so a
// module at the repository root is served at `/@fs/<absolute path>`; the hooks file's
// own relative imports then resolve to the app's modules, so the suite and the app
// share one instance of each.

import { expect, type Page } from '@playwright/test';
import { pageModule } from './page-module.js';
import type { FixtureTake } from '../fixtures/takes.js';

const HOOKS = pageModule('e2e/support/app-hooks.ts');

interface PageWindow {
  __e2eTakes?: Array<{ blob: Blob; seconds: number; shape: string; hasAudio: boolean }>;
}

export interface Booted {
  /** Navigate to "/" and wait until the status chip reads Ready. */
  goto(): Promise<void>;
  /** Navigate with the flag that asks the app to publish its automation surface. */
  gotoAgent(): Promise<void>;
  /** Clear the clip, so no check inherits state. */
  clear(): Promise<void>;
  /** Clear the clip and add the given takes, through the app's own module. */
  seed(takes: FixtureTake[]): Promise<void>;
  /** Add the given takes without clearing, as a recording appends to the clip it is making. */
  add(takes: FixtureTake[]): Promise<void>;
  /** The clip's length in seconds, read from the app's own model. */
  clipLength(): Promise<number>;
  /** Put the app in the review phase and load the first take, so editing is live. */
  review(): Promise<void>;
  /** Put the app in review for a clip with no picture: the waveform stands in for the strip. */
  reviewSoundOnly(): Promise<void>;
}

export function boot(page: Page): Booted {
  // A person-visible signal, not a fixed timeout: the chip says the app is up. The word is
  // the app's own, in whatever language the browser asked for, so both are accepted.
  const ready = async () => expect(page.locator('#s-text')).toHaveText(/^(Ready|Listo)$/);

  return {
    async goto() {
      await page.goto('/');
      await ready();
    },

    async gotoAgent() {
      await page.goto('/?agent=1');
      await ready();
    },

    async clear() {
      await page.evaluate(async (url) => {
        const { session } = await import(/* @vite-ignore */ url);
        session.clip.clear();
      }, HOOKS);
    },

    async seed(takes) {
      await page.evaluate(async ({ url, indices }) => {
        const { session } = await import(/* @vite-ignore */ url);
        session.clip.clear();
        const store = (window as unknown as PageWindow).__e2eTakes ?? [];
        for (const index of indices) {
          const take = store[index];
          if (!take) continue;
          // The take carries its own picture size and sound, as a recorded take does, so
          // the clip sizes itself by it and knows whether it has sound.
          const [width, height] = take.shape.split(/[x×]/).map(Number);
          session.clip.addTake(
            take.blob,
            take.seconds,
            width > 0 && height > 0 ? { width, height } : null,
            take.hasAudio,
          );
        }
      }, { url: HOOKS, indices: takes.map(take => take.index) });
    },

    async add(takes) {
      await page.evaluate(async ({ url, indices }) => {
        const { session } = await import(/* @vite-ignore */ url);
        const store = (window as unknown as PageWindow).__e2eTakes ?? [];
        for (const index of indices) {
          const take = store[index];
          if (!take) continue;
          const [width, height] = take.shape.split(/[x×]/).map(Number);
          session.clip.addTake(
            take.blob,
            take.seconds,
            width > 0 && height > 0 ? { width, height } : null,
            take.hasAudio,
          );
        }
      }, { url: HOOKS, indices: takes.map(take => take.index) });
    },

    async clipLength() {
      return page.evaluate(async (url) => {
        const { session } = await import(/* @vite-ignore */ url);
        return session.clip.total();
      }, HOOKS);
    },

    async review() {
      await page.evaluate(async (url) => {
        const { setPhase, openReview } = await import(/* @vite-ignore */ url);
        setPhase('review');
        await openReview(0, 0);
      }, HOOKS);
      // openReview builds the strip in the background; wait for the first cell.
      await expect(page.locator('#thumbs canvas').first()).toBeVisible();
    },

    async reviewSoundOnly() {
      await page.evaluate(async (url) => {
        const { setPhase, openReview } = await import(/* @vite-ignore */ url);
        setPhase('review');
        await openReview(0, 0);
      }, HOOKS);
      // A sound-only clip has no strip: the review's own annotate options are the signal.
      await expect(page.locator('#annotate-bar')).toHaveClass(/on/);
    },
  };
}
