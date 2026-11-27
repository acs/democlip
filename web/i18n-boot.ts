// Choose the page's language and fill the marked elements, before the app is loaded.
//
// Imported by the page's entry before `src/main.js`, so the shell is in the person's
// language from the first frame and the app that loads after it is too. It is a module of
// its own so the ordering is the import order and nothing else.
import { setLocale, currentLocale } from '../src/ui/i18n/index.js';
import { resolveLocale } from '../src/ui/i18n/locale.js';
import { applyTranslations } from '../src/ui/i18n/dom.js';

setLocale(resolveLocale(navigator.language));
document.documentElement.lang = currentLocale().split('_')[0] ?? 'en';
applyTranslations();
