// Pressing a picked annotation's settings control, wherever the layer draws it.
//
// The control is canvas-drawn, so a browser check cannot name a DOM element: this asks
// the app's own layer where it put the control, then presses that point. Two checks use
// it — the properties panel and a magnifier's preferences — so it lives here.

import { type Page } from '@playwright/test';
import { pageModule } from './page-module.js';

const HOOKS = pageModule('e2e/support/app-hooks.ts');

/** Press the picked annotation's settings control, wherever the layer draws it. */
export async function openSettings(
  page: Page,
  preview: { x: number; y: number; width: number; height: number },
): Promise<void> {
  const spot = await page.evaluate(async url => {
    const { session, canvas, settingsControl } = await import(/* @vite-ignore */ url);
    const cv = document.getElementById('preview') as HTMLCanvasElement;
    const annotation = canvas.selectedId ? session.clip.annotations.byId(canvas.selectedId) : null;
    if (!annotation) return null;
    const scale = cv.clientWidth > 0 ? cv.width / cv.clientWidth : 1;
    const s = settingsControl(annotation, cv.width, cv.height, scale);
    return s ? { x: s.x, y: s.y } : null;
  }, HOOKS);
  if (!spot) throw new Error('no settings control on the picked annotation');
  await page.mouse.click(preview.x + preview.width * spot.x, preview.y + preview.height * spot.y);
}