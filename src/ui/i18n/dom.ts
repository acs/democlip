// The pass over the static pages.
//
// The app's shell and the guide are static HTML, shown before the entry module runs, so a
// sentence cannot be written into them at runtime the way a module builds a widget. Instead
// each translatable element names its sentence with an attribute and keeps its English text
// as the pre-paint content; this pass fills every marked element from the active catalogue
// at startup. It is the one place the markup meets the catalogue.
//
// The attributes are the markup contract: `data-i18n` for the text, `data-i18n-html` for a
// sentence that carries first-party markup (the guide's `<strong>` emphasis), and
// `data-i18n-<attr>` for an attribute (`aria-label`, `title`, `placeholder`).

import { t, type TranslationKey } from './index.js';

const MARKED = '[data-i18n],[data-i18n-html],[data-i18n-aria-label],[data-i18n-title],[data-i18n-placeholder]';

/** Fill every marked element under `root` (the whole document by default) from the active
 *  catalogue. Idempotent, synchronous, and it leaves an unmarked element alone. */
export function applyTranslations(root: ParentNode = document): void {
  for (const el of root.querySelectorAll(MARKED)) {
    const text = el.getAttribute('data-i18n');
    if (text) el.textContent = t(text as TranslationKey);
    const html = el.getAttribute('data-i18n-html');
    if (html) el.innerHTML = t(html as TranslationKey);
    const aria = el.getAttribute('data-i18n-aria-label');
    if (aria) el.setAttribute('aria-label', t(aria as TranslationKey));
    const title = el.getAttribute('data-i18n-title');
    if (title) el.setAttribute('title', t(title as TranslationKey));
    const placeholder = el.getAttribute('data-i18n-placeholder');
    if (placeholder) el.setAttribute('placeholder', t(placeholder as TranslationKey));
  }
}
