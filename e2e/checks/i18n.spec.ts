// The language the app is shown in, proved in a real browser.
//
// The mechanism is proved in node (`src/ui/i18n/`); this proves what a person sees. A
// browser context whose preferred language is Spanish is opened with Playwright's own
// `locale` option — it sets both `Accept-Language` and `navigator.language`, which is
// exactly what the app reads — and the visible strings are asserted. An English context is
// asserted unchanged, and an unsupported one falls back to English.

import { test, expect } from '@playwright/test';
import { boot } from '../helpers/app.js';
import { makeTakes } from '../fixtures/takes.js';

test.describe('a Spanish browser', () => {
  test.use({ locale: 'es' });

  test('sees the shell, the help panel, the annotate bar and the guide in Spanish', async ({ page }) => {
    const app = boot(page);
    await app.goto();
    await expect(page.locator('#screen-btn .src-lbl')).toHaveText('Pantalla');
    await expect(page.locator('#file-btn .act-lbl')).toHaveText('Importar');
    await expect(page.locator('#props-btn .clip-props-lbl')).toHaveText('CLIP');
    await expect(page.locator('#rec-lbl')).toHaveText('Grabar');
    await expect(page.locator('#tl-label')).toHaveText('Línea de tiempo');

    await page.locator('#help-btn').click();
    await expect(page.locator('.help-title')).toHaveText('Cómo se usa');
    await expect(page.locator('.help-step-title').first()).toHaveText('Elige qué grabar');
    await expect(page.locator('.help-more')).toHaveText('Leer la guía completa →');
    await page.locator('#help-close').click();

    const takes = await makeTakes(page, { width: 640, height: 360, seconds: 2 });
    await app.seed(takes);
    await app.review();
    await expect(page.locator('.annotate-row[data-kind="arrow"] .annotate-lbl')).toHaveText('Flecha');
    await page.locator('#props-btn').click();
    await expect(page.locator('#clip-prop-menu .prop-row[data-id="title"] .prop-name')).toHaveText('Título');

    await page.goto('/help.html');
    await expect(page.locator('.guide-title')).toHaveText('Cómo se usa');
    await expect(page.locator('.guide-section h2').first()).toHaveText('1. Elige qué grabar');
    await expect(page).toHaveTitle('DemoClip — Cómo se usa');
  });
});

test.describe('an English browser', () => {
  test.use({ locale: 'en-GB' });

  test('sees the app unchanged', async ({ page }) => {
    const app = boot(page);
    await app.goto();
    await expect(page.locator('#screen-btn .src-lbl')).toHaveText('Screen');
    await expect(page.locator('#file-btn .act-lbl')).toHaveText('Import');
  });
});

test.describe('a browser in a language the app does not speak', () => {
  test.use({ locale: 'ja' });

  test('falls back to English, with no key and no blank', async ({ page }) => {
    const app = boot(page);
    await app.goto();
    await expect(page.locator('#screen-btn .src-lbl')).toHaveText('Screen');
    await expect(page.locator('#file-btn .act-lbl')).toHaveText('Import');
    await expect(page.locator('#props-btn .clip-props-lbl')).toHaveText('CLIP');
  });
});
